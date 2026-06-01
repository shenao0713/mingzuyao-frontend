import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../lib/auth";
import { buildLoginPath } from "../lib/routing";

const MARKETING_NAV = [
  { to: "/", label: "项目首页", end: true },
  { to: "/portal", label: "系统门户" },
  { to: "/chat", label: "智能问答" },
  { to: "/knowledge", label: "知识库管理" }
];

const WORKSPACE_NAV = [
  { to: "/portal", label: "系统门户" },
  { to: "/chat", label: "问答系统" },
  { to: "/knowledge", label: "专家知识库" }
];

export default function PortalHeader({ variant = "auto" }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const resolvedVariant =
    variant === "auto"
      ? location.pathname === "/chat" || location.pathname === "/knowledge"
        ? "workspace"
        : "marketing"
      : variant;

  const currentPath = `${location.pathname}${location.search}${location.hash}`;
  const loginPath = buildLoginPath(currentPath === "/login" ? "/portal" : currentPath);
  const navItems = resolvedVariant === "workspace" ? WORKSPACE_NAV : MARKETING_NAV;
  const showSystemEntryButton = resolvedVariant !== "workspace" && location.pathname !== "/portal";

  function handleLogout() {
    logout();
    navigate("/portal");
  }

  return (
    <header className={`site-header site-header--${resolvedVariant}`}>
      <div className="site-header__brand">
        <Link to="/" className="brand-emblem">
          藏
        </Link>
        <div className="brand-copy">
          <div className="brand-copy__eyebrow">民族药系统演示</div>
          <Link to="/" className="brand-copy__title">
            智答藏药
          </Link>
        </div>
      </div>

      {resolvedVariant !== "minimal" ? (
        <nav className="site-header__nav">
          {navItems.map((item) => {
            const destination =
              !user && (item.to === "/chat" || item.to === "/knowledge")
                ? buildLoginPath(item.to)
                : item.to;

            return (
              <NavLink
                key={`${item.label}-${destination}`}
                to={destination}
                end={item.end}
                className="site-header__link"
              >
                {item.label}
              </NavLink>
            );
          })}
        </nav>
      ) : (
        <div className="site-header__minimal-nav">
          <Link to="/" className="text-button">
            项目首页
          </Link>
          <Link to="/portal" className="text-button">
            系统门户
          </Link>
        </div>
      )}

      <div className="site-header__actions">
        {user ? (
          <div className="header-cluster">
            <div className="account-badge">
              <span>当前账号</span>
              <strong>{user.username}</strong>
            </div>
            {showSystemEntryButton ? (
              <Link to="/portal" className="secondary-button">
                进入系统
              </Link>
            ) : null}
            <button type="button" className="ghost-button" onClick={handleLogout}>
              退出登录
            </button>
          </div>
        ) : (
          <div className="header-cluster">
            {resolvedVariant === "marketing" ? (
              <Link to="/portal" className="ghost-button">
                系统门户
              </Link>
            ) : null}
            <Link to={loginPath} className="primary-button">
              登录 / 注册
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
