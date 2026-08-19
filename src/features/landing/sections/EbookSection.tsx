import { Link } from "react-router-dom";
import { BookOpen, CheckCircle2, Lock, LockOpen, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProfileCompletion } from "@/features/profile/use-profile-completion";

/**
 * Anuncio del ebook en la landing: el regalo por completar el perfil al 100%.
 *
 * El CTA cambia con el estado del visitante (mismo hook que el anillo del
 * Hero): deslogueado → crear cuenta; logueado incompleto → candado con el %
 * que falta y CTA al perfil; al 100% → candado abierto y CTA al visor.
 * El gate real lo aplica el backend en GET /me/ebook.
 */
export default function EbookSection() {
  const completion = useProfileCompletion();

  return (
    <section id="ebook" className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <div className="relative overflow-hidden rounded-3xl bg-slate-900 px-6 py-10 sm:px-12 sm:py-14">
        {/* glow de marca, como CtaBanner */}
        <div
          aria-hidden
          className="pointer-events-none absolute -left-14 -top-14 h-64 w-64 rounded-full bg-amber-500/15 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-16 -right-10 h-56 w-56 rounded-full bg-amber-500/10 blur-3xl"
        />

        <div className="relative grid items-center gap-8 lg:grid-cols-2">
          {/* Tapa real del ebook (página 1 del PDF → public/ebook-tapa.webp,
              regenerable con pdftoppm + sharp; ver scripts/subir-ebook.py). */}
          <div className="mx-auto w-full max-w-xs">
            <div className="relative mx-auto w-56 rotate-[-3deg] rounded-2xl shadow-2xl shadow-black/50 ring-1 ring-white/10 transition-transform duration-300 hover:rotate-0 sm:w-64">
              <img
                src="/ebook-tapa.webp"
                alt="Tapa del ebook Empleo MODO ON, de candidato a elegido"
                width={512}
                height={800}
                loading="lazy"
                className="block w-full rounded-2xl"
              />
              {/* lomo del libro */}
              <div className="absolute inset-y-0 left-0 w-1.5 rounded-l-2xl bg-white/10" />
            </div>
          </div>

          <div>
            <p className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-300">
              <Sparkles size={13} /> Nuevo · Gratis para candidatos
            </p>
            <h2 className="t-h2 mt-3 text-white">
              Empleo MODO ON
              <span className="mt-1 block text-lg font-semibold text-white/70 sm:text-xl">
                De candidato a elegido
              </span>
            </h2>
            <p className="mt-2 max-w-md text-sm text-white/70 sm:text-base">
              La guía de nuestro equipo de RRHH: CV que genera entrevistas, LinkedIn,
              cómo responder en una entrevista y negociar tu propuesta.
            </p>

            <ul className="mt-4 space-y-2 text-sm text-white/80">
              {[
                "7 capítulos escritos por quienes seleccionan personal",
                "Del CV y LinkedIn hasta la negociación de la oferta",
                "Se lee online, desde tu cuenta, cuando quieras",
              ].map((b) => (
                <li key={b} className="flex items-start gap-2">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-amber-400" />
                  {b}
                </li>
              ))}
            </ul>

            {/* La condición, siempre visible: se desbloquea con el perfil al 100%. */}
            <div className="mt-5 flex items-center gap-2.5 rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
              {completion?.complete ? (
                <LockOpen size={18} className="shrink-0 text-amber-400" />
              ) : (
                <Lock size={18} data-testid="ebook-section-lock" className="shrink-0 text-white/50" />
              )}
              <p className="text-xs text-white/70 sm:text-sm">
                {completion === null &&
                  "Se desbloquea completando tu perfil al 100%. Crear tu cuenta es gratis."}
                {completion !== null && !completion.complete && (
                  <>
                    Se desbloquea con tu perfil al 100%.{" "}
                    <span className="font-semibold text-amber-300">
                      Te falta el {100 - completion.percent}%.
                    </span>
                  </>
                )}
                {completion?.complete && "¡Tu perfil está al 100%! El ebook ya es tuyo."}
              </p>
            </div>

            <div className="mt-6">
              {completion === null && (
                <Button variant="brand" className="w-full rounded-2xl sm:w-auto" asChild>
                  <Link to="/login">Crear mi cuenta gratis</Link>
                </Button>
              )}
              {completion !== null && !completion.complete && (
                <Button variant="brand" className="w-full rounded-2xl sm:w-auto" asChild>
                  <Link to="/perfil">Completar mi perfil</Link>
                </Button>
              )}
              {completion?.complete && (
                <Button variant="brand" className="w-full rounded-2xl sm:w-auto" asChild>
                  <Link to="/ebook">
                    <BookOpen size={16} /> Leer el ebook
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
