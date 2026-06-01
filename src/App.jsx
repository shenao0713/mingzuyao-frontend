import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import PortalHeader from "./components/PortalHeader";
import { useAuth } from "./lib/auth";
import { buildLoginPath, normalizeRedirectPath } from "./lib/routing";
import AuthPage from "./pages/AuthPage";
import ChatPage from "./pages/ChatPage";
import HomePage from "./pages/HomePage";
import KnowledgePage from "./pages/KnowledgePage";
import PortalPage from "./pages/PortalPage";

function LoadingScreen() {
  return (
    <div className="page-shell page-shell--workspace">
      <PortalHeader variant="minimal" />
      <main className="screen-state">
        <div className="screen-state__card">
          <div className="eyebrow">系统初始化</div>
          <h1>正在恢复演示环境</h1>
          <p>正在校验登录状态与本地演示数据，请稍候片刻。</p>
        </div>
      </main>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    const redirectPath = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={buildLoginPath(redirectPath)} replace />;
  }

  return children;
}

function PublicOnlyRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingScreen />;
  }

  if (user) {
    const params = new URLSearchParams(location.search);
    return <Navigate to={normalizeRedirectPath(params.get("redirect"))} replace />;
  }

  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/portal" element={<PortalPage />} />
      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <AuthPage />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/chat"
        element={
          <ProtectedRoute>
            <ChatPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/knowledge"
        element={
          <ProtectedRoute>
            <KnowledgePage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
