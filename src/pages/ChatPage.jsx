import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import AssistantMessage from "../components/AssistantMessage";
import PortalHeader from "../components/PortalHeader";
import { useAuth } from "../lib/auth";
import { apiRequest, APIError, streamDetail } from "../lib/api";
import { buildLoginPath } from "../lib/routing";
import {
  loadSessions,
  createLocalSession,
  deleteLocalSession,
  updateLocalSessionMessages,
  clearAllLocalSessions,
  getLocalSession,
  setActiveSessionIdLocal
} from "../lib/storage";
import { detectLanguage } from "../lib/translator";

const QUICK_PROMPTS = [
  "红景天在高原反应调护中的作用是什么？",
  "请结合藏医药知识说明七十味珍珠丸的应用场景。",
  "如果上传一张药材图片，系统会如何辅助判断相关知识？"
];

function sourceToFormValue(source) {
  return source.type === "kb" ? `kb:${source.id}` : "system";
}

function formatTimestamp(value) {
  if (!value) {
    return "刚刚更新";
  }
  return value.replace("T", " ").slice(0, 16);
}

function sourceLabelFromSession(session, knowledgeBases) {
  if (session.knowledge_source_type === "kb" && session.knowledge_source_id) {
    const matched = knowledgeBases.find((item) => item.id === session.knowledge_source_id);
    return matched ? matched.name : `专家库 #${session.knowledge_source_id}`;
  }
  return "系统知识库";
}

