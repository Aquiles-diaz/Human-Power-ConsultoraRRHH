// src/App.tsx
import React from "react";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import HumanPowerLanding from "./HumanPowerLanding";
import Ofertas from "@/pages/Ofertas";
import { useAuth } from "./hooks/AuthContext"; // ahora viene del context

const AdminPanel = React.lazy(() => import("./pages/AdminPanel"));

function LoadingScreen({ text = "Cargando sesión…" }: { text?: string }) {
  return <div className="p-6">{text}</div>;
}

function RequireAuth() {
  const { isAuthenticated, isInitialLoading } = useAuth();
  if (isInitialLoading) return <LoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/" replace />;
  return <Outlet />;
}

function RequireRole({ role }: { role: "admin" | "user" }) {
  const { user, isInitialLoading } = useAuth();
  console.log("DEBUG RUTA PROTEGIDA:", { role, user });
  if (isInitialLoading) return <LoadingScreen />;
  if (!user) return <Navigate to="/" replace />;
  if (role === "admin" && user.role !== "admin") return <Navigate to="/" replace />;
  return <Outlet />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HumanPowerLanding />} />
        <Route path="/ofertas" element={<Ofertas />} />

        <Route element={<RequireAuth />}>
          <Route element={<RequireRole role="admin" />}>
            <Route
              path="/admin"
              element={
                <React.Suspense fallback={<div className="p-6">Cargando…</div>}>
                  <AdminPanel />
                </React.Suspense>
              }
            />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
