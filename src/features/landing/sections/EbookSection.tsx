import { Link } from "react-router-dom";
import {
  BookOpen,
  CheckCircle2,
  ClipboardList,
  FileUp,
  Gift,
  Lock,
  LockOpen,
  Sparkles,
  Star,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProfileCompletion } from "@/features/profile/use-profile-completion";

/**
 * Anuncio del ebook en la landing, apenas abajo del hero: el regalo por
 * completar el perfil al 100%.
 *
 * Diseño sobre la pieza gráfica del dueño: bloque CLARO crema (contrasta con
 * el hero oscuro de arriba — navy sobre navy se fundían), gancho "100% del
 * perfil completado", los 3 pasos concretos que desbloquean el regalo, y el
 * libro abierto (tapa + índice reales) con el sello dorado. Cierra una franja
 * navy con el recorrido completo. El CTA cambia con el estado del visitante
 * (mismo hook que el anillo del Hero); el gate real lo aplica GET /me/ebook.
 */
export default function EbookSection() {
  const completion = useProfileCompletion();

  const pasos = [
    { icono: FileUp, titulo: "Subí tu CV", detalle: "Completá tu información académica y laboral." },
    { icono: ClipboardList, titulo: "Completá tus datos", detalle: "Ingresá todos tus datos para potenciar tu perfil." },
    { icono: Video, titulo: "Grabá tu video", detalle: "Presentate en 30 segundos y contá tu experiencia." },
  ];

  const recorrido = [
    { icono: CheckCircle2, texto: "Completá tu perfil al 100%" },
    { icono: Gift, texto: "Accedé al e-book gratis" },
    { icono: BookOpen, texto: "Consejos prácticos para tu búsqueda" },
    { icono: Star, texto: "Potenciá tu perfil y destacate" },
  ];

  return (
    <section id="ebook" className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-stone-50 via-amber-50/60 to-stone-100 shadow-xl shadow-slate-900/10 ring-1 ring-slate-900/5">
        <div className="grid items-center gap-10 px-6 py-10 sm:px-12 sm:py-14 lg:grid-cols-2">
          <div>
            <p className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-400 to-amber-300 px-3.5 py-1.5 text-xs font-extrabold uppercase tracking-wide text-slate-900 shadow-sm">
              <Gift size={14} /> ¡Regalo exclusivo!
            </p>

            {/* Gancho: el 100% gigante, como en la pieza del dueño */}
            <div className="mt-4 flex items-end gap-2">
              <span className="text-6xl font-extrabold leading-none tracking-tight text-slate-900 sm:text-7xl">
                100%
              </span>
              <CheckCircle2 className="mb-1 text-amber-500" size={34} aria-hidden />
            </div>
            <p className="mt-1 text-sm font-extrabold uppercase tracking-widest text-slate-800 sm:text-base">
              del perfil completado
            </p>

            <h2 className="mt-4 max-w-md text-lg font-semibold leading-snug text-slate-700 sm:text-xl">
              Completá tu perfil al 100% y accedé <span className="font-extrabold text-amber-600">gratis</span> a
              nuestro e-book{" "}
              <span className="font-extrabold text-slate-900">
                Empleo MODO ON: de candidato a elegido
              </span>
              .
            </h2>

            {/* Los 3 pasos que desbloquean el regalo (espejan los hitos del perfil) */}
            <ul className="mt-6 space-y-4">
              {pasos.map((p) => (
                <li key={p.titulo} className="flex items-start gap-3.5">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-slate-900 text-amber-400">
                    <p.icono size={20} aria-hidden />
                  </span>
                  <div>
                    <p className="font-bold text-slate-900">{p.titulo}</p>
                    <p className="text-sm text-slate-600">{p.detalle}</p>
                  </div>
                </li>
              ))}
            </ul>

            {/* Estado del candado según el visitante */}
            <div className="mt-6 flex items-center gap-2.5 rounded-2xl bg-white/70 p-3 ring-1 ring-slate-900/10">
              {completion?.complete ? (
                <LockOpen size={18} className="shrink-0 text-amber-600" />
              ) : (
                <Lock size={18} data-testid="ebook-section-lock" className="shrink-0 text-slate-500" />
              )}
              <p className="text-xs text-slate-700 sm:text-sm">
                {completion === null &&
                  "Se desbloquea completando tu perfil al 100%. Crear tu cuenta es gratis."}
                {completion !== null && !completion.complete && (
                  <>
                    Se desbloquea con tu perfil al 100%.{" "}
                    <span className="font-bold text-amber-600">
                      Te falta el {100 - completion.percent}%.
                    </span>
                  </>
                )}
                {completion?.complete && "¡Tu perfil está al 100%! El e-book ya es tuyo."}
              </p>
            </div>

            <div className="mt-6">
              {completion === null && (
                <Button
                  className="w-full rounded-2xl bg-slate-900 font-bold text-amber-400 hover:bg-slate-800 sm:w-auto"
                  asChild
                >
                  <Link to="/login">
                    <Gift size={16} /> Crear mi cuenta gratis
                  </Link>
                </Button>
              )}
              {completion !== null && !completion.complete && (
                <Button
                  className="w-full rounded-2xl bg-slate-900 font-bold text-amber-400 hover:bg-slate-800 sm:w-auto"
                  asChild
                >
                  <Link to="/perfil">
                    <Sparkles size={16} /> Completar mi perfil
                  </Link>
                </Button>
              )}
              {completion?.complete && (
                <Button
                  className="w-full rounded-2xl bg-slate-900 font-bold text-amber-400 hover:bg-slate-800 sm:w-auto"
                  asChild
                >
                  <Link to="/ebook">
                    <BookOpen size={16} /> Leer el e-book
                  </Link>
                </Button>
              )}
            </div>
          </div>

          {/* Libro abierto: tapa + índice reales (páginas 1 y 2 del PDF →
              public/ebook-*.webp, regenerables con pdftoppm + sharp) con el
              sello "E-BOOK GRATIS" pisando ambas. Al hover se endereza. */}
          <div className="group relative mx-auto flex w-full max-w-md items-center justify-center py-4">
            <div className="relative z-10 w-44 rotate-[-6deg] rounded-xl shadow-2xl shadow-slate-900/40 ring-1 ring-slate-900/10 transition-transform duration-300 group-hover:rotate-[-2deg] sm:w-56">
              <img
                src="/ebook-tapa.webp"
                alt="Tapa del ebook Empleo MODO ON, de candidato a elegido"
                width={512}
                height={800}
                loading="lazy"
                className="block w-full rounded-xl"
              />
              {/* lomo del libro */}
              <div className="absolute inset-y-0 left-0 w-1.5 rounded-l-xl bg-white/20" />
            </div>
            <div className="relative -ml-6 w-40 rotate-[5deg] rounded-xl shadow-xl shadow-slate-900/30 ring-1 ring-slate-900/10 transition-transform duration-300 group-hover:rotate-[2deg] sm:w-52">
              <img
                src="/ebook-indice.webp"
                alt="Índice del ebook: 7 capítulos, del objetivo laboral a la negociación"
                width={512}
                height={800}
                loading="lazy"
                className="block w-full rounded-xl"
              />
            </div>
            {/* Sello dorado, pisando las dos páginas */}
            <div className="absolute z-20 flex size-24 -rotate-6 flex-col items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 text-center shadow-lg shadow-slate-900/30 ring-4 ring-white/80 transition-transform duration-300 group-hover:scale-105 sm:size-28">
              <Gift size={20} className="text-slate-900" aria-hidden />
              <span className="mt-0.5 max-w-16 text-[11px] font-extrabold uppercase leading-tight tracking-wide text-slate-900 sm:text-xs">
                E-book gratis
              </span>
            </div>
          </div>
        </div>

        {/* Franja navy de cierre: el recorrido completo, como en la pieza */}
        <div className="bg-slate-900 px-6 py-5 sm:px-12">
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {recorrido.map((r) => (
              <li key={r.texto} className="flex items-center gap-2.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-amber-400/15 text-amber-400">
                  <r.icono size={16} aria-hidden />
                </span>
                <p className="text-xs font-medium text-white/85 sm:text-sm">{r.texto}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
