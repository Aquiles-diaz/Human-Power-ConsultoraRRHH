import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, BookOpen, ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { useAuth } from "@/features/auth/AuthContext";
import { authFetch, SessionExpiredError } from "@/lib/api";
import { trackEbookVisto } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { loadEbookPdf, type PdfDocument } from "./pdf-lib";

type Estado =
  | { tipo: "cargando" }
  | { tipo: "bloqueado" }
  | { tipo: "no-disponible" }
  | { tipo: "error" }
  | { tipo: "listo"; pdf: PdfDocument };

/**
 * Visor del ebook de HumanPower: la recompensa por el perfil 100% completo.
 *
 * El PDF se pide autenticado y se renderiza página a página en un canvas con
 * pdf.js (import dinámico: no toca el bundle inicial). A propósito no hay
 * botón de descarga ni URL directa del archivo — la condición del negocio es
 * que el ebook se lea DENTRO de HumanPower. El gate real (perfil al 100%)
 * lo aplica el backend; acá solo se traducen sus respuestas.
 */
export default function EbookPage() {
  const { getAuthHeader } = useAuth();
  const [estado, setEstado] = useState<Estado>({ tipo: "cargando" });
  const [pagina, setPagina] = useState(1);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const cargar = useCallback(async () => {
    setEstado({ tipo: "cargando" });
    try {
      const res = await authFetch("/me/ebook", getAuthHeader());
      if (res.status === 403) return setEstado({ tipo: "bloqueado" });
      if (res.status === 404) return setEstado({ tipo: "no-disponible" });
      if (!res.ok) return setEstado({ tipo: "error" });
      const data = await res.arrayBuffer();
      const pdf = await loadEbookPdf(data);
      setPagina(1);
      setEstado({ tipo: "listo", pdf });
      trackEbookVisto();
    } catch (err) {
      if (err instanceof SessionExpiredError) return; // el guard redirige al login
      setEstado({ tipo: "error" });
    }
  }, [getAuthHeader]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  // Renderiza la página actual al canvas. El flag `vigente` descarta el render
  // viejo si el usuario pasa de página antes de que termine el anterior.
  useEffect(() => {
    if (estado.tipo !== "listo") return;
    let vigente = true;
    void (async () => {
      const page = await estado.pdf.getPage(pagina);
      const canvas = canvasRef.current;
      if (!vigente || !canvas) return;
      const base = page.getViewport({ scale: 1 });
      // Escala al ancho disponible; el DPR mantiene el texto nítido en mobile.
      const ancho = canvas.parentElement?.clientWidth || base.width;
      const dpr = window.devicePixelRatio || 1;
      const scale = (ancho / base.width) * dpr;
      const viewport = page.getViewport({ scale });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${viewport.width / dpr}px`;
      canvas.style.height = `${viewport.height / dpr}px`;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      await page.render({ canvasContext: ctx, viewport }).promise;
    })();
    return () => {
      vigente = false;
    };
  }, [estado, pagina]);

  const total = estado.tipo === "listo" ? estado.pdf.numPages : 0;

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link
            to="/perfil"
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
          >
            <ArrowLeft size={16} /> Mi perfil
          </Link>
          <h1 className="ml-auto flex items-center gap-2 text-sm font-bold text-slate-800 sm:text-base">
            <BookOpen size={18} className="text-amber-500" /> Ebook de HumanPower
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        {estado.tipo === "cargando" && (
          <p className="py-20 text-center text-sm text-slate-500">Preparando tu ebook…</p>
        )}

        {estado.tipo === "bloqueado" && (
          <Aviso
            icono={<Lock size={22} />}
            titulo="Completá tu perfil para desbloquear el ebook"
            detalle="El ebook de HumanPower es el regalo por llegar al 100%. Te falta poco."
          >
            <Link
              to="/perfil"
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-600"
            >
              Completar mi perfil <ChevronRight size={15} />
            </Link>
          </Aviso>
        )}

        {estado.tipo === "no-disponible" && (
          <Aviso
            icono={<BookOpen size={22} />}
            titulo="El ebook todavía no está disponible"
            detalle="Estamos preparándolo. Volvé a intentar en unos días."
          />
        )}

        {estado.tipo === "error" && (
          <Aviso
            icono={<BookOpen size={22} />}
            titulo="No pudimos cargar el ebook"
            detalle="Puede ser un problema momentáneo de conexión."
          >
            <button
              onClick={() => void cargar()}
              className="mt-4 inline-flex items-center rounded-full bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
            >
              Reintentar
            </button>
          </Aviso>
        )}

        {estado.tipo === "listo" && (
          <>
            <div
              className="overflow-hidden rounded-2xl bg-white shadow-sm"
              onContextMenu={(e) => e.preventDefault()}
            >
              <canvas ref={canvasRef} className="mx-auto block" />
            </div>
            <nav className="mt-4 flex items-center justify-center gap-4" aria-label="Páginas del ebook">
              <BotonPagina
                label="Anterior"
                disabled={pagina <= 1}
                onClick={() => setPagina((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft size={16} /> Anterior
              </BotonPagina>
              <span className="text-sm font-medium tabular-nums text-slate-600">
                {pagina} de {total}
              </span>
              <BotonPagina
                label="Siguiente"
                disabled={pagina >= total}
                onClick={() => setPagina((p) => Math.min(total, p + 1))}
              >
                Siguiente <ChevronRight size={16} />
              </BotonPagina>
            </nav>
          </>
        )}
      </main>
    </div>
  );
}

function Aviso({
  icono,
  titulo,
  detalle,
  children,
}: {
  icono: React.ReactNode;
  titulo: string;
  detalle: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-md rounded-3xl bg-white p-8 text-center shadow-sm">
      <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
        {icono}
      </div>
      <h2 className="mt-4 text-lg font-bold text-slate-900">{titulo}</h2>
      <p className="mt-1.5 text-sm text-slate-500">{detalle}</p>
      {children}
    </div>
  );
}

function BotonPagina({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition",
        disabled ? "cursor-default opacity-40" : "hover:bg-slate-50",
      )}
    >
      {children}
    </button>
  );
}
