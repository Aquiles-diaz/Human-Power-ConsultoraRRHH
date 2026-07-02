import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { User, ShieldCheck, LogOut, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/AuthContext";
import AuthButtons from "./AuthButtons";

function initials(
  name?: string | null,
  last?: string | null,
  email?: string | null
) {
  const a = (name ?? "").trim()[0] ?? "";
  const b = (last ?? "").trim()[0] ?? "";
  const combo = (a + b).trim();
  return (combo || (email ?? "").trim()[0] || "?").toUpperCase();
}

/**
 * Área de cuenta del navbar.
 * - Sin sesión: ícono de ingreso que abre el modal de login/registro.
 * - Con sesión: avatar con iniciales + menú (Mi perfil, Panel admin, Salir).
 */
export default function UserMenu() {
  const { isAuthenticated, user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  // Escape cierra el panel y devuelve el foco al trigger (accesibilidad de teclado).
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (!isAuthenticated) {
    return <AuthButtons />;
  }

  const firstName = (user?.name || "").trim().split(" ")[0] || user?.email;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        ref={triggerRef}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="user-menu-panel"
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 py-1 pl-1 pr-2.5 text-white/90 transition-colors hover:border-amber-400/40 hover:bg-white/10"
      >
        <span className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-amber-400 to-amber-500 text-xs font-bold text-black">
          {initials(user?.name, user?.last_name, user?.email)}
        </span>
        <span className="hidden max-w-[120px] truncate text-sm font-medium sm:inline">
          ¡Hola, {firstName}!
        </span>
        <ChevronDown
          size={15}
          aria-hidden="true"
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          id="user-menu-panel"
          role="menu"
          className="absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white py-1 text-foreground shadow-lg"
        >
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="truncate text-sm font-semibold capitalize text-foreground">
              {user?.name} {user?.last_name}
            </p>
            <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
          </div>

          <Button
            asChild
            role="menuitem"
            variant="ghost"
            className="h-auto w-full justify-start gap-2.5 rounded-none px-4 py-2.5 text-sm font-normal hover:bg-amber-50 hover:text-amber-700"
          >
            <Link to="/perfil" onClick={() => setOpen(false)}>
              <User size={16} /> Mi perfil
            </Link>
          </Button>

          {user?.role === "admin" && (
            <Button
              asChild
              role="menuitem"
              variant="ghost"
              className="h-auto w-full justify-start gap-2.5 rounded-none px-4 py-2.5 text-sm font-normal hover:bg-amber-50 hover:text-amber-700"
            >
              <Link to="/admin" onClick={() => setOpen(false)}>
                <ShieldCheck size={16} /> Panel admin
              </Link>
            </Button>
          )}

          <Button
            role="menuitem"
            variant="ghost"
            onClick={() => {
              setOpen(false);
              logout();
            }}
            className="h-auto w-full justify-start gap-2.5 rounded-none border-t border-slate-100 px-4 py-2.5 text-sm font-normal text-red-600 hover:bg-red-50 hover:text-red-600"
          >
            <LogOut size={16} /> Cerrar sesión
          </Button>
        </div>
      )}
    </div>
  );
}
