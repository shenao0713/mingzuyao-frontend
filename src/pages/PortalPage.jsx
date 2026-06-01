import { Link } from "react-router-dom";

import PortalHeader from "../components/PortalHeader";
import { useAuth } from "../lib/auth";
import { buildLoginPath } from "../lib/routing";

const entryCards = [
  {
    title: "智能知识问答",
    description:
      "支持多轮对话、图片上传与会话恢复，精准回答藏医药专业问题。",
    tags: ["多模态输入", "多轮历史", "知识源切换"],
    path: "/chat",
    buttonLabel: "进入问答系统"
  },
  {
    title: "知识库管理",
    description:
      "支持知识库创建、文档导入、图谱可视化与专家问答，展示完整知识工程链路。",
    tags: ["文档导入", "图谱浏览", "专家问答"],
    path: "/knowledge",
    buttonLabel: "进入知识库管理"
  }
];

const supportCards = [
  {
    title: "演示顺序",
    description: "首页 → 门户 → 登录 → 问答 → 知识库"
  },
  {
    title: "演示账号",
    description: "demo_teacher / demo123456"
  },
  {
    title: "系统特性",
    description: "云端实时部署 · 大模型驱动 · 知识图谱联动"
  }
];

export default function PortalPage() {
  const { user } = useAuth();

  return (
    <div className="page-shell page-shell--marketing">
      <PortalHeader variant="marketing" />

      <main className="portal-page">
        <section className="portal-hero">
          <div className="portal-hero__copy">
            <span className="eyebrow">系统门户</span>
            <h1>智答藏药</h1>
            <p>
              从这里进入问答系统与知识库管理，体验完整的知识工程与智能问答链路。
            </p>
          </div>
          <div className="system-strip">
            <span>云端部署 · 实时可用</span>
            <span>大模型驱动 · 多模态交互</span>
            <span>{user ? `当前账号: ${user.username}` : "未登录"}</span>
          </div>
        </section>

        <section className="portal-entry-grid">
          {entryCards.map((item) => {
            const destination = user ? item.path : buildLoginPath(item.path);
            return (
              <article key={item.title} className="portal-entry-card">
                <div className="portal-entry-card__head">
                  <span className="eyebrow">核心模块</span>
                  <h2>{item.title}</h2>
                </div>
                <p>{item.description}</p>
                <div className="tag-row">
                  {item.tags.map((tag) => (
                    <span key={tag} className="tag">
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="portal-entry-card__footer">
                  <Link to={destination} className="primary-button">
                    {user ? item.buttonLabel : "登录后进入"}
                  </Link>
                </div>
              </article>
            );
          })}
        </section>

        <section className="portal-support-grid">
          {supportCards.map((item) => (
            <article key={item.title} className="support-card">
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
