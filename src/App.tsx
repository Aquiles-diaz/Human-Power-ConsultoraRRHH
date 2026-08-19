// src/App.tsx
import React from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import LandingPage from "@/features/landing/LandingPage";
import { RequireAuth, RequireRole, LoadingScreen } from "@/app/guards";
import StorageNotice from "@/features/legal/StorageNotice";

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
const PrivacidadPage = React.lazy(() => import("@/features/legal/PrivacidadPage"));
const TerminosPage = React.lazy(() => import("@/features/legal/TerminosPage"));
const NotFound = React.lazy(() => import("@/features/landing/NotFound"));
// El visor del ebook carga pdf.js: lazy obligatorio para no engordar el bundle.
const EbookPage = React.lazy(() => import("@/features/ebook/EbookPage"));

// Cada vez que cambia la ruta, vuelve el scroll al tope: sin esto las páginas
// nuevas heredan la posición de scroll de la anterior.
// Excepción: moverse DENTRO de /ofertas (lista ↔ /ofertas/:id) no resetea.
// Ahí el scroll lo maneja la propia página: en desktop, handleSelect hace su
// scrollTo suave al elegir un aviso (select-scroll.ts); en mobile, el detalle
// a pantalla completa conserva el flujo natural. Entrar a /ofertas/:id por
// link directo o desde otra página sí cae acá (prev es null u otra ruta) y
// arranca arriba, como corresponde.
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
      <StorageNotice />
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
        <Route
          path="/privacidad"
          element={
            <React.Suspense fallback={<LoadingScreen />}>
              <PrivacidadPage />
            </React.Suspense>
          }
        />
        <Route
          path="/terminos"
          element={
            <React.Suspense fallback={<LoadingScreen />}>
              <TerminosPage />
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
          <Route
            path="/ebook"
            element={
              <React.Suspense fallback={<LoadingScreen />}>
                <EbookPage />
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