export default function ChatPage() {
  const navigate = useNavigate();
  const { user, logout, loading } = useAuth();
  const chatScrollerRef = useRef(null);
  const streamAbortRef = useRef(null);
  const [sessions, setSessions] = useState([]);
  const [knowledgeBases, setKnowledgeBases] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState("");
  const [messages, setMessages] = useState([]);
  const [source, setSource] = useState({ type: "system", id: null });
  const [draft, setDraft] = useState("");
  const [historyTurns, setHistoryTurns] = useState(5);
  const [uploadedImages, setUploadedImages] = useState([]);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [enableThinking, setEnableThinking] = useState(true);
  const [language, setLanguage] = useState("chinese");
  const [statusText, setStatusText] = useState("请选择一个历史会话，或直接新建会话开始演示。");

  useEffect(() => {
    if (!loading && !user) {
      navigate(buildLoginPath("/chat"), { replace: true });
    }
  }, [loading, navigate, user]);

  useEffect(() => {
    if (!user) {
      return;
    }

    async function initialize() {
      try {
        const kbData = await apiRequest("/kb/list", { auth: true });
        setKnowledgeBases(kbData.knowledge_bases || []);

        const storedData = loadSessions();
        const storedSessions = storedData.sessions || [];
        setSessions(storedSessions);

        if (storedSessions.length) {
          const firstId = storedData.activeSessionId || storedSessions[0].id;
          openSessionLocal(firstId);
        } else {
          createSessionLocal({ type: "system", id: null });
        }
      } catch (error) {
        handleAuthError(error);
      }
    }

    initialize();
  }, [user]);

  useEffect(() => {
    if (chatScrollerRef.current) {
      chatScrollerRef.current.scrollTop = chatScrollerRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    return () => {
      if (streamAbortRef.current) {
        streamAbortRef.current.abort();
      }
    };
  }, []);

  function handleAuthError(error) {
    if (error instanceof APIError && error.status === 401) {
      if (streamAbortRef.current) {
        streamAbortRef.current.abort();
      }
      logout();
      navigate(buildLoginPath("/chat"), { replace: true });
      return;
    }
    setStatusText(error.message || "操作失败，请稍后重试。");
  }

  async function refreshKnowledgeBases() {
    const data = await apiRequest("/kb/list", { auth: true });
    setKnowledgeBases(data.knowledge_bases || []);
    return data.knowledge_bases || [];
  }

  function createSessionLocal(nextSource = source) {
    const session = createLocalSession(nextSource);
    const storedData = loadSessions();
    setSessions(storedData.sessions || []);
    setActiveSessionId(session.id);
    setMessages([]);
    setSource(nextSource);
    setStatusText("已创建新会话，可以开始提问。");
    return session;
  }

  function openSessionLocal(sessionId) {
    const session = getLocalSession(sessionId);
    if (!session) return;

    setActiveSessionId(sessionId);
    setActiveSessionIdLocal(sessionId);
    setMessages(session.messages || []);
    setSource({
      type: session.knowledge_source_type,
      id: session.knowledge_source_id ?? null
    });
    setStatusText(`已恢复会话「${session.title}」`);
  }

  function deleteSessionLocal(sessionId) {
    const result = deleteLocalSession(sessionId);
    setSessions(result.sessions);
    
    if (result.sessions.length) {
      openSessionLocal(result.activeSessionId);
    } else {
      createSessionLocal(source);
    }
  }

  function clearAllHistoryLocal() {
    clearAllLocalSessions();
    setSessions([]);
    setActiveSessionId("");
    setMessages([]);
    createSessionLocal(source);
  }

  async function handleImageInput(event) {
    const files = Array.from(event.target.files || []);
    if (!files.length) {
      return;
    }
    setUploading(true);
    try {
      const nextImages = [];
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        const data = await apiRequest("/upload_image", {
          method: "POST",
          auth: true,
          body: formData,
          isForm: true
        });
        nextImages.push({
          name: file.name,
          url: data.url,
          path: data.path
        });
      }
      setUploadedImages((current) => [...current, ...nextImages]);
      setStatusText(`已上传 ${nextImages.length} 张图片，可结合文本一起发起多模态问答。`);
    } catch (error) {
      handleAuthError(error);
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  function removeImage(index) {
    setUploadedImages((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  async function sendMessage() {
    if (!draft.trim() || sending) {
      return;
    }

    const question = draft.trim();
    const previousMessages = messages;
    setDraft("");
    setSending(true);
    setStatusText("正在生成回答，请稍候...");

    const detectedLanguage = detectLanguage(question);
    const requestLanguage = detectedLanguage === "tibetan" ? "tibetan" : language;

    let currentSessionId = activeSessionId;
    if (!currentSessionId) {
      const session = createSessionLocal(source);
      currentSessionId = session.id;
    }

    const userMessage = {
      id: `msg-user-${Date.now()}`,
      role: "user",
      content: question,
      multimodal_content: uploadedImages.map((item) => ({ type: "image", img_path: item.path }))
    };

    const assistantMessage = {
      id: `msg-assistant-${Date.now()}`,
      role: "assistant",
      content: "",
      detailData: null
    };

    const optimisticMessages = [...messages, userMessage, assistantMessage];
    setMessages(optimisticMessages);

    const controller = new AbortController();
    streamAbortRef.current = controller;

    try {
      const recentHistory = messages
        .slice(-historyTurns * 2)
        .map((item) => ({ role: item.role, content: item.content }));

      const result = await streamDetail(
        "/query/detail",
        {
          question,
          stream: true,
          mode: "hybrid",
          enable_rerank: true,
          enable_thinking: enableThinking,
          conversation_history: recentHistory,
          history_turns: historyTurns,
          multimodal_content: uploadedImages.map((item) => ({
            type: "image",
            img_path: item.path
          })),
          kb_id: source.type === "kb" ? source.id : null,
          language: requestLanguage
        },
        (partial) => {
          setMessages((current) => {
            const next = [...current];
            next[next.length - 1] = {
              ...next[next.length - 1],
              content: partial
            };
            return next;
          });
        },
        { auth: true, signal: controller.signal }
      );

      const finalText = result.text || "";
      const detailData = result.detail;

      const finalMessages = [
        ...messages,
        { ...userMessage, content: question },
        { ...assistantMessage, content: finalText, detailData }
      ];

      setMessages(finalMessages);
      setUploadedImages([]);
      setStatusText("回答已生成，可继续追问或切换知识源。");

      updateLocalSessionMessages(currentSessionId, finalMessages);
      const storedData = loadSessions();
      setSessions(storedData.sessions || []);
    } catch (error) {
      if (error.name === "AbortError") {
        return;
      }
      handleAuthError(error);
      setMessages(previousMessages);
    } finally {
      if (streamAbortRef.current === controller) {
        streamAbortRef.current = null;
      }
      setSending(false);
    }
  }

  if (!user) {
    return null;
  }

  const currentSession = sessions.find((item) => item.id === activeSessionId);
  const activeKnowledgeBase =
    source.type === "kb" ? knowledgeBases.find((item) => item.id === source.id) : null;
  const currentSourceLabel =
    source.type === "kb"
      ? activeKnowledgeBase?.name || `专家库 #${source.id}`
      : "系统知识库";

  return (
    <div className="page-shell page-shell--workspace">
      <PortalHeader variant="workspace" />

      <main className="workspace-page">
        <section className="chat-layout">
          <aside className="workspace-sidebar chat-sidebar">
            <div className="sidebar-card">
              <span className="eyebrow">会话中心</span>
              <h2>历史会话</h2>
            </div>

            <div className="sidebar-actions">
              <button type="button" className="small-button" onClick={() => createSessionLocal(source)}>
                新建会话
              </button>
              <button type="button" className="ghost-button" onClick={clearAllHistoryLocal}>
                清空历史
              </button>
            </div>

            <div className="session-list">
              {sessions.length ? (
                sessions.map((session) => (
                  <article
                    key={session.id}
                    className={session.id === activeSessionId ? "session-card active" : "session-card"}
                  >
                    <button type="button" className="session-card__body" onClick={() => openSessionLocal(session.id)}>
                      <strong>{session.title}</strong>
                      <div className="session-card__meta">
                        <span>{sourceLabelFromSession(session, knowledgeBases)}</span>
                        <span>{formatTimestamp(session.updated_at)}</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      className="session-card__delete"
                      onClick={() => deleteSessionLocal(session.id)}
                    >
                      删除
                    </button>
                  </article>
                ))
              ) : (
                <div className="empty-state empty-state--compact">
                  <h3>暂无历史会话</h3>
                  <p>点击上方"新建会话"开始问答。</p>
                </div>
              )}
            </div>
          </aside>

          <section className="workspace-main chat-main">
            <div className="chat-thread" ref={chatScrollerRef}>
              {!messages.length ? (
                <div className="empty-state empty-state--hero">
                  <h3>开始一段新的藏医药问答</h3>
                  <p>点击下方输入框提问，或直接点击示例问题快速开始。</p>
                  <div className="quick-prompt-row">
                    {QUICK_PROMPTS.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        className="prompt-chip"
                        onClick={() => setDraft(prompt)}
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {messages.map((message) => (
                <article
                  key={message.id}
                  className={message.role === "user" ? "message-card message-card--user" : "message-card message-card--assistant"}
                >
                  <div className="message-card__head">
                    <div>
                      {message.multimodal_content?.length ? (
                        <span className="message-card__meta">
                          {message.multimodal_content.length} 张图片
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="message-card__bubble">
                    {message.role === "assistant" ? (
                      <AssistantMessage content={message.content} detailData={message.detailData} />
                    ) : (
                      <p className="message-card__plain">{message.content}</p>
                    )}
                  </div>
                </article>
              ))}
            </div>

            <div className="composer-card">
              <div className="composer-toolbar">
                <label className="secondary-button secondary-button--small">
                  {uploading ? "上传中..." : "添加图片"}
                  <input type="file" accept="image/*" multiple hidden onChange={handleImageInput} />
                </label>
                <label className="inline-field inline-field--narrow" style={{ display: 'none' }}>
                  <span>语言</span>
                  <select
                    value={language}
                    onChange={(event) => setLanguage(event.target.value)}
                  >
                    <option value="chinese">中文</option>
                    <option value="tibetan">藏语</option>
                  </select>
                </label>
                <label className="inline-field inline-field--narrow">
                  <span>知识源</span>
                  <select
                    value={sourceToFormValue(source)}
                    onChange={(event) => {
                      const value = event.target.value;
                      if (value === "system") {
                        setSource({ type: "system", id: null });
                      } else {
                        const [, id] = value.split(":");
                        setSource({ type: "kb", id: Number(id) });
                      }
                    }}
                  >
                    <option value="system">系统知识库</option>
                    {knowledgeBases.map((kb) => (
                      <option key={kb.id} value={`kb:${kb.id}`}>
                        {kb.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="inline-field inline-field--narrow">
                  <span>历史轮数</span>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={historyTurns}
                    onChange={(event) => setHistoryTurns(Number(event.target.value || 1))}
                  />
                </label>
                <label className="thinking-toggle">
                  <input
                    type="checkbox"
                    checked={enableThinking}
                    onChange={() => setEnableThinking((prev) => !prev)}
                  />
                  <span className="thinking-toggle__track">
                    <span className="thinking-toggle__thumb" />
                  </span>
                  <span className="thinking-toggle__label">
                    {enableThinking ? "思考模式：开" : "思考模式：关"}
                    <span className="thinking-toggle__hint">（展示模型推理过程，响应较慢）</span>
                  </span>
                </label>
              </div>

              {uploadedImages.length ? (
                <div className="image-chip-row">
                  {uploadedImages.map((image, index) => (
                    <div key={`${image.path}-${index}`} className="image-chip">
                      <img src={image.url} alt={image.name} />
                      <div className="image-chip__copy">
                        <strong>{image.name}</strong>
                      </div>
                      <button type="button" onClick={() => removeImage(index)}>
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="composer-input">
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={language === "tibetan" ? "请输入藏语问题..." : "请输入你想咨询的民族药或藏医药问题..."}
                  rows={3}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      sendMessage();
                    }
                  }}
                />
                <button type="button" className="primary-button" disabled={sending} onClick={sendMessage}>
                  {sending ? "生成中..." : "发送"}
                </button>
              </div>

              <div className="status-banner">{statusText}</div>
            </div>
          </section>
        </section>
      </main>
    </div>
  );
}