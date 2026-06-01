const STORAGE_KEY = "tibetan_chat_sessions";

export function loadSessions() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return { sessions: [], activeSessionId: "" };
  }
  try {
    return JSON.parse(raw);
  } catch {
    return { sessions: [], activeSessionId: "" };
  }
}

export function saveSessions(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function createLocalSession(source) {
  const id = `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const session = {
    id,
    title: "新对话",
    knowledge_source_type: source.type,
    knowledge_source_id: source.id,
    message_count: 0,
    last_message_preview: "",
    messages: [],
    updated_at: new Date().toISOString(),
    created_at: new Date().toISOString()
  };
  
  const storedData = loadSessions();
  const newSessions = [session, ...(storedData.sessions || [])];
  saveSessions({ sessions: newSessions, activeSessionId: id });
  
  return session;
}

export function deleteLocalSession(sessionId) {
  const storedData = loadSessions();
  const remaining = (storedData.sessions || []).filter(s => s.id !== sessionId);
  
  if (remaining.length > 0) {
    const newActiveId = storedData.activeSessionId === sessionId 
      ? remaining[0].id 
      : storedData.activeSessionId;
    saveSessions({ sessions: remaining, activeSessionId: newActiveId });
    return { sessions: remaining, activeSessionId: newActiveId };
  }
  
  saveSessions({ sessions: [], activeSessionId: "" });
  return { sessions: [], activeSessionId: "" };
}

export function updateLocalSessionMessages(sessionId, messages) {
  const storedData = loadSessions();
  const sessions = storedData.sessions || [];
  
  const sessionIndex = sessions.findIndex(s => s.id === sessionId);
  if (sessionIndex === -1) return storedData;
  
  const firstUserMsg = messages.find(m => m.role === "user");
  let title = sessions[sessionIndex].title;
  if (firstUserMsg && title === "新对话") {
    title = firstUserMsg.content.slice(0, 20) + (firstUserMsg.content.length > 20 ? "..." : "");
  }
  
  const lastMsg = messages[messages.length - 1];
  const preview = lastMsg?.content?.slice(0, 50) || "";
  
  sessions[sessionIndex] = {
    ...sessions[sessionIndex],
    title,
    messages,
    message_count: messages.length,
    last_message_preview: preview,
    updated_at: new Date().toISOString()
  };
  
  saveSessions({ sessions, activeSessionId: sessionId });
  return { sessions, activeSessionId: sessionId };
}

export function clearAllLocalSessions() {
  localStorage.removeItem(STORAGE_KEY);
}

export function getLocalSession(sessionId) {
  const storedData = loadSessions();
  return (storedData.sessions || []).find(s => s.id === sessionId);
}

export function setActiveSessionIdLocal(sessionId) {
  const storedData = loadSessions();
  saveSessions({ ...storedData, activeSessionId: sessionId });
}