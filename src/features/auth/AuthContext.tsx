// src/context/AuthContext.tsx
import React, { createContext, useContext } from "react";
import { useProvideAuth } from "./useProvideAuth";

export type { User } from "./useProvideAuth";

type AuthContextShape = ReturnType<typeof useProvideAuth>;

const AuthContext = createContext<AuthContextShape | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const auth = useProvideAuth();
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

// useAuth (hook) convive con AuthProvider en este archivo a propósito; el aviso
// de fast-refresh no aplica a un contexto de auth global.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an <AuthProvider>");
  }
  return ctx;
}
