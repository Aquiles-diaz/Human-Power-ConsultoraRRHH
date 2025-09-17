// src/App.tsx
import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import HumanPowerLanding from "./HumanPowerLanding";
const AdminPanel = React.lazy(() => import("./pages/AdminPanel"));

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HumanPowerLanding />} />
        <Route
          path="/admin"
          element={
            <React.Suspense fallback={<div className="p-6">Cargando…</div>}>
              <AdminPanel />
            </React.Suspense>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
