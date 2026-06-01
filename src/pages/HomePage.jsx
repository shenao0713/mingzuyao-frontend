import { Link } from "react-router-dom";

import PortalHeader from "../components/PortalHeader";
import { useAuth } from "../lib/auth";
import { buildLoginPath } from "../lib/routing";

const capabilities = [
  {
    icon: "📋",
    title: "智能知识问答",
    description: "支持多轮对话、图片输入与知识源切换，精准回答藏医药专业问题。"
  },
  {
    icon: "🔗",
    title: "知识图谱可视化",
    description: "药材、方剂、功效、症候的实体关系一图呈现，支持交互式探索。"
  },
  {
    icon: "📚",
    title: "专家知识库",
    description: "从文档上传、知识抽取到问答检索，构建完整的知识管理闭环。"
  }
];

const techSteps = [
  { icon: "📥", title: "知识获取", desc: "多源数据采集与文档导入" },
  { icon: "⚙️", title: "知识处理", desc: "实体抽取与关系构建" },
  { icon: "🗂️", title: "知识存储", desc: "图谱数据库与向量检索" },
  { icon: "💬", title: "智能问答", desc: "大模型驱动的可解释回答" }
];

const highlights = [
  { label: "藏药材", value: "500+" },
  { label: "经典方剂", value: "300+" },
  { label: "知识条目", value: "10000+" },
  { label: "关系类型", value: "50+" }
];

export default function HomePage() {
  const { user } = useAuth();
  const chatEntry = user ? "/chat" : buildLoginPath("/chat");

  return (
    <div className="page-shell page-shell--marketing">
      <PortalHeader variant="marketing" />

      <main className="marketing-page">
        {/* Hero Section */}
        <section className="marketing-hero">
          <div className="marketing-hero__content">
            <span className="eyebrow">民族药智慧服务平台</span>
            <h1>智答藏药</h1>
            <p>
              以藏医药为切入点，融合知识图谱与大语言模型，构建兼具专业深度与交互体验的智能问答平台。
            </p>
            <div className="marketing-hero__actions">
              <Link to="/portal" className="primary-button">
                进入系统门户
              </Link>
              <Link to={chatEntry} className="secondary-button">
                体验智能问答
              </Link>
            </div>
          </div>

          <aside className="marketing-hero__panel">
            <div className="hero-orb" />
            <div className="hero-stats">
              {highlights.map((item) => (
                <article key={item.label} className="stat-card">
                  <strong>{item.value}</strong>
                  <span>{item.label}</span>
                </article>
              ))}
            </div>
          </aside>
        </section>

        {/* Team Section */}
        <section className="marketing-section">
          <div className="marketing-section__header">
            <span className="eyebrow">研发团队</span>
            <h2>华中科技大学先进制造与智能实验室</h2>
            <p>
               专注于医工交叉与知识工程领域多年，致力于用人工智能技术传承与创新传统医学知识体系。
            </p>
          </div>
        </section>

        {/* Capabilities Section */}
        <section className="marketing-section">
          <div className="marketing-section__header">
            <span className="eyebrow">核心能力</span>
            <h2>三位一体的系统架构</h2>
          </div>
          <div className="marketing-grid marketing-grid--three">
            {capabilities.map((item) => (
              <article key={item.title} className="capability-card">
                <div className="capability-card__icon">{item.icon}</div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Why Section */}
        <section className="marketing-section marketing-section--highlight">
          <div className="highlight-card">
            <span className="eyebrow">为什么选择藏医药</span>
            <h2>传统医学的数字化新生</h2>
            <p>
              藏医药知识体系蕴含丰富的药材、方剂、功效与症候关联信息，是知识图谱与智能问答的理想应用场景。
              我们以藏医药为切入点，探索民族医药知识数字化传承的创新路径。
            </p>
            <div className="highlight-tags">
              <span className="tag">知识图谱</span>
              <span className="tag">大语言模型</span>
              <span className="tag">多模态交互</span>
              <span className="tag">知识工程</span>
            </div>
          </div>
        </section>

        {/* Tech Roadmap Section */}
        <section className="marketing-section">
          <div className="marketing-section__header">
            <span className="eyebrow">技术路线</span>
            <h2>从知识构建到智能问答</h2>
          </div>
          <div className="tech-roadmap">
            {techSteps.map((step, index) => (
              <article key={step.title} className="roadmap-step">
                <div className="roadmap-step__icon">{step.icon}</div>
                <div className="roadmap-step__content">
                  <span className="roadmap-step__index">Step {index + 1}</span>
                  <h3>{step.title}</h3>
                  <p>{step.desc}</p>
                </div>
                {index < techSteps.length - 1 && <div className="roadmap-connector" />}
              </article>
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section className="cta-band">
          <div className="cta-band__content">
            <span className="eyebrow">开始体验</span>
            <h2>开启藏医药智能问答之旅</h2>
            <p>进入系统门户，体验完整的知识问答与图谱浏览功能。</p>
            <div className="cta-band__actions">
              <Link to="/portal" className="primary-button">
                打开系统门户
              </Link>
              <Link to={chatEntry} className="ghost-button">
                直接开始问答
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
