import React, { useEffect, useMemo, useState } from "react";
import {
  Download,
  RefreshCw,
  Search,
  ExternalLink,
  Video,
  Mail,
  Trash2,
  Filter,
} from "lucide-react";

const API = import.meta.env.VITE_API_URL || "http://localhost:10000";

type ResumeRow = {
  id: number;
  full_name: string;
  email: string;
  original_name: string;
  created_at: string;
  message?: string;
};

type Provider =
  | "youtube"
  | "tiktok"
  | "instagram"
  | "vimeo"
  | "drive"
  | "streamable"
  | "file";

type VideoInfo = { type: Provider; src: string } | null;

// --- utils ---
const truncate = (s = "", n = 60) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

/** Quita signos de puntuación comunes al final de una URL pegada en texto. */
function stripTrailingPunctuation(url: string) {
  return url.replace(/[)\].,;:]+$/g, "");
}

/** Busca el primer enlace HTTP/HTTPS en el texto. */
function extractFirstURL(text = ""): string | null {
  const match = text.match(/https?:\/\/[^\s)]+/i);
  return match ? stripTrailingPunctuation(match[0]) : null;
}

function toYouTubeEmbed(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return `https://www.youtube.com/embed/${v}`;
      const shorts = u.pathname.match(/\/shorts\/([^/?#]+)/);
      if (shorts?.[1]) return `https://www.youtube.com/embed/${shorts[1]}`;
    }
    if (u.hostname === "youtu.be") {
      const id = u.pathname.replace("/", "");
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
  } catch {}
  return null;
}

function toTikTokEmbed(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("tiktok.com")) {
      const m = u.pathname.match(/\/video\/(\d+)/);
      if (m?.[1]) return `https://www.tiktok.com/embed/v2/${m[1]}`;
    }
  } catch {}
  return null;
}

function toInstagramEmbed(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("instagram.com")) {
      const m = u.pathname.match(/^\/(p|reel|tv)\/([^\/?#]+)/);
      if (m?.[1] && m?.[2]) return `https://www.instagram.com/${m[1]}/${m[2]}/embed`;
    }
  } catch {}
  return null;
}

function toVimeoEmbed(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("vimeo.com")) {
      const m = u.pathname.match(/\/(\d+)/);
      if (m?.[1]) return `https://player.vimeo.com/video/${m[1]}`;
    }
  } catch {}
  return null;
}

function toDriveEmbed(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("drive.google.com")) {
      const m = u.pathname.match(/\/file\/d\/([^/]+)\//);
      if (m?.[1]) return `https://drive.google.com/file/d/${m[1]}/preview`;
    }
  } catch {}
  return null;
}

function toStreamableEmbed(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("streamable.com")) {
      const m = u.pathname.match(/\/([a-z0-9]+)$/i);
      if (m?.[1]) return `https://streamable.com/e/${m[1]}`;
    }
  } catch {}
  return null;
}

