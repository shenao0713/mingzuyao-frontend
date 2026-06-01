import { createContext, useContext, useEffect, useState } from "react";

import { apiRequest, clearStoredAuth, getStoredToken, getStoredUser, saveStoredAuth } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getStoredUser());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function restoreUser() {
      const token = getStoredToken();
      if (!token) {
        if (mounted) {
          setUser(null);
          setLoading(false);
        }
        return;
      }

      try {
        const data = await apiRequest("/auth/me", { auth: true });
        if (mounted) {
          setUser(data.user);
        }
      } catch {
        clearStoredAuth();
        if (mounted) {
          setUser(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    restoreUser();
    return () => {
      mounted = false;
    };
  }, []);

  async function refreshUser() {
    const data = await apiRequest("/auth/me", { auth: true });
    setUser(data.user);
    return data.user;
  }

  function setAuthenticated(token, nextUser) {
    saveStoredAuth(token, nextUser);
    setUser(nextUser);
  }

  function logout() {
    clearStoredAuth();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, refreshUser, setAuthenticated, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
