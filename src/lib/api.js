const API_BASE = import.meta.env.VITE_API_BASE_URL || "";
const WS_BASE = import.meta.env.VITE_WS_BASE_URL || "";
const TOKEN_KEY = "tibetan_demo_token";
const USER_KEY = "tibetan_demo_user";
const DETAIL_SEPARATOR = "###DETAIL_SEPARATOR###";

function buildUrl(path) {
  const cleanPath = path.startsWith('/') ? path : '/' + path;
  if (API_BASE) {
    return `${API_BASE}${cleanPath}`;
  }
  return cleanPath;
}

export class APIError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = "APIError";
    this.status = status;
    this.data = data;
  }
}

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser() {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveStoredAuth(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearStoredAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

function authHeaders(auth, extraHeaders, isForm) {
  const headers = { ...extraHeaders };
  if (auth) {
    const token = getStoredToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }
  if (!isForm && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  return headers;
}

async function parseResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  return response.text();
}

export async function apiRequest(
  path,
  { method = "GET", body, auth = false, headers = {}, isForm = false } = {}
) {
  const response = await fetch(buildUrl(path), {
    method,
    headers: authHeaders(auth, headers, isForm),
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined
  });
  const data = await parseResponse(response);
  if (!response.ok) {
    const message =
      (typeof data === "object" && data?.detail) ||
      (typeof data === "string" && data) ||
      `请求失败 (${response.status})`;
    throw new APIError(message, response.status, data);
  }
  return data;
}

export async function streamText(path, body, onChunk, { auth = false, signal } = {}) {
  const response = await fetch(buildUrl(path), {
    method: "POST",
    headers: authHeaders(auth, {}, false),
    body: JSON.stringify(body),
    signal
  });

  if (!response.ok) {
    const data = await parseResponse(response);
    const message =
      (typeof data === "object" && data?.detail) ||
      (typeof data === "string" && data) ||
      `请求失败 (${response.status})`;
    throw new APIError(message, response.status, data);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let result = "";
  let done = false;

  while (!done) {
    const { value, done: readerDone } = await reader.read();
    done = readerDone;
    if (value) {
      const chunk = decoder.decode(value, { stream: true });
      result += chunk;
      if (onChunk) {
        onChunk(result);
      }
    }
  }

  return result;
}

export async function streamDetail(path, body, onChunk, { auth = false, signal } = {}) {
  const response = await fetch(buildUrl(path), {
    method: "POST",
    headers: authHeaders(auth, {}, false),
    body: JSON.stringify(body),
    signal
  });

  if (!response.ok) {
    const data = await parseResponse(response);
    const message =
      (typeof data === "object" && data?.detail) ||
      (typeof data === "string" && data) ||
      `请求失败 (${response.status})`;
    throw new APIError(message, response.status, data);
  }

  const contentType = response.headers.get("content-type") || "";
  const isStream = contentType.includes("text/plain");

  if (!isStream) {
    const text = await response.text();
    return { text, detail: null };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let fullText = "";
  let detailData = null;
  let buffer = "";
  let separatorFound = false;

  while (true) {
    const { value, done } = await reader.read();

    if (done && buffer.length > 0 && !separatorFound) {
      fullText = buffer;
      if (onChunk) {
        onChunk(fullText);
      }
      break;
    }

    if (done) {
      break;
    }

    if (!value || value.length === 0) continue;

    const chunk = decoder.decode(value, { stream: false });
    buffer += chunk;

    if (!separatorFound) {
      const sepIndex = buffer.indexOf(DETAIL_SEPARATOR);
      if (sepIndex !== -1) {
        separatorFound = true;
        const textPart = buffer.substring(0, sepIndex);
        fullText = textPart;
        if (onChunk) {
          onChunk(fullText);
        }

        // Read remaining data from stream
        while (true) {
          const { value: remainingValue, done: remainingDone } = await reader.read();
          if (remainingDone) break;
          if (remainingValue) {
            buffer += decoder.decode(remainingValue, { stream: false });
          }
        }

        const jsonPart = buffer.substring(sepIndex + DETAIL_SEPARATOR.length).trim();
        if (jsonPart) {
          try {
            const parsed = JSON.parse(jsonPart);
            if (parsed.type === "detail") {
              detailData = {
                entities: parsed.entities || [],
                relationships: parsed.relationships || [],
                chunks: parsed.chunks || [],
                references: parsed.references || [],
                metadata: parsed.metadata || {},
              };
            }
          } catch (e) {
          }
        }
        break;
      }
    }

    if (!separatorFound) {
      fullText += chunk;
      if (onChunk) {
        onChunk(fullText);
      }
    }
  }

  return { text: fullText, detail: detailData };
}
