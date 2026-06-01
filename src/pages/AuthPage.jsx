import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import PortalHeader from "../components/PortalHeader";
import { useAuth } from "../lib/auth";
import { apiRequest } from "../lib/api";
import { normalizeRedirectPath } from "../lib/routing";

export default function AuthPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, setAuthenticated } = useAuth();
  const [tab, setTab] = useState("login");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [pending, setPending] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [registerForm, setRegisterForm] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: ""
  });
  const redirectTarget = normalizeRedirectPath(searchParams.get("redirect"));

  useEffect(() => {
    if (user) {
      navigate(redirectTarget, { replace: true });
    }
  }, [navigate, redirectTarget, user]);

  async function handleLogin(event) {
    event.preventDefault();
    setPending(true);
    setError("");
    setSuccess("");
    try {
      const data = await apiRequest("/auth/login", {
        method: "POST",
        body: loginForm
      });
      setAuthenticated(data.token, data.user);
      navigate(redirectTarget);
    } catch (apiError) {
      setError(apiError.message);
    } finally {
      setPending(false);
    }
  }

  async function handleRegister(event) {
    event.preventDefault();
    setPending(true);
    setError("");
    setSuccess("");

    if (registerForm.password !== registerForm.confirmPassword) {
      setPending(false);
      setError("两次输入的密码不一致");
      return;
    }

    try {
      const data = await apiRequest("/auth/register", {
        method: "POST",
        body: {
          username: registerForm.username,
          email: registerForm.email || null,
          password: registerForm.password
        }
      });
      setSuccess("注册成功，正在进入系统。");
      setAuthenticated(data.token, data.user);
      navigate(redirectTarget);
    } catch (apiError) {
      setError(apiError.message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="page-shell page-shell--auth">
      <PortalHeader variant="minimal" />
      <main className="auth-page">
        <section className="auth-stage">
          <section className="auth-panel">
            <div className="auth-panel__header">
              <span className="eyebrow">账号登录</span>
              <h2>登录「智答藏药」</h2>
              <p>登录后即可使用问答系统与知识库管理功能。</p>
            </div>

            <div className="auth-tabs">
              <button
                type="button"
                className={tab === "login" ? "tab-button active" : "tab-button"}
                onClick={() => setTab("login")}
              >
                登录
              </button>
              <button
                type="button"
                className={tab === "register" ? "tab-button active" : "tab-button"}
                onClick={() => setTab("register")}
              >
                注册
              </button>
            </div>

            {error ? <div className="message-banner message-banner--error">{error}</div> : null}
            {success ? <div className="message-banner message-banner--success">{success}</div> : null}

            {tab === "login" ? (
              <form className="auth-form" onSubmit={handleLogin}>
                <label className="field-group">
                  <span>用户名</span>
                  <input
                    value={loginForm.username}
                    onChange={(event) =>
                      setLoginForm((current) => ({ ...current, username: event.target.value }))
                    }
                    placeholder="请输入用户名"
                    autoComplete="username"
                  />
                </label>
                <label className="field-group">
                  <span>密码</span>
                  <input
                    type="password"
                    value={loginForm.password}
                    onChange={(event) =>
                      setLoginForm((current) => ({ ...current, password: event.target.value }))
                    }
                    placeholder="请输入密码"
                    autoComplete="current-password"
                  />
                </label>
                <button type="submit" className="primary-button primary-button--full" disabled={pending}>
                  {pending ? "登录中..." : "登录系统"}
                </button>
              </form>
            ) : (
              <form className="auth-form" onSubmit={handleRegister}>
                <label className="field-group">
                  <span>用户名</span>
                  <input
                    value={registerForm.username}
                    onChange={(event) =>
                      setRegisterForm((current) => ({ ...current, username: event.target.value }))
                    }
                    placeholder="至少 3 个字符"
                    autoComplete="username"
                  />
                </label>
                <label className="field-group">
                  <span>邮箱</span>
                  <input
                    value={registerForm.email}
                    onChange={(event) =>
                      setRegisterForm((current) => ({ ...current, email: event.target.value }))
                    }
                    placeholder="选填"
                    autoComplete="email"
                  />
                </label>
                <label className="field-group">
                  <span>密码</span>
                  <input
                    type="password"
                    value={registerForm.password}
                    onChange={(event) =>
                      setRegisterForm((current) => ({ ...current, password: event.target.value }))
                    }
                    placeholder="至少 6 个字符"
                    autoComplete="new-password"
                  />
                </label>
                <label className="field-group">
                  <span>确认密码</span>
                  <input
                    type="password"
                    value={registerForm.confirmPassword}
                    onChange={(event) =>
                      setRegisterForm((current) => ({
                        ...current,
                        confirmPassword: event.target.value
                      }))
                    }
                    placeholder="请再次输入密码"
                    autoComplete="new-password"
                  />
                </label>
                <button type="submit" className="primary-button primary-button--full" disabled={pending}>
                  {pending ? "注册中..." : "注册并进入系统"}
                </button>
              </form>
            )}
          </section>
        </section>
      </main>
    </div>
  );
}
