// src/App.tsx
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LandingPage from "@/features/landing/LandingPage";
import OfertasPage from "@/features/jobs/OfertasPage";
import { RequireAuth, RequireRole, LoadingScreen } from "@/app/guards";

const AdminPanel = React.lazy(() => import("@/features/admin/AdminPanel"));
const AuthPage = React.lazy(() => import("@/features/auth/AuthPage"));
const ProfilePage = React.lazy(() => import("@/features/profile/ProfilePage"));
const ForgotPasswordPage = React.lazy(() => import("@/features/auth/ForgotPasswordPage"));
const ResetPasswordPage = React.lazy(() => import("@/features/auth/ResetPasswordPage"));
const VerifyEmailPage = React.lazy(() => import("@/features/auth/VerifyEmailPage"));

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/ofertas" element={<OfertasPage />} />
        <Route
          path="/login"
          element={
            <React.Suspense fallback={<LoadingScreen />}>
              <AuthPage />
            </React.Suspense>
          }
        />
        <Route
          path="/recuperar"
          element={
            <React.Suspense fallback={<LoadingScreen />}>
              <ForgotPasswordPage />
            </React.Suspense>
          }
        />
        <Route
          path="/reset-password"
          element={
            <React.Suspense fallback={<LoadingScreen />}>
              <ResetPasswordPage />
            </React.Suspense>
          }
        />
        <Route
          path="/verify-email"
          element={
            <React.Suspense fallback={<LoadingScreen />}>
              <VerifyEmailPage />
            </React.Suspense>
          }
        />

        <Route element={<RequireAuth />}>
          <Route
            path="/perfil"
            element={
              <React.Suspense fallback={<LoadingScreen />}>
                <ProfilePage />
              </React.Suspense>
            }
          />
          <Route element={<RequireRole role="admin" />}>
            <Route
              path="/admin"
              element={
                <React.Suspense fallback={<LoadingScreen />}>
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
