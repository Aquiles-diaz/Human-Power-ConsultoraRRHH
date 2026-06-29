import { useEffect, useId, useRef, useState } from "react";
import { MessageCircle, X, ChevronDown, Mail } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { FAQS, CONTACT_EMAIL } from "./faq-data";

const INTRO = "¿En qué te ayudo? Tocá una pregunta.";
const MAILTO = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Consulta desde la web")}`;

export default function FaqWidget() {
  const [open, setOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();
  const titleId = useId();
  const fabRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);

  // Foco al panel al abrir; al cerrar (sólo si estaba abierto) volver al FAB. Esc cierra.
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

  function toggle(id: string) {
    setOpenId((cur) => (cur === id ? null : id));
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
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Cerrar"
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40"
            >
              <X className="size-4" />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto px-3 py-3">
            <p className="px-1 pb-2 text-sm text-slate-500">{INTRO}</p>
            <ul className="space-y-1.5">
              {FAQS.map((faq) => {
                const expanded = openId === faq.id;
                const answerId = `faq-a-${faq.id}`;
                const questionId = `faq-q-${faq.id}`;
                return (
                  <li key={faq.id} className="rounded-xl border border-slate-200">
                    <button
                      type="button"
                      id={questionId}
                      onClick={() => toggle(faq.id)}
                      aria-expanded={expanded}
                      aria-controls={answerId}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-800 transition-colors hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40",
                        expanded && "text-amber-700",
                      )}
                    >
                      <span>{faq.q}</span>
                      <ChevronDown
                        className={cn(
                          "size-4 shrink-0 text-slate-400 transition-transform",
                          expanded && "rotate-180",
                        )}
                      />
                    </button>
                    {expanded && (
                      <motion.div
                        id={answerId}
                        role="region"
                        aria-labelledby={questionId}
                        initial={reduceMotion ? false : { height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="overflow-hidden"
                      >
                        <p className="whitespace-pre-line px-3 pb-3 text-sm leading-relaxed text-slate-600">
                          {faq.a}
                        </p>
                      </motion.div>
                    )}
                  </li>
                );
              })}
            </ul>
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