function getVideoFromMessage(message = ""): VideoInfo {
  const url = extractFirstURL(message);
  if (!url) return null;

  const yt = toYouTubeEmbed(url);
  if (yt) return { type: "youtube", src: yt };

  const tk = toTikTokEmbed(url);
  if (tk) return { type: "tiktok", src: tk };

  const ig = toInstagramEmbed(url);
  if (ig) return { type: "instagram", src: ig };

  const vm = toVimeoEmbed(url);
  if (vm) return { type: "vimeo", src: vm };

  const gd = toDriveEmbed(url);
  if (gd) return { type: "drive", src: gd };

  const st = toStreamableEmbed(url);
  if (st) return { type: "streamable", src: st };

  if (/\.(mp4|webm|ogg)(\?|$)/i.test(url)) return { type: "file", src: url };

  return null;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

function ymd(date?: Date) {
  const d = date ?? new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

// --- Componente principal ---
export default function AdminPanel() {
  const [password, setPassword] = useState(() => sessionStorage.getItem("hp_admin_pwd") || "");
  const [authed, setAuthed] = useState(false);
  const [cvs, setCvs] = useState<ResumeRow[]>([]);
  const [error, setError] = useState("");
  const [q, setQ] = useState(""); // búsqueda de texto opcional
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [active, setActive] = useState<ResumeRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  const headers = useMemo(() => ({ "X-Password": password }), [password]);

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/admin/cv`, { headers });
      if (!res.ok) {
        const msg = res.status === 401 ? "Contraseña incorrecta" : `Error ${res.status}`;
        throw new Error(msg);
      }
      const data = await res.json();
      setCvs(data.items || []);
      setAuthed(true);
      setError("");
      sessionStorage.setItem("hp_admin_pwd", password);
    } catch (e: any) {
      setError(e?.message || "Error");
      setAuthed(false);
    } finally {
      setLoading(false);
    }
  }

  // Carga automática si ya había contraseña en sesión
  useEffect(() => {
    if (password) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filtro por fecha + búsqueda opcional
  const filtered = useMemo(() => {
    const hasFrom = !!dateFrom;
    const hasTo = !!dateTo;

    const from = hasFrom ? new Date(`${dateFrom}T00:00:00`) : null;
    const to = hasTo ? new Date(`${dateTo}T23:59:59.999`) : null;

    const needle = q.trim().toLowerCase();

    return cvs.filter((r) => {
      const d = new Date(r.created_at);
      if (from && d < from) return false;
      if (to && d > to) return false;

      if (!needle) return true;

      return (
        (r.full_name || "").toLowerCase().includes(needle) ||
        (r.email || "").toLowerCase().includes(needle) ||
        (r.original_name || "").toLowerCase().includes(needle) ||
        (r.message || "").toLowerCase().includes(needle)
      );
    });
  }, [q, cvs, dateFrom, dateTo]);

  async function deleteCv(id: number) {
    if (!confirm("¿Seguro que querés eliminar este CV? Esta acción no se puede deshacer.")) return;
    try {
      setDeleting(id);
      const res = await fetch(`${API}/admin/cv/${id}`, {
        method: "DELETE",
        headers,
      });
      if (!res.ok) {
        const msg = res.status === 401 ? "Contraseña incorrecta" : `Error ${res.status}`;
        throw new Error(msg);
      }
      setCvs((prev) => prev.filter((cv) => cv.id !== id));
      if (active?.id === id) setActive(null);
    } catch (e: any) {
      alert(e?.message || "Error al eliminar");
    } finally {
      setDeleting(null);
    }
  }

  function clearFilters() {
    setDateFrom("");
    setDateTo("");
    setQ("");
  }

  if (!authed) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="bg-white p-6 rounded-2xl shadow-lg w-full max-w-sm">
          <h1 className="text-xl font-bold mb-1">Panel Admin</h1>
          <p className="text-sm text-gray-500 mb-4">Ingresá la contraseña para ver los CVs.</p>
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadData()}
            className="w-full border rounded-lg px-3 py-2 mb-3"
            autoFocus
            aria-label="Contraseña"
          />
          <button
            onClick={loadData}
            className="w-full rounded-lg bg-amber-500 hover:bg-amber-600 text-white py-2 font-medium disabled:opacity-60"
            disabled={loading || !password}
            aria-busy={loading}
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
          {error && (
            <p className="mt-3 text-red-600 text-sm" aria-live="polite">
              {error}
            </p>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-5">
        <div className="flex items-center gap-2">
          <span className="text-2xl" aria-hidden>
            📁
          </span>
          <h1 className="text-2xl font-bold">CVs recibidos</h1>
          <span className="text-sm text-gray-500 ml-2">({filtered.length})</span>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          {/* Filtros por fecha */}
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1 text-gray-600">
              <Filter className="size-4" /> Fecha:
            </span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-2 rounded-lg border bg-white w-full sm:w-auto"
              aria-label="Desde"
              placeholder={ymd()}
            />
            <span className="text-gray-500">→</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-2 rounded-lg border bg-white w-full sm:w-auto"
              aria-label="Hasta"
              placeholder={ymd()}
            />
          </div>

          {/* Búsqueda opcional */}
          <label className="relative" aria-label="Buscar">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
            <input
              placeholder="Buscar texto…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-8 pr-3 py-2 rounded-lg border bg-white w-full sm:w-[220px]"
            />
          </label>

          <div className="flex gap-2">
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 bg-white hover:bg-gray-50"
              title="Limpiar filtros"
            >
              Limpiar
            </button>
            <button
              onClick={loadData}
              className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 bg-white hover:bg-gray-50 disabled:opacity-60"
              title="Actualizar"
              disabled={loading}
              aria-busy={loading}
            >
              <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
              <span>Actualizar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Lista en mobile (cards) */}
      <div className="grid gap-3 md:hidden">
        {filtered.length === 0 && (
          <div className="rounded-xl border bg-white p-6 text-center text-gray-500">
            Sin resultados.
          </div>
        )}

        {filtered.map((cv) => (
          <div key={cv.id} className="rounded-xl border bg-white p-4 shadow ring-1 ring-black/5">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm text-gray-500">ID {cv.id}</p>
                <h3 className="text-base font-semibold truncate">{cv.full_name}</h3>
                <a
                  href={`mailto:${cv.email}`}
                  className="text-blue-600 hover:underline inline-flex items-center gap-1 break-all"
                >
                  <Mail className="size-3.5" />
                  {cv.email}
                </a>
                <p className="text-sm text-gray-600 mt-1">{formatDate(cv.created_at)}</p>
              </div>
            </div>

            <div className="mt-2 text-sm text-gray-700">
              <span className="font-medium">Archivo:</span> {cv.original_name}
            </div>

            <div className="mt-2 text-sm text-gray-700">
              <span className="font-medium">Mensaje:</span>{" "}
              <span title={cv.message || ""}>{truncate(cv.message || "", 80)}</span>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <a
                href={`${API}/cv/${cv.id}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Download className="size-4" />
                Descargar
              </a>
              <button
                onClick={() => setActive(cv)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-white hover:bg-gray-50"
                title="Ver detalle"
              >
                <ExternalLink className="size-4" />
                Ver
              </button>
              <button
                onClick={() => deleteCv(cv.id)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white disabled:opacity-60"
                title="Eliminar"
                disabled={deleting === cv.id}
              >
                {deleting === cv.id ? (
                  <RefreshCw className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
                Eliminar
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Tabla en desktop */}
      <div className="overflow-x-auto hidden md:block">
        <table className="w-full border-collapse text-sm bg-white rounded-xl shadow ring-1 ring-black/5">
          <thead>
            <tr className="bg-gray-100/70">
              <th className="px-3 py-2 text-left font-semibold">ID</th>
              <th className="px-3 py-2 text-left font-semibold">Nombre</th>
              <th className="px-3 py-2 text-left font-semibold">Email</th>
              <th className="px-3 py-2 text-left font-semibold">Archivo</th>
              <th className="px-3 py-2 text-left font-semibold">Fecha</th>
              <th className="px-3 py-2 text-left font-semibold">Mensaje</th>
              <th className="px-3 py-2 text-center font-semibold">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((cv, idx) => (
              <tr key={cv.id} className={idx % 2 ? "bg-gray-50/60" : ""}>
                <td className="px-3 py-2">{cv.id}</td>
                <td className="px-3 py-2 capitalize">{cv.full_name}</td>
                <td className="px-3 py-2">
                  <a
                    href={`mailto:${cv.email}`}
                    className="text-blue-600 hover:underline inline-flex items-center gap-1"
                  >
                    <Mail className="size-3.5" />
                    {cv.email}
                  </a>
                </td>
                <td className="px-3 py-2">{cv.original_name}</td>
                <td className="px-3 py-2">{formatDate(cv.created_at)}</td>
                <td className="px-3 py-2 max-w-[320px]">
                  <span title={cv.message || ""} className="text-gray-700">
                    {truncate(cv.message || "", 80)}
                  </span>
                </td>
                <td className="px-3 py-2 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <a
                      href={`${API}/cv/${cv.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <Download className="size-4" />
                      Descargar
                    </a>
                    <button
                      onClick={() => setActive(cv)}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-white hover:bg-gray-50"
                      title="Ver detalle"
                    >
                      <ExternalLink className="size-4" />
                      Ver
                    </button>
                    <button
                      onClick={() => deleteCv(cv.id)}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white disabled:opacity-60"
                      title="Eliminar"
                      disabled={deleting === cv.id}
                    >
                      {deleting === cv.id ? (
                        <RefreshCw className="size-4 animate-spin" />
                      ) : (
                        <Trash2 className="size-4" />
                      )}
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-gray-500">
                  Sin resultados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Drawer/Modal de detalle */}
      {active && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => setActive(null)}
        >
          <div
            className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-xl p-5"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`Detalle del candidato #${active.id}`}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Detalle del candidato #{active.id}</h2>
              <button
                className="rounded-lg px-3 py-1.5 border hover:bg-gray-50"
                onClick={() => setActive(null)}
              >
                Cerrar
              </button>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <p>
                  <span className="font-medium">Nombre:</span> {active.full_name}
                </p>
                <p className="break-all">
                  <span className="font-medium">Email:</span>{" "}
                  <a className="text-blue-600 hover:underline" href={`mailto:${active.email}`}>
                    {active.email}
                  </a>
                </p>
                <p>
                  <span className="font-medium">Archivo:</span> {active.original_name}
                </p>
                <p>
                  <span className="font-medium">Fecha:</span> {formatDate(active.created_at)}
                </p>
                <div>
                  <p className="font-medium mb-1">Mensaje:</p>
                  <div className="rounded-lg border bg-gray-50 p-3 text-sm whitespace-pre-wrap break-words">
                    {active.message || "—"}
                  </div>
                </div>
              </div>

              {/* Video preview */}
              <div>
                <p className="font-medium mb-2 inline-flex items-center gap-2">
                  <Video className="size-5" /> Video
                </p>
                <VideoPreview message={active.message || ""} />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href={`${API}/cv/${active.id}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Download className="size-4" />
                Descargar CV
              </a>
              <a
                href={`mailto:${active.email}`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border bg-white hover:bg-gray-50"
              >
                <Mail className="size-4" />
                Escribir
              </a>
              <button
                onClick={() => deleteCv(active.id)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white disabled:opacity-60"
                disabled={deleting === active.id}
              >
                {deleting === active.id ? (
                  <RefreshCw className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// --- Componente de previsualización de video ---
function VideoPreview({ message }: { message: string }) {
  const v = getVideoFromMessage(message);

  if (!v) {
    return (
      <div className="rounded-xl border bg-gray-50 p-4 text-sm text-gray-600">
        No hay video. Si el mensaje incluye un link a YouTube, TikTok, Instagram, Vimeo,
        Drive, Streamable o un .mp4/.webm, lo mostramos acá.
      </div>
    );
  }

  if (v.type === "file") {
    return (
      <div className="rounded-xl overflow-hidden border">
        <video src={v.src} controls className="w-full h-auto" />
      </div>
    );
  }

  // Proveedores por iframe
  return (
    <div className="aspect-video rounded-xl overflow-hidden border">
      <iframe
        src={v.src}
        title="Video"
        className="w-full h-full"
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
}

/*
Sugerencia CSP (Content-Security-Policy) para iframes:
frame-src https://www.youtube.com https://player.vimeo.com https://www.tiktok.com https://www.instagram.com https://drive.google.com https://streamable.com;
*/
