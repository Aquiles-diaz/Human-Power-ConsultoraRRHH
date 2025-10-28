// src/context/AuthContext.tsx
import React, { createContext, useContext } from "react";
import { useProvideAuth } from "../hooks/useProvideAuth";

type AuthContextShape = ReturnType<typeof useProvideAuth>;

const AuthContext = createContext<AuthContextShape | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const auth = useProvideAuth();
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an <AuthProvider>");
  }
  return ctx;
}
