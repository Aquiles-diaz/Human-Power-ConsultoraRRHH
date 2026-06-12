import React from "react";
import { Toaster } from "sonner";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { AuthProvider } from "@/features/auth/AuthContext";
import VerifyEmailBanner from "@/features/auth/VerifyEmailBanner";
import ErrorBoundary from "./ErrorBoundary";

// Si no hay Client ID de Google, no envolvemos con su provider (login Google off).
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

// Providers globales de la app (auth + Google + notificaciones).
export function AppProviders({ children }: { children: React.ReactNode }) {
  const tree = (
    <ErrorBoundary>
      <AuthProvider>
        <VerifyEmailBanner />
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
