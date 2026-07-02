// src/App.tsx
import React from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import LandingPage from "@/features/landing/LandingPage";
import { RequireAuth, RequireRole, LoadingScreen } from "@/app/guards";

// OfertasPage va lazy: sale del bundle inicial y solo se descarga al entrar a /ofertas.
// La landing queda eager por ser la entrada de "/".
const OfertasPage = React.lazy(() => import("@/features/jobs/OfertasPage"));
const AdminPanel = React.lazy(() => import("@/features/admin/AdminPanel"));
const AuthPage = React.lazy(() => import("@/features/auth/AuthPage"));
const ProfilePage = React.lazy(() => import("@/features/profile/ProfilePage"));
const ForgotPasswordPage = React.lazy(() => import("@/features/auth/ForgotPasswordPage"));
const ResetPasswordPage = React.lazy(() => import("@/features/auth/ResetPasswordPage"));
const VerifyEmailPage = React.lazy(() => import("@/features/auth/VerifyEmailPage"));
const AlertUnsubscribedPage = React.lazy(() => import("@/features/profile/AlertUnsubscribedPage"));
const NotFound = React.lazy(() => import("@/features/landing/NotFound"));

// Cada vez que cambia la ruta, vuelve el scroll al tope: sin esto las páginas
// nuevas heredan la posición de scroll de la anterior.
function ScrollToTop() {
  const { pathname } = useLocation();
  const prev = React.useRef<string | null>(null);
  React.useEffect(() => {
    const dentroDeOfertas =
      prev.current?.startsWith("/ofertas") && pathname.startsWith("/ofertas");
    prev.current = pathname;
    if (!dentroDeOfertas) window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route
          path="/ofertas/:jobId?"
          element={
            <React.Suspense fallback={<LoadingScreen />}>
              <OfertasPage />
            </React.Suspense>
          }
        />
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
        <Route
          path="/alertas/baja"
          element={
            <React.Suspense fallback={<LoadingScreen />}>
              <AlertUnsubscribedPage />
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

        <Route
          path="*"
          element={
            <React.Suspense fallback={<LoadingScreen />}>
              <NotFound />
            </React.Suspense>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
