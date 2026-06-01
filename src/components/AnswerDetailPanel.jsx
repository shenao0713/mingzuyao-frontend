import { useState, useMemo } from "react";
import GraphCanvas from "./GraphCanvas";

const GRAPH_FIELD_SEP = "^^";

const ENTITY_TYPE_COLORS = {
  Herb: "#3d7c47",
  Formula: "#9a3f2d",
  Symptom: "#c08b2f",
  Effect: "#7d5a44",
  Region: "#4f7e88",
  Therapy: "#6b5c9d",
  Concept: "#8f6a3b",
  Document: "#b46a4d",
};

function convertToGraphData(entities, relationships) {
  const nodeIds = new Set();
  const nodes = entities.map((entity) => {
    const id = entity.entity_name || entity.id;
    nodeIds.add(id);
    return {
      id,
      labels: [entity.entity_type || "Entity"],
      properties: {
        description: entity.description || "",
        entity_type: entity.entity_type || "",
        source_id: entity.source_id || "",
        file_path: entity.file_path || "",
        rank: entity.rank || 0,
        image_url: entity.image_url || "",
      },
    };
  });

  const edges = [];
  for (const rel of relationships) {
    const src = rel.src_id || rel.source;
    const tgt = rel.tgt_id || rel.target;
    if (src && tgt && nodeIds.has(src) && nodeIds.has(tgt)) {
      edges.push({
        id: `rel-${edges.length}`,
        type: rel.description || "",
        source: src,
        target: tgt,
        properties: {
          description: rel.description || "",
          weight: rel.weight || 1,
          keywords: rel.keywords || "",
          source_id: rel.source_id || "",
        },
      });
    }
  }

  return { nodes, edges };
}

function CollapsibleSection({ title, count, defaultOpen = false, children }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="detail-section">
      <button
        type="button"
        className="detail-section__header"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="detail-section__title">{title}</span>
        <span className="detail-section__badge">{count}</span>
        <span className={`detail-section__arrow ${isOpen ? "detail-section__arrow--open" : ""}`}>
          ▼
        </span>
      </button>
      {isOpen && <div className="detail-section__content">{children}</div>}
    </div>
  );
}

function EntityTable({ entities }) {
  if (!entities.length) {
    return <p className="detail-empty">暂无实体数据</p>;
  }

  return (
    <div className="detail-table-wrapper">
      <table className="detail-table">
        <thead>
          <tr>
            <th>实体名称</th>
            <th>类型</th>
            <th>描述</th>
            <th>图片</th>
          </tr>
        </thead>
        <tbody>
          {entities.map((entity, index) => (
            <tr key={index}>
              <td>
                <span
                  className="detail-entity-name"
                  style={{
                    borderLeftColor: ENTITY_TYPE_COLORS[entity.entity_type] || "#6a7a52",
                  }}
                >
                  {entity.entity_name || entity.id}
                </span>
              </td>
              <td>
                <span
                  className="detail-type-badge"
                  style={{
                    backgroundColor: ENTITY_TYPE_COLORS[entity.entity_type] || "#6a7a52",
                  }}
                >
                  {entity.entity_type || "未知"}
                </span>
              </td>
              <td className="detail-description">
                {entity.description || "暂无描述"}
              </td>
              <td className="detail-image-cell">
                {entity.entity_type === "image" && entity.image_url ? (
                  <div className="detail-image-thumb">
                    <img src={entity.image_url} alt={entity.entity_name} loading="lazy" />
                  </div>
                ) : (
                  <span className="detail-image-placeholder">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RelationshipTable({ relationships }) {
  if (!relationships.length) {
    return <p className="detail-empty">暂无关系数据</p>;
  }

  return (
    <div className="detail-table-wrapper">
      <table className="detail-table">
        <thead>
          <tr>
            <th>源实体</th>
            <th>目标实体</th>
            <th>关系描述</th>
            <th>权重</th>
          </tr>
        </thead>
        <tbody>
          {relationships.map((rel, index) => (
            <tr key={index}>
              <td className="detail-relation-entity">{rel.src_id || rel.source}</td>
              <td className="detail-relation-entity">{rel.tgt_id || rel.target}</td>
              <td className="detail-description">{rel.description || "—"}</td>
              <td className="detail-weight">{rel.weight?.toFixed(2) || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChunkCards({ chunks }) {
  if (!chunks.length) {
    return <p className="detail-empty">暂无原文片段</p>;
  }

  const displayChunks = chunks.slice(0, 3);
  const extraChunks = chunks.slice(3);
  const [showAll, setShowAll] = useState(false);

  function renderChunk(chunk, key) {
    return (
      <div key={key} className={`chunk-card ${chunk.image_url ? "chunk-card--image" : ""}`}>
        {chunk.image_url && (
          <div className="chunk-card__image">
            <img src={chunk.image_url} alt="原文图片" loading="lazy" />
          </div>
        )}
        <div className="chunk-card__content">
          <p className="chunk-card__text">{chunk.content || chunk.text || "无内容"}</p>
        </div>
        {chunk.file_path && (
          <div className="chunk-card__footer">
            <span className="chunk-card__source">
              来源: {chunk.file_path.split(GRAPH_FIELD_SEP)[0].slice(0, 40)}
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="chunk-cards">
      {displayChunks.map((chunk, index) => renderChunk(chunk, index))}
      {extraChunks.length > 0 && !showAll && (
        <button
          type="button"
          className="chunk-card__more-btn"
          onClick={() => setShowAll(true)}
        >
          显示更多 ({extraChunks.length} 条)
        </button>
      )}
      {showAll &&
        extraChunks.map((chunk, index) => renderChunk(chunk, `extra-${index}`))}
    </div>
  );
}

export default function AnswerDetailPanel({ entities = [], relationships = [], chunks = [], references = [], metadata = {} }) {
  const hasData = entities.length > 0 || relationships.length > 0 || chunks.length > 0;

  if (!hasData) {
    return (
      <div className="answer-detail-panel">
        <p className="answer-detail-panel__empty">本次回答未引用任何实体或原文内容</p>
      </div>
    );
  }

  const graphData = useMemo(() => convertToGraphData(entities, relationships), [entities, relationships]);

  return (
    <div className="answer-detail-panel">
      <CollapsibleSection title="知识图谱" count={`${entities.length} 个实体, ${relationships.length} 条关系`} defaultOpen={true}>
        <div className="detail-graph-container">
          <GraphCanvas graphData={graphData} emptyMessage="图谱数据为空" embedded />
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="引用实体" count={entities.length}>
        <EntityTable entities={entities} />
      </CollapsibleSection>

      <CollapsibleSection title="引用关系" count={relationships.length}>
        <RelationshipTable relationships={relationships} />
      </CollapsibleSection>

      <CollapsibleSection title="原文片段" count={chunks.length}>
        <ChunkCards chunks={chunks} />
      </CollapsibleSection>

      {references.length > 0 && (
        <CollapsibleSection title="参考来源" count={references.length}>
          <div className="reference-list">
            {references.map((ref, index) => (
              <div key={index} className="reference-item">
                <span className="reference-item__id">{ref.reference_id || `#${index + 1}`}</span>
                <span className="reference-item__path">{ref.file_path || "未知来源"}</span>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
}
