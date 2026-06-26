import { useEffect, useId, useRef, useState } from "react";
import { MessageCircle, X, RotateCcw, Mail } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { FAQS, CONTACT_EMAIL } from "./faq-data";

type Turn = { role: "bot" | "user"; text: string };

const GREETING = "¡Hola! 👋 ¿En qué te ayudo? Elegí una pregunta de abajo.";
const TYPING_MS = 400;
const MAILTO = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Consulta desde la web")}`;

export default function FaqChatWidget() {
  const [open, setOpen] = useState(false);
  const [thread, setThread] = useState<Turn[]>([{ role: "bot", text: GREETING }]);
  const [typing, setTyping] = useState(false);
  const reduceMotion = useReducedMotion();
  const titleId = useId();
  const fabRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const wasOpen = useRef(false);

  // Foco al panel al abrir; al cerrar (sólo si estaba abierto, no en el mount
  // inicial) devolver el foco al FAB. Esc cierra.
  useEffect(() => {
    if (open) {
      panelRef.current?.focus();
      wasOpen.current = true;
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") setOpen(false);
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }
    if (wasOpen.current) {
      fabRef.current?.focus();
      wasOpen.current = false;
    }
  }, [open]);

  // Auto-scroll al final del hilo.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [thread, typing]);

  // Limpia timer pendiente al desmontar.
  useEffect(() => () => clearTimeout(timer.current), []);

  // Implementado en Task 3.
  function ask(_faqId: string) {}

  // Implementado en Task 3.
  function reset() {
    setThread([{ role: "bot", text: GREETING }]);
  }

  return (
    <>
      {open && (
        <motion.div
          ref={panelRef}
          role="dialog"
          aria-labelledby={titleId}
          tabIndex={-1}
          initial={reduceMotion ? false : { opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="fixed bottom-24 right-4 z-50 flex h-[70vh] max-h-[560px] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl sm:right-6"
        >
          <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-full bg-gradient-to-r from-amber-400 to-amber-500 text-black">
                <MessageCircle className="size-4" />
              </span>
              <p id={titleId} className="text-sm font-semibold text-slate-900">
                Ayuda · Human Power
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={reset}
                aria-label="Reiniciar conversación"
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40"
              >
                <RotateCcw className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40"
              >
                <X className="size-4" />
              </button>
            </div>
          </header>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {thread.map((turn, i) => (
              <div key={i} className={cn("flex", turn.role === "user" ? "justify-end" : "justify-start")}>
                <p
                  className={cn(
                    "max-w-[85%] whitespace-pre-line rounded-2xl px-3 py-2 text-sm",
                    turn.role === "user" ? "bg-amber-100 text-slate-900" : "bg-slate-100 text-slate-700",
                  )}
                >
                  {turn.text}
                </p>
              </div>
            ))}
            {typing && (
              <div className="flex justify-start">
                <p className="rounded-2xl bg-slate-100 px-3 py-2 text-sm text-slate-400" aria-live="polite">
                  escribiendo…
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 border-t border-slate-100 px-4 py-3">
            {FAQS.map((faq) => (
              <button
                key={faq.id}
                type="button"
                onClick={() => ask(faq.id)}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40"
              >
                {faq.q}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-slate-100 bg-slate-50 px-4 py-2.5 text-xs">
            <span className="text-slate-500">¿Otra consulta?</span>
            <a
              href={MAILTO}
              className="inline-flex items-center gap-1.5 font-medium text-amber-700 hover:text-amber-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40"
            >
              <Mail className="size-3.5" /> Escribinos
            </a>
          </div>
        </motion.div>
      )}

      <button
        ref={fabRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Cerrar ayuda" : "Abrir ayuda"}
        aria-expanded={open}
        className="fixed bottom-4 right-4 z-50 flex size-14 items-center justify-center rounded-full bg-gradient-to-r from-amber-400 to-amber-500 text-black shadow-lg shadow-amber-500/30 transition-all hover:shadow-xl hover:shadow-amber-500/50 hover:brightness-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40 sm:right-6"
      >
        {open ? <X className="size-6" /> : <MessageCircle className="size-6" />}
      </button>
    </>
  );
}
