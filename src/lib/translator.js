import { apiRequest } from "./api";

const TIBETAN_UNICODE_START = 0x0f00;
const TIBETAN_UNICODE_END = 0x0fff;

export function detectTibetan(text) {
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    if (charCode >= TIBETAN_UNICODE_START && charCode <= TIBETAN_UNICODE_END) {
      return true;
    }
  }
  return false;
}

export function detectLanguage(text) {
  if (detectTibetan(text)) {
    return "tibetan";
  }
  return "chinese";
}

export async function translateTibetanToChinese(text) {
  if (!text || !text.trim()) {
    return "";
  }

  const response = await apiRequest("/api/translate/tibetan-to-chinese", {
    method: "POST",
    auth: true,
    body: { text, direction: "tibetan_to_chinese" }
  });

  return response.translated_text || text;
}

export async function translateChineseToTibetan(text) {
  if (!text || !text.trim()) {
    return "";
  }

  const response = await apiRequest("/api/translate/chinese-to-tibetan", {
    method: "POST",
    auth: true,
    body: { text, direction: "chinese_to_tibetan" }
  });

  return response.translated_text || text;
}

export async function batchTranslate(texts, direction = "tibetan_to_chinese", maxConcurrent = 2) {
  if (!texts || texts.length === 0) {
    return [];
  }

  const response = await apiRequest("/api/translate/batch", {
    method: "POST",
    auth: true,
    body: { texts, direction, max_concurrent: maxConcurrent }
  });

  return response.translated_texts || texts;
}
