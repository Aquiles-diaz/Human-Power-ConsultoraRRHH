import React from "react";
import { Toaster } from "sonner";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { AuthProvider } from "@/features/auth/AuthContext";
import ErrorBoundary from "./ErrorBoundary";

// Si no hay Client ID de Google, no envolvemos con su provider (login Google off).
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

// Aviso temprano en dev si el valor está seteado pero mal formado (evita un
// "login con Google no anda" silencioso por una config incorrecta).
if (
  import.meta.env.DEV &&
  GOOGLE_CLIENT_ID &&
  !GOOGLE_CLIENT_ID.endsWith(".apps.googleusercontent.com")
) {
  console.warn(
    "[Auth] VITE_GOOGLE_CLIENT_ID no parece un Client ID de Google válido " +
      "(debería terminar en .apps.googleusercontent.com)."
  );
}

// Providers globales de la app (auth + Google + notificaciones).
export function AppProviders({ children }: { children: React.ReactNode }) {
  const tree = (
    <ErrorBoundary>
      <AuthProvider>
        {children}
        <Toaster richColors closeButton position="top-center" />
      </AuthProvider>
    </ErrorBoundary>
  );

  return GOOGLE_CLIENT_ID ? (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>{tree}</GoogleOAuthProvider>
  ) : (
    tree
  );
}
