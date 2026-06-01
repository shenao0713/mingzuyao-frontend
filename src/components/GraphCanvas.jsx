import { useEffect, useRef, useState, useCallback } from "react";
import * as d3 from "d3";

const GRAPH_FIELD_SEP = "^^";

function nodeColor(labels = []) {
  const palette = {
    Herb: "#3d7c47",
    Formula: "#9a3f2d",
    Symptom: "#c08b2f",
    Effect: "#7d5a44",
    Region: "#4f7e88",
    Therapy: "#6b5c9d",
    Concept: "#8f6a3b",
    Document: "#b46a4d"
  };
  return palette[labels[0]] || "#6a7a52";
}

function getRelationCount(nodeId, links) {
  return links.filter(link => 
    (link.source.id || link.source) === nodeId || 
    (link.target.id || link.target) === nodeId
  ).length;
}

function formatProperties(properties) {
  if (!properties) return [];
  const result = [];
  const skipKeys = ["entity_type", "source_id", "created_at", "truncate", "file_path"];
  for (const [key, value] of Object.entries(properties)) {
    if (skipKeys.includes(key)) continue;
    if (value && typeof value === "string" && value.length > 0) {
      result.push({ key, value: value.length > 100 ? value.slice(0, 100) + "..." : value });
    }
  }
  return result;
}

function isPathEdge(sourceId, targetId, shortestPaths) {
  if (!shortestPaths || shortestPaths.length === 0) return false;
  return shortestPaths.some((path) =>
    path.edges.some(([s, t]) =>
      (s === sourceId && t === targetId) || (s === targetId && t === sourceId)
    )
  );
}

