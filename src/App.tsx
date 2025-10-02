// src/App.tsx
import React from "react";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import HumanPowerLanding from "./HumanPowerLanding";
import { useAuth } from "./hooks/useAuth";

const AdminPanel = React.lazy(() => import("./pages/AdminPanel"));

function RequireAuth() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/" replace />; // para usuarios comunes, quedate en Home
  return <Outlet />;
}

function RequireRole({ role }: { role: "admin" | "user" }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/" replace />;
  if (role === "admin" && user.role !== "admin") return <Navigate to="/" replace />;
  return <Outlet />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Home (con widget de auth embebido) */}
        <Route path="/" element={<HumanPowerLanding />} />

        {/* Área admin: requiere estar logueado y rol=admin */}
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
