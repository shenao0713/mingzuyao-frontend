import { marked } from "marked";

marked.setOptions({
  breaks: true,
  gfm: true
});

export default function MarkdownBlock({ content }) {
  return (
    <div
      className="markdown-block"
      dangerouslySetInnerHTML={{ __html: marked.parse(content || "") }}
    />
  );
}
