import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import GraphCanvas from "../components/GraphCanvas";
import MarkdownBlock from "../components/MarkdownBlock";
import PortalHeader from "../components/PortalHeader";
import { useAuth } from "../lib/auth";
import { apiRequest, APIError } from "../lib/api";
import { buildLoginPath } from "../lib/routing";
import { detectTibetan } from "../lib/translator";

function formatBytes(value) {
  if (!value) {
    return "0 B";
  }
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTimestamp(value) {
  if (!value) {
    return "未更新";
  }
  return value.replace("T", " ").slice(0, 16);
}

export default function KnowledgePage() {
  const navigate = useNavigate();
  const { user, logout, loading } = useAuth();
  const progressSocketRef = useRef(null);
  const [knowledgeBases, setKnowledgeBases] = useState([]);
  const [selectedTarget, setSelectedTarget] = useState({ type: "system", kb: null });
  const [activeTab, setActiveTab] = useState("overview");
  const [documents, setDocuments] = useState([]);
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] });
  const [graphHighlights, setGraphHighlights] = useState([]);
  const [maxNodes, setMaxNodes] = useState(180);
  const [currentCenterNode, setCurrentCenterNode] = useState(null);
  const [showAllNodes, setShowAllNodes] = useState(false);
  const [totalNodeCount, setTotalNodeCount] = useState(1000);
  const [shortestPaths, setShortestPaths] = useState([]);
  const [stats, setStats] = useState({});
  const [storageStats, setStorageStats] = useState({});
  const [queryText, setQueryText] = useState("");
  const [queryResult, setQueryResult] = useState("");
  const [graphSearch, setGraphSearch] = useState("");
  const [createForm, setCreateForm] = useState({ name: "", description: "", isShared: false });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [processState, setProcessState] = useState({ active: false, text: "正在处理文档..." });
  const [statusText, setStatusText] = useState("系统知识库已就绪，可浏览图谱或创建专家知识库。");
  const [isGraphFullscreen, setIsGraphFullscreen] = useState(false);
  const [translateToChinese, setTranslateToChinese] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      navigate(buildLoginPath("/knowledge"), { replace: true });
    }
  }, [loading, navigate, user]);

  useEffect(() => {
    if (!user) {
      return;
    }
    initializePage();
  }, [user]);

  useEffect(() => {
    return () => {
      closeProgressSocket();
    };
  }, []);

  useEffect(() => {
    if (!isGraphFullscreen) return;
    
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setIsGraphFullscreen(false);
      }
    }
    
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isGraphFullscreen]);

  function toggleGraphFullscreen() {
    setIsGraphFullscreen((prev) => !prev);
  }
  
  useEffect(() => {
    if (currentCenterNode && selectedTarget.type) {
      loadGraph(selectedTarget.type, selectedTarget.kb?.id, currentCenterNode, maxNodes);
    }
  }, [maxNodes]);

  function closeProgressSocket() {
    if (progressSocketRef.current) {
      progressSocketRef.current.close();
      progressSocketRef.current = null;
    }
  }

  async function initializePage() {
    try {
      const [kbData, systemStatsData, storageStatsData] = await Promise.all([
        apiRequest("/kb/list", { auth: true }),
        apiRequest("/system/stats"),
        apiRequest("/system/storage-stats")
      ]);
      setKnowledgeBases(kbData.knowledge_bases || []);
      setStats(systemStatsData.stats || {});
      setStorageStats(storageStatsData.storage_stats || {});
      setTotalNodeCount(systemStatsData.stats?.entity_count || 1000);
      await loadGraph("system");
    } catch (error) {
      handleAuthError(error);
    }
  }

  function handleAuthError(error) {
    if (error instanceof APIError && error.status === 401) {
      closeProgressSocket();
      logout();
      navigate(buildLoginPath("/knowledge"), { replace: true });
      return;
    }
    setStatusText(error.message || "操作失败，请稍后重试。");
  }

  async function refreshKnowledgeBases(preferId = null) {
    const data = await apiRequest("/kb/list", { auth: true });
    const next = data.knowledge_bases || [];
    setKnowledgeBases(next);
    if (preferId) {
      const matched = next.find((kb) => kb.id === preferId);
      if (matched) {
        setSelectedTarget({ type: "kb", kb: matched });
      }
    }
    return next;
  }

  async function loadSystemOverview() {
    const [systemStatsData, storageStatsData] = await Promise.all([
      apiRequest("/system/stats"),
      apiRequest("/system/storage-stats")
    ]);
    setSelectedTarget({ type: "system", kb: null });
    setStats(systemStatsData.stats || {});
    setStorageStats(storageStatsData.storage_stats || {});
    setTotalNodeCount(systemStatsData.stats?.entity_count || 1000);
    setDocuments([]);
    setQueryResult("");
    setGraphSearch("");
    setGraphHighlights([]);
    setActiveTab("overview");
    setStatusText("当前查看系统知识库。");
    await loadGraph("system");
  }

  async function loadKnowledgeBase(kbId) {
    try {
      const [kbData, documentData] = await Promise.all([
        apiRequest(`/kb/${kbId}`, { auth: true }),
        apiRequest(`/kb/${kbId}/documents`, { auth: true })
      ]);
      setSelectedTarget({ type: "kb", kb: kbData.knowledge_base });
      setDocuments(documentData.documents || []);
      setStats(kbData.knowledge_base.stats || {});
      setQueryResult("");
      setGraphSearch("");
      setGraphHighlights([]);
      setActiveTab("overview");
      setStatusText(`已加载知识库「${kbData.knowledge_base.name}」`);
      await loadGraph("kb", kbId);
    } catch (error) {
      handleAuthError(error);
    }
  }

  async function loadGraph(type, kbId = selectedTarget.kb?.id, centerNode = null, nodeLimitArg = null) {
    try {
      let centerLabel = centerNode;
      
      if (!centerLabel) {
        const popularPath =
          type === "system" ? "/system/graph/popular?limit=10" : `/kb/${kbId}/graph/popular?limit=10`;
        const popularData = await apiRequest(popularPath, { auth: type === "kb" });
        centerLabel = (popularData.labels || [])[0];
      }
      
      if (!centerLabel) {
        setGraphData({ nodes: [], edges: [] });
        return;
      }
      
      setCurrentCenterNode(centerLabel);
      
      const nodeLimit = showAllNodes ? -1 : (nodeLimitArg || maxNodes);
      
      const graphPath =
        type === "system"
          ? `/system/graph?label=${encodeURIComponent(centerLabel)}&max_depth=2&max_nodes=${nodeLimit}`
          : `/kb/${kbId}/graph?label=${encodeURIComponent(centerLabel)}&max_depth=2&max_nodes=${nodeLimit}`;
      const graphResponse = await apiRequest(graphPath, { auth: type === "kb" });
      setGraphData(graphResponse.graph || { nodes: [], edges: [] });
      setGraphHighlights([centerLabel]);
    } catch (error) {
      handleAuthError(error);
    }
  }

  async function searchGraph() {
    if (!graphSearch.trim()) {
      setGraphHighlights([]);
      setShortestPaths([]);
      return;
    }
    try {
      const path =
        selectedTarget.type === "system"
          ? `/system/graph/search-subgraph?q=${encodeURIComponent(graphSearch.trim())}&max_depth=2&max_nodes=${showAllNodes ? -1 : maxNodes}`
          : `/kb/${selectedTarget.kb.id}/graph/search?q=${encodeURIComponent(graphSearch.trim())}&limit=10`;
      const data = await apiRequest(path, { auth: selectedTarget.type === "kb" });
      
      if (selectedTarget.type === "system") {
        const results = data.results || [];
        const graph = data.graph || { nodes: [], edges: [] };
        const paths = data.paths || [];
        
        if (results.length > 0) {
          setStatusText(`找到 ${results.length} 个匹配节点，已显示子图和最短路径。`);
          setGraphData(graph);
          setGraphHighlights(results);
          setShortestPaths(paths);
          if (results.length > 0) {
            setCurrentCenterNode(results[0]);
          }
        } else {
          setStatusText("未找到匹配实体，可尝试切换关键词。");
          setGraphHighlights([]);
          setShortestPaths([]);
        }
      } else {
        const results = data.results || [];
        if (results.length > 0) {
          setStatusText(`找到 ${results.length} 个匹配节点，图谱已更新。`);
          await loadGraph(selectedTarget.type, selectedTarget.kb?.id, results[0], maxNodes);
          setShortestPaths([]);
        } else {
          setStatusText("未找到匹配实体，可尝试切换关键词。");
          setGraphHighlights([]);
          setShortestPaths([]);
        }
      }
    } catch (error) {
      handleAuthError(error);
    }
  }

  async function performExpertQuery() {
    if (!queryText.trim()) {
      return;
    }
    try {
      if (selectedTarget.type === "system") {
        const data = await apiRequest("/query", {
          method: "POST",
          auth: true,
          body: {
            question: queryText.trim(),
            stream: false
          }
        });
        setQueryResult(data.answer || "");
      } else {
        const data = await apiRequest(`/kb/${selectedTarget.kb.id}/query`, {
          method: "POST",
          auth: true,
          body: {
            question: queryText.trim(),
            stream: false
          }
        });
        setQueryResult(data.answer || "");
      }
      setStatusText("专家问答结果已生成。");
    } catch (error) {
      handleAuthError(error);
    }
  }

  async function handleUpload(event) {
    const files = Array.from(event.target.files || []);
    if (!files.length || selectedTarget.type !== "kb") {
      return;
    }
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        await apiRequest(`/kb/${selectedTarget.kb.id}/documents/upload`, {
          method: "POST",
          auth: true,
          body: formData,
          isForm: true
        });
      }
      await loadKnowledgeBase(selectedTarget.kb.id);
      setStatusText(`已上传 ${files.length} 份文档。`);
    } catch (error) {
      handleAuthError(error);
    } finally {
      event.target.value = "";
    }
  }

  async function startProcessing() {
    if (selectedTarget.type !== "kb") {
      return;
    }
    try {
      const data = await apiRequest(`/kb/${selectedTarget.kb.id}/documents/process`, {
        method: "POST",
        auth: true
      });
      if (data.track_id) {
        closeProgressSocket();
        setProcessState({ active: true, text: "正在处理文档，请保持页面开启..." });
        const wsBaseUrl = import.meta.env.VITE_WS_BASE_URL || `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}`;
        const socket = new WebSocket(`${wsBaseUrl}/ws/progress/${data.track_id}`);
        progressSocketRef.current = socket;

        socket.onmessage = async (event) => {
          const payload = JSON.parse(event.data);
          if (payload.event === "progress") {
            setProcessState({
              active: true,
              text: `${payload.step} · ${payload.current_doc || ""} · ${payload.progress}%`
            });
          }
          if (payload.event === "complete") {
            closeProgressSocket();
            setProcessState({ active: false, text: "" });
            await loadKnowledgeBase(selectedTarget.kb.id);
            await loadGraph("kb", selectedTarget.kb.id);
            setStatusText("文档处理完成，图谱已更新。");
          }
          if (payload.event === "cancelled" || payload.event === "error") {
            closeProgressSocket();
            setProcessState({ active: false, text: "" });
            await loadKnowledgeBase(selectedTarget.kb.id);
            setStatusText(payload.message || payload.error || "处理任务已结束。");
          }
        };

        socket.onclose = () => {
          if (progressSocketRef.current === socket) {
            progressSocketRef.current = null;
          }
        };
      } else {
        setStatusText(data.message || "当前没有待处理文档。");
      }
    } catch (error) {
      handleAuthError(error);
    }
  }

  async function cancelProcessing() {
    if (selectedTarget.type !== "kb") {
      return;
    }
    try {
      await apiRequest(`/kb/${selectedTarget.kb.id}/documents/cancel`, {
        method: "POST",
        auth: true
      });
      setStatusText("已发送取消请求。");
    } catch (error) {
      handleAuthError(error);
    }
  }

  async function createKnowledgeBase(event) {
    event.preventDefault();
    try {
      const data = await apiRequest("/kb/create", {
        method: "POST",
        auth: true,
        body: {
          name: createForm.name,
          description: createForm.description,
          is_shared: createForm.isShared
        }
      });
      setShowCreateModal(false);
      setCreateForm({ name: "", description: "", isShared: false });
      await refreshKnowledgeBases(data.kb_id);
      await loadKnowledgeBase(data.kb_id);
      setStatusText("新知识库已创建。");
    } catch (error) {
      handleAuthError(error);
    }
  }

  async function deleteKnowledgeBase(kb) {
    const confirmName = window.prompt(`请输入知识库名称「${kb.name}」确认删除`);
    if (!confirmName) {
      return;
    }
    try {
      await apiRequest(`/kb/${kb.id}?confirm_name=${encodeURIComponent(confirmName)}`, {
        method: "DELETE",
        auth: true
      });
      await refreshKnowledgeBases();
      await loadSystemOverview();
    } catch (error) {
      handleAuthError(error);
    }
  }

  if (!user) {
    return null;
  }

  const targetTitle = selectedTarget.type === "system" ? "系统知识库" : selectedTarget.kb?.name;
  const showUploadTab = selectedTarget.type === "kb";

  return (
    <div className="page-shell page-shell--workspace">
      <PortalHeader variant="workspace" />

      <main className="workspace-page">
        <section className="workspace-hero">
          <div className="workspace-hero__copy">
            <span className="eyebrow">专家知识库管理</span>
            <h1>以一个统一界面完成知识库创建、文档处理、图谱浏览与专家问答。</h1>
            <p>
              这里是系统中最适合展示知识工程能力的页面。左侧进行知识库导航，右侧切换概览、导入、图谱和问答四类任务区。
            </p>
          </div>
          <div className="workspace-hero__actions">
            <Link to="/portal" className="ghost-button">
              返回系统门户
            </Link>
            <Link to="/chat" className="secondary-button">
              前往问答系统
            </Link>
          </div>
        </section>

        <section className="knowledge-layout">
          <aside className="workspace-sidebar knowledge-sidebar">
            <div className="sidebar-card">
              <span className="eyebrow">知识库导航</span>
              <h2>知识源列表</h2>
              <p>支持切换系统知识库和用户创建的专家知识库，左侧导航始终保持单一入口逻辑。</p>
            </div>

            <div className="sidebar-actions">
              <button type="button" className="small-button" onClick={() => setShowCreateModal(true)}>
                新建知识库
              </button>
            </div>

            <button
              type="button"
              className={selectedTarget.type === "system" ? "kb-nav-card active" : "kb-nav-card"}
              onClick={loadSystemOverview}
            >
              <span className="eyebrow">系统内置</span>
              <strong>系统知识库</strong>
              <p>浏览默认藏医药图谱、系统统计与示例问答。</p>
            </button>

            <div className="knowledge-list">
              {knowledgeBases.length ? (
                knowledgeBases.map((kb) => (
                  <article
                    key={kb.id}
                    className={
                      selectedTarget.type === "kb" && selectedTarget.kb?.id === kb.id
                        ? "kb-nav-card active"
                        : "kb-nav-card"
                    }
                  >
                    <button type="button" className="kb-nav-card__body" onClick={() => loadKnowledgeBase(kb.id)}>
                      <span className="eyebrow">用户知识库</span>
                      <strong>{kb.name}</strong>
                      <p>{kb.description || "暂无描述"}</p>
                    </button>
                    {kb.can_edit ? (
                      <button type="button" className="kb-nav-card__delete" onClick={() => deleteKnowledgeBase(kb)}>
                        删除
                      </button>
                    ) : null}
                  </article>
                ))
              ) : (
                <div className="empty-state empty-state--compact">
                  <h3>暂无自建知识库</h3>
                  <p>可以点击上方按钮新建一个专家知识库用于文档导入与图谱演示。</p>
                </div>
              )}
            </div>
          </aside>

          <section className="workspace-main knowledge-main">
            <div className="knowledge-header">
              <div>
                <span className="eyebrow">当前目标</span>
                <h2>{targetTitle}</h2>
                <p>{statusText}</p>
              </div>
              <div className="knowledge-header__meta">
                {selectedTarget.type === "kb" ? (
                  <span className="tag">最近更新: {formatTimestamp(selectedTarget.kb?.updated_at)}</span>
                ) : (
                  <span className="tag">系统级知识源</span>
                )}
                {processState.active ? <span className="tag">文档处理中</span> : null}
              </div>
            </div>

            <div className="knowledge-tabs">
              <button
                type="button"
                className={activeTab === "overview" ? "tab-button active" : "tab-button"}
                onClick={() => setActiveTab("overview")}
              >
                概览
              </button>
              {showUploadTab ? (
                <button
                  type="button"
                  className={activeTab === "upload" ? "tab-button active" : "tab-button"}
                  onClick={() => setActiveTab("upload")}
                >
                  文档导入
                </button>
              ) : null}
              <button
                type="button"
                className={activeTab === "graph" ? "tab-button active" : "tab-button"}
                onClick={() => setActiveTab("graph")}
              >
                知识图谱
              </button>
              <button
                type="button"
                className={activeTab === "query" ? "tab-button active" : "tab-button"}
                onClick={() => setActiveTab("query")}
              >
                专家问答
              </button>
            </div>

            {activeTab === "overview" ? (
              <section className="knowledge-panel">
                <div className="stats-grid">
                  <article className="stat-card">
                    <span>节点数</span>
                    <strong>{stats.node_count || 0}</strong>
                  </article>
                  <article className="stat-card">
                    <span>关系数</span>
                    <strong>{stats.edge_count || 0}</strong>
                  </article>
                  <article className="stat-card">
                    <span>已处理文档</span>
                    <strong>{stats.processed_docs || 0}</strong>
                  </article>
                  <article className="stat-card">
                    <span>待处理文档</span>
                    <strong>{stats.pending_docs || 0}</strong>
                  </article>
                </div>

                <div className="knowledge-grid">
                  <article className="detail-card">
                    <span className="eyebrow">标签分布</span>
                    <h3>知识实体统计</h3>
                    <div className="tag-row">
                      {Object.entries(stats.label_distribution || {}).length ? (
                        Object.entries(stats.label_distribution || {}).map(([label, count]) => (
                          <span key={label} className="tag">
                            {label}: {count}
                          </span>
                        ))
                      ) : (
                        <span className="tag">暂无统计</span>
                      )}
                    </div>
                  </article>

                  {selectedTarget.type === "system" ? (
                    <article className="detail-card">
                      <span className="eyebrow">运行信息</span>
                      <h3>系统存储概览</h3>
                      <p>系统图谱文件: {storageStats.system_graph_file || "未加载"}</p>
                      <p>本地文件数: {storageStats.total_files || 0}</p>
                      <p>存储大小: {formatBytes(storageStats.total_size_bytes || 0)}</p>
                    </article>
                  ) : (
                    <article className="detail-card">
                      <span className="eyebrow">知识库说明</span>
                      <h3>{selectedTarget.kb?.description || "暂无描述"}</h3>
                      <p>是否共享: {selectedTarget.kb?.is_shared ? "是" : "否"}</p>
                      <p>工作目录: {selectedTarget.kb?.working_dir}</p>
                    </article>
                  )}
                </div>
              </section>
            ) : null}

            {activeTab === "upload" && showUploadTab ? (
              <section className="knowledge-panel">
                <div className="upload-toolbar">
                  <label className="primary-button">
                    选择文档
                    <input type="file" hidden multiple onChange={handleUpload} />
                  </label>
                  <label className="checkbox-inline">
                    <input
                      type="checkbox"
                      checked={translateToChinese}
                      onChange={(event) => setTranslateToChinese(event.target.checked)}
                    />
                    藏语文档自动翻译为中文
                  </label>
                  <button type="button" className="secondary-button" onClick={startProcessing}>
                    开始处理文档
                  </button>
                  <button type="button" className="ghost-button" onClick={cancelProcessing}>
                    取消处理
                  </button>
                </div>

                <div className="document-grid">
                  {documents.length ? (
                    documents.map((document) => (
                      <article key={document.doc_id} className="document-card">
                        <strong>{document.file_name}</strong>
                        <span>大小: {formatBytes(document.file_size)}</span>
                        <span>上传时间: {formatTimestamp(document.uploaded_at)}</span>
                        <span className={`status-pill status-pill--${document.status}`}>{document.status}</span>
                      </article>
                    ))
                  ) : (
                    <div className="empty-state">
                      <h3>暂无上传文档</h3>
                      <p>上传 PDF、DOCX、TXT 等文档后，即可启动处理并更新知识图谱。</p>
                    </div>
                  )}
                </div>
              </section>
            ) : null}

            {activeTab === "graph" ? (
              <section className="knowledge-panel graph-panel">
                <div className="graph-toolbar">
                  <input
                    value={graphSearch}
                    onChange={(event) => setGraphSearch(event.target.value)}
                    placeholder="搜索实体，例如：红景天、七十味珍珠丸"
                  />
                  <button type="button" className="secondary-button secondary-button--small" onClick={searchGraph}>
                    搜索实体
                  </button>
                  <div className="slider-control">
                    <label>节点数量:</label>
                    <input
                      type="range"
                      min="50"
                      max="1000"
                      step="50"
                      value={maxNodes}
                      onChange={(event) => setMaxNodes(parseInt(event.target.value))}
                      disabled={showAllNodes}
                    />
                    <span>{showAllNodes ? "全部" : maxNodes}</span>
                    <label className="checkbox-inline">
                      <input
                        type="checkbox"
                        checked={showAllNodes}
                        onChange={(event) => setShowAllNodes(event.target.checked)}
                      />
                      全部
                    </label>
                  </div>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() =>
                      selectedTarget.type === "system"
                        ? loadGraph("system", null, currentCenterNode, maxNodes)
                        : loadGraph("kb", selectedTarget.kb?.id, currentCenterNode, maxNodes)
                    }
                  >
                    重新布局
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() =>
                      selectedTarget.type === "system"
                        ? loadGraph("system")
                        : loadGraph("kb", selectedTarget.kb.id)
                    }
                  >
                    重置默认
                  </button>
                </div>
                <GraphCanvas
                  graphData={graphData}
                  highlightedIds={graphHighlights}
                  shortestPaths={shortestPaths}
                  emptyMessage="当前知识源暂无图谱数据，请先导入文档或切换到系统知识库。"
                  onToggleFullscreen={toggleGraphFullscreen}
                  isFullscreen={false}
                />
              </section>
            ) : null}

            {activeTab === "query" ? (
              <section className="knowledge-panel">
                <div className="query-layout">
                  <div className="query-layout__form">
                    <span className="eyebrow">专家问答</span>
                    <h3>
                      基于{selectedTarget.type === "system" ? "系统知识库" : selectedTarget.kb?.name}发起问答
                    </h3>
                    <textarea
                      value={queryText}
                      onChange={(event) => setQueryText(event.target.value)}
                      placeholder="输入一个面向知识库的问题，例如：七十味珍珠丸与安神开窍之间有什么关系？"
                      rows={5}
                    />
                    <button type="button" className="primary-button" onClick={performExpertQuery}>
                      发起问答
                    </button>
                  </div>

                  <div className="query-layout__result">
                    {queryResult ? (
                      <div className="result-card">
                        <MarkdownBlock content={queryResult} />
                      </div>
                    ) : (
                      <div className="empty-state">
                        <h3>专家问答结果</h3>
                        <p>在这里可以展示系统知识库或专家知识库的问答结果，与图谱浏览形成联动。</p>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            ) : null}
          </section>
        </section>
      </main>

      {showCreateModal ? (
        <div className="modal-backdrop">
          <form className="modal-card" onSubmit={createKnowledgeBase}>
            <span className="eyebrow">创建知识库</span>
            <h2>新建专家知识库</h2>
            <label className="field-group">
              <span>知识库名称</span>
              <input
                value={createForm.name}
                onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="例如：藏药临床病例库"
              />
            </label>
            <label className="field-group">
              <span>描述</span>
              <textarea
                value={createForm.description}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, description: event.target.value }))
                }
                rows={3}
                placeholder="描述这个专家知识库主要收录的文档和用途"
              />
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={createForm.isShared}
                onChange={(event) =>
                  setCreateForm((current) => ({ ...current, isShared: event.target.checked }))
                }
              />
              设为共享知识库
            </label>
            <div className="modal-card__actions">
              <button type="button" className="ghost-button" onClick={() => setShowCreateModal(false)}>
                取消
              </button>
              <button type="submit" className="primary-button">
                创建
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {processState.active ? (
        <div className="modal-backdrop">
          <div className="modal-card">
            <span className="eyebrow">文档处理中</span>
            <h2>知识图谱正在更新</h2>
            <p>{processState.text}</p>
            <button type="button" className="ghost-button" onClick={cancelProcessing}>
              发送取消请求
            </button>
          </div>
        </div>
      ) : null}

      {isGraphFullscreen ? (
        <div className="graph-fullscreen-overlay" onClick={toggleGraphFullscreen}>
          <div className="graph-fullscreen-content" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="graph-fullscreen-close"
              onClick={toggleGraphFullscreen}
              title="退出全屏"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
            <div className="graph-fullscreen-toolbar">
              <input
                value={graphSearch}
                onChange={(event) => setGraphSearch(event.target.value)}
                placeholder="搜索实体，例如：红景天、七十味珍珠丸"
              />
              <button type="button" className="secondary-button secondary-button--small" onClick={searchGraph}>
                搜索实体
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={() =>
                  selectedTarget.type === "system"
                    ? loadGraph("system", null, currentCenterNode, maxNodes)
                    : loadGraph("kb", selectedTarget.kb?.id, currentCenterNode, maxNodes)
                }
              >
                重新布局
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={() =>
                  selectedTarget.type === "system"
                    ? loadGraph("system")
                    : loadGraph("kb", selectedTarget.kb.id)
                }
              >
                重置默认
              </button>
            </div>
            <GraphCanvas
              graphData={graphData}
              highlightedIds={graphHighlights}
              shortestPaths={shortestPaths}
              emptyMessage="当前知识源暂无图谱数据，请先导入文档或切换到系统知识库。"
              isFullscreen={true}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