export default function GraphCanvas({
  graphData,
  highlightedIds = [],
  shortestPaths = [],
  emptyMessage = "暂无图谱数据",
  onToggleFullscreen,
  isFullscreen = false,
  embedded = false
}) {
  const svgRef = useRef(null);
  const tooltipRef = useRef(null);
  const containerRef = useRef(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [cardPosition, setCardPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  const handleDragStart = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    dragOffsetRef.current = {
      x: e.clientX - cardPosition.x,
      y: e.clientY - cardPosition.y
    };
  }, [cardPosition]);

  const handleDragMove = useCallback((e) => {
    if (!isDragging) return;
    const newX = e.clientX - dragOffsetRef.current.x;
    const newY = e.clientY - dragOffsetRef.current.y;
    const boundedX = Math.max(5, Math.min(newX, window.innerWidth - 310));
    const boundedY = Math.max(5, Math.min(newY, window.innerHeight - 50));
    setCardPosition({ x: boundedX, y: boundedY });
  }, [isDragging]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      const handleMove = handleDragMove;
      const handleEnd = handleDragEnd;
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleEnd);
      return () => {
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleEnd);
      };
    }
  }, [isDragging, handleDragMove, handleDragEnd]);

  useEffect(() => {
    const svgNode = svgRef.current;
    if (!svgNode) {
      return undefined;
    }

    const container = svgNode.parentElement;
    let width;
    let height;
    
    if (isFullscreen) {
      width = window.innerWidth - 40;
      height = window.innerHeight - 100;
    } else if (embedded) {
      width = container.clientWidth || 600;
      height = 320;
    } else {
      width = container.clientWidth || 800;
      height = container.clientHeight || 520;
    }
    const svg = d3.select(svgNode);
    svg.selectAll("*").remove();

    const tooltip = d3.select(tooltipRef.current);
    const nodes = (graphData?.nodes || []).map((node) => ({ ...node }));
    const links = (graphData?.edges || []).map((edge) => ({ ...edge }));

    if (!nodes.length) {
      svg
        .attr("viewBox", [0, 0, width, height])
        .append("text")
        .attr("x", width / 2)
        .attr("y", height / 2)
        .attr("text-anchor", "middle")
        .attr("fill", "#8a8a75")
        .text(emptyMessage);
      return undefined;
    }

    svg.attr("viewBox", [0, 0, width, height]);
    const canvas = svg.append("g");

    svg.call(
      d3
        .zoom()
        .scaleExtent([0.2, 4])
        .on("zoom", (event) => {
          canvas.attr("transform", event.transform);
        })
    );

    const simulation = d3
      .forceSimulation(nodes)
      .force("link", d3.forceLink(links).id((d) => d.id).distance(110))
      .force("charge", d3.forceManyBody().strength(-380))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(30));

    const link = canvas
      .append("g")
      .selectAll("line")
      .data(links)
      .enter()
      .append("line")
      .attr("stroke", (d) =>
        isPathEdge(d.source.id || d.source, d.target.id || d.target, shortestPaths)
          ? "#FF8C00"
          : "#b7aa91"
      )
      .attr("stroke-opacity", 0.7)
      .attr("stroke-width", (d) =>
        isPathEdge(d.source.id || d.source, d.target.id || d.target, shortestPaths)
          ? 3.5
          : 1.4
      );

    const node = canvas
      .append("g")
      .selectAll("g")
      .data(nodes)
      .enter()
      .append("g")
      .attr("class", "graph-node")
      .call(
        d3
          .drag()
          .on("start", (event, d) => {
            if (!event.active) {
              simulation.alphaTarget(0.3).restart();
            }
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) {
              simulation.alphaTarget(0);
            }
            d.fx = null;
            d.fy = null;
          })
      );

    node
      .append("circle")
      .attr("r", (d) => (highlightedIds.includes(d.id) ? 18 : 14))
      .attr("fill", (d) => (highlightedIds.includes(d.id) ? "#FF6B6B" : nodeColor(d.labels)))
      .attr("stroke", (d) => (highlightedIds.includes(d.id) ? "#f4bf42" : "#fff6e8"))
      .attr("stroke-width", (d) => (highlightedIds.includes(d.id) ? 4 : 2.5));

    node
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dy", (d) => (highlightedIds.includes(d.id) ? -24 : -20))
      .attr("fill", (d) => (highlightedIds.includes(d.id) ? "#FF6B6B" : "#44331f"))
      .attr("font-size", (d) => (highlightedIds.includes(d.id) ? 13 : 11))
      .attr("font-weight", (d) => (highlightedIds.includes(d.id) ? "600" : "normal"))
      .text((d) => (d.id.length > 14 ? `${d.id.slice(0, 14)}…` : d.id));

    node
      .on("mouseover", (event, d) => {
        const description = d.properties?.description || "暂无描述";
        tooltip
          .style("display", "block")
          .style("left", `${event.pageX + 12}px`)
          .style("top", `${event.pageY + 12}px`)
          .html(
            `<strong>${d.id}</strong><p>${(d.labels || []).join(" / ")}</p><p>${description}</p>`
          );
      })
      .on("mouseout", () => {
        tooltip.style("display", "none");
      })
      .on("click", (event, d) => {
        event.stopPropagation();
        setSelectedNode(d);
        const cardWidth = 300;
        const cardHeight = 250;
        let x = event.pageX + 20;
        let y = event.pageY - 10;
        if (x + cardWidth > window.innerWidth) {
          x = event.pageX - cardWidth - 20;
        }
        if (y + cardHeight > window.innerHeight) {
          y = window.innerHeight - cardHeight - 20;
        }
        if (y < 10) {
          y = 10;
        }
        setCardPosition({ x, y });
      });

    svg.on("click", () => {
      setSelectedNode(null);
    });

    simulation.on("tick", () => {
      link
        .attr("x1", (d) => d.source.x)
        .attr("y1", (d) => d.source.y)
        .attr("x2", (d) => d.target.x)
        .attr("y2", (d) => d.target.y);

      node.attr("transform", (d) => `translate(${d.x},${d.y})`);
    });

    return () => {
      simulation.stop();
    };
  }, [emptyMessage, graphData, JSON.stringify(highlightedIds), JSON.stringify(shortestPaths), isFullscreen, embedded]);

  return (
    <div ref={containerRef} className={`graph-canvas ${isFullscreen ? "graph-canvas--fullscreen" : ""} ${embedded ? "graph-canvas--embedded" : ""}`}>
      {!isFullscreen && !embedded && onToggleFullscreen && (
        <button
          type="button"
          className="graph-expand-btn"
          onClick={onToggleFullscreen}
          title="全屏显示图谱"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
          </svg>
        </button>
      )}
      <svg ref={svgRef} className="graph-canvas__svg" />
      <div ref={tooltipRef} className="graph-canvas__tooltip" />
      
      {selectedNode && (
        <div 
          className="graph-node-card"
          style={{ 
            left: cardPosition.x, 
            top: cardPosition.y,
            cursor: isDragging ? 'grabbing' : 'default'
          }}
        >
          <button 
            type="button"
            className="graph-node-card__close" 
            onClick={(e) => {
              e.stopPropagation();
              setSelectedNode(null);
            }}
          >
            ×
          </button>
          <div 
            className="graph-node-card__header"
            onMouseDown={handleDragStart}
            style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
          >
            <span 
              className="graph-node-card__type" 
              style={{ backgroundColor: nodeColor(selectedNode.labels) }}
            >
              {selectedNode.labels?.[0] || selectedNode.properties?.entity_type || "实体"}
            </span>
            <h4 className="graph-node-card__name">{selectedNode.id}</h4>
            <span className="graph-node-card__drag-handle" title="拖动移动">
              ⋮⋮
            </span>
          </div>
          <div className="graph-node-card__body">
            <p className="graph-node-card__description">
              {selectedNode.properties?.description || "暂无描述信息"}
            </p>
            {selectedNode.properties?.image_url && (
              <div className="graph-node-card__image">
                <img src={selectedNode.properties.image_url} alt={selectedNode.id} loading="lazy" />
              </div>
            )}
            {formatProperties(selectedNode.properties).map(({ key, value }) => (
              <p key={key} className="graph-node-card__property">
                <span className="graph-node-card__property-key">{key}:</span>
                <span className="graph-node-card__property-value">{value}</span>
              </p>
            ))}
          </div>
          <div className="graph-node-card__footer">
            <span className="graph-node-card__relations">
              关联关系: {getRelationCount(selectedNode.id, graphData?.edges || [])} 条
            </span>
            {selectedNode.properties?.file_path && (
              <span className="graph-node-card__source">
                来源: {selectedNode.properties.file_path.split(GRAPH_FIELD_SEP)[0].slice(0, 30)}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
