import { createContext, useContext, useEffect, useState } from "react";
import api from "../services/api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    api
      .get("/auth/me")
      .then(({ data }) => {
        if (active) setUser(data.user);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function register(formData) {
    const { data } = await api.post("/auth/register", formData);
    setUser(data.user);
    return data;
  }

  async function login(formData) {
    const { data } = await api.post("/auth/login", formData);
    setUser(data.user);
    return data;
  }

  async function logout() {
    await api.post("/auth/logout");
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, register, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
}
