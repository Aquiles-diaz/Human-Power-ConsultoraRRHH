import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";

export function LoadingScreen() {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-4 w-full max-w-md" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 pt-4">
          <Skeleton className="h-40 rounded-3xl" />
          <Skeleton className="h-40 rounded-3xl" />
          <Skeleton className="h-40 rounded-3xl" />
        </div>
      </div>
    </div>
  );
}

// Requiere sesión iniciada; si no, manda al login recordando a dónde quería ir.
export function RequireAuth() {
  const { isAuthenticated, isInitialLoading } = useAuth();
  const location = useLocation();
  if (isInitialLoading) return <LoadingScreen />;
  if (!isAuthenticated)
    return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}

// Requiere un rol específico; si no cumple, manda al login con el destino recordado
// (ahí se le explica que necesita una cuenta de administrador, sin rebote mudo).
export function RequireRole({ role }: { role: "admin" | "user" }) {
  const { user, isInitialLoading } = useAuth();
  const location = useLocation();
  if (isInitialLoading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (role === "admin" && user.role !== "admin")
    return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}
