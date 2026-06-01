import { useState } from "react";
import MarkdownBlock from "./MarkdownBlock";
import AnswerDetailPanel from "./AnswerDetailPanel";

const DETAIL_SEPARATOR = "###DETAIL_SEPARATOR###";

function cleanContent(content) {
  if (!content) return "";
  const sepIndex = content.indexOf(DETAIL_SEPARATOR);
  if (sepIndex !== -1) {
    return content.substring(0, sepIndex).trim();
  }
  return content;
}

function extractThinkingChain(content) {
  const startTag = "<think>";
  const endTag = "</think>";

  const startIndex = content.indexOf(startTag);
  if (startIndex === -1) {
    return { thinking: null, mainContent: content };
  }

  const afterStartTag = content.slice(startIndex + startTag.length);
  const endIndex = afterStartTag.indexOf(endTag);
  if (endIndex === -1) {
    return { thinking: null, mainContent: content };
  }

  const thinking = afterStartTag.slice(0, endIndex).trim();
  const mainContent = content.slice(startIndex + startTag.length + endIndex + endTag.length).trim();

  return { thinking, mainContent };
}

function estimateThinkingTime(thinkingText) {
  const charCount = thinkingText.length;
  const secondsPerChar = 0.05;
  const seconds = Math.max(1, Math.round(charCount * secondsPerChar));
  return seconds;
}

export default function AssistantMessage({ content, detailData }) {
  const cleanContentStr = cleanContent(content || "");
  const { thinking, mainContent } = extractThinkingChain(cleanContentStr);
  const hasMainContent = mainContent && mainContent.trim().length > 0;
  const defaultExpanded = thinking && !hasMainContent;
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [detailExpanded, setDetailExpanded] = useState(false);

  const hasDetail = detailData && (
    (detailData.entities && detailData.entities.length > 0) ||
    (detailData.relationships && detailData.relationships.length > 0) ||
    (detailData.chunks && detailData.chunks.length > 0)
  );

  const thinkingBlock = thinking ? (
    <div className="thinking-chain">
      <button
        type="button"
        className="thinking-chain__summary"
        onClick={() => setExpanded(!expanded)}
      >
        <svg className="thinking-chain__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
        <span>已思考（用时{estimateThinkingTime(thinking)}秒）</span>
        <svg
          className="thinking-chain__arrow"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {expanded && (
        <div className="thinking-chain__content">
          <MarkdownBlock content={thinking} />
        </div>
      )}
    </div>
  ) : null;

  return (
    <div className="assistant-message">
      {thinkingBlock}
      {hasMainContent ? (
        <div className="assistant-message__content">
          <MarkdownBlock content={mainContent} />
        </div>
      ) : (thinking ? null : (
        <div className="assistant-message__content">
          <MarkdownBlock content={cleanContentStr} />
        </div>
      ))}
      {hasDetail && (
        <div className="assistant-message__detail">
          <button
            type="button"
            className="assistant-message__detail-toggle"
            onClick={() => setDetailExpanded(!detailExpanded)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4" />
              <path d="M12 8h.01" />
            </svg>
            <span>{detailExpanded ? "隐藏引用依据" : "查看引用依据"}</span>
            <span className="assistant-message__detail-count">
              ({detailData.entities?.length || 0} 实体, {detailData.relationships?.length || 0} 关系, {detailData.chunks?.length || 0} 片段)
            </span>
            <svg
              className="assistant-message__detail-arrow"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{ transform: detailExpanded ? "rotate(180deg)" : "rotate(0deg)" }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {detailExpanded && (
            <AnswerDetailPanel
              entities={detailData.entities || []}
              relationships={detailData.relationships || []}
              chunks={detailData.chunks || []}
              references={detailData.references || []}
              metadata={detailData.metadata || {}}
            />
          )}
        </div>
      )}
    </div>
  );
}
