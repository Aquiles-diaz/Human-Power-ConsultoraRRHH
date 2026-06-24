import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  MapPin,
  ArrowRight,
  Building2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/features/auth/AuthContext";
// Los puestos vienen de la API (GET /jobs): cualquier puesto publicado desde el
// panel admin aparece automáticamente en este carrusel y en la página de Ofertas.
// useJobs comparte cache con /ofertas (stale-while-revalidate): si ya se cargaron
// una vez, el carrusel aparece al instante sin re-pegarle a la API.
import { useJobs } from "@/features/jobs/use-jobs";

const cardClass =
  "group rounded-3xl border-slate-200/70 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-amber-500/10 hover:border-amber-300/60 h-full";

const applyBtn =
  "rounded-2xl mt-2 w-full border-amber-300 text-amber-700 transition-colors group-hover:bg-amber-500 group-hover:text-black group-hover:border-amber-500";

export default function OfertasPreview() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(true);
  const pausedRef = useRef(false);
  const { jobs, loading } = useJobs();

  const updateState = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanPrev(scrollLeft > 8);
    setCanNext(scrollLeft < scrollWidth - clientWidth - 8);

    const cards = Array.from(el.children) as HTMLElement[];
    let idx = 0;
    let min = Infinity;
    cards.forEach((c, i) => {
      const d = Math.abs(c.offsetLeft - scrollLeft);
      if (d < min) {
        min = d;
        idx = i;
      }
    });
    setActive(idx);
  }, []);

  useEffect(() => {
    updateState();
    const el = trackRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateState, { passive: true });
    window.addEventListener("resize", updateState);
    return () => {
      el.removeEventListener("scroll", updateState);
      window.removeEventListener("resize", updateState);
    };
  }, [updateState, jobs]);

  const scrollToIndex = useCallback((i: number) => {
    const el = trackRef.current;
    if (!el) return;
    const card = el.children[i] as HTMLElement | undefined;
    if (card) el.scrollTo({ left: card.offsetLeft, behavior: "smooth" });
  }, []);

  const step = useCallback(
    (dir: number) => {
      const next = Math.min(jobs.length - 1, Math.max(0, active + dir));
      scrollToIndex(next);
    },
    [active, scrollToIndex, jobs.length]
  );

  // Autoplay: avanza solo, hace loop y se pausa al interactuar / hover.
  useEffect(() => {
    const id = setInterval(() => {
      if (pausedRef.current) return;
      const el = trackRef.current;
      if (!el) return;
      const atEnd = el.scrollLeft >= el.scrollWidth - el.clientWidth - 8;
      scrollToIndex(atEnd ? 0 : active + 1);
    }, 5000);
    return () => clearInterval(id);
  }, [active, scrollToIndex]);

  const pause = () => (pausedRef.current = true);
  const resume = () => (pausedRef.current = false);

  return (
    <section
      id="puestos"
      className="scroll-mt-16 bg-gradient-to-b from-white via-amber-50/30 to-white"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-500">
              Vacantes
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Ofertas laborales
            </h2>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
              Conocé las búsquedas que tenemos abiertas.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Flechas (desktop) */}
            {jobs.length > 1 && (
              <div className="hidden items-center gap-2 sm:flex">
                <CarouselArrow dir="prev" onClick={() => step(-1)} disabled={!canPrev} />
                <CarouselArrow dir="next" onClick={() => step(1)} disabled={!canNext} />
              </div>
            )}
            {isAdmin && (
              <Button variant="brand" className="w-fit rounded-2xl" asChild>
                <a href="/admin">Publicar un puesto</a>
              </Button>
            )}
          </div>
        </div>

        {jobs.length > 0 ? (
          <>
        {/* Carrusel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 0.5 }}
          className="relative mt-8"
          onMouseEnter={pause}
          onMouseLeave={resume}
          onPointerDown={pause}
          onFocusCapture={pause}
        >
          <div
            ref={trackRef}
            className="relative flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-2 sm:gap-6 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            aria-label="Ofertas laborales"
          >
            {jobs.map((j) => (
              <div
                key={j.id}
                className="w-[85%] shrink-0 snap-start sm:w-[calc((100%-1.5rem)/2)] lg:w-[calc((100%-3rem)/3)]"
              >
                <Card className={cardClass}>
                  <CardHeader>
                    <Badge className="mb-1 w-fit rounded-xl" variant="secondary">
                      {j.type}
                    </Badge>
                    <CardTitle className="text-lg">{j.title}</CardTitle>
                    <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Building2 size={14} className="text-slate-500" />
                      {j.company}
                    </p>
                  </CardHeader>
                  <CardContent className="grid gap-2 text-sm text-muted-foreground">
                    <div className="inline-flex items-center gap-2">
                      <MapPin size={16} className="text-slate-500" />
                      {j.location}
                    </div>
                    <Button variant="outline" className={applyBtn} asChild>
                      <a href="/ofertas">Postularme</a>
                    </Button>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>

          {/* Flechas flotantes (mobile) */}
          <div className="mt-4 flex items-center justify-between sm:hidden">
            <CarouselArrow dir="prev" onClick={() => step(-1)} disabled={!canPrev} />
            <CarouselArrow dir="next" onClick={() => step(1)} disabled={!canNext} />
          </div>
        </motion.div>

        {/* Dots */}
        <div className="mt-5 flex items-center justify-center gap-2">
          {jobs.map((j, i) => (
            <button
              key={j.id}
              onClick={() => {
                pause();
                scrollToIndex(i);
              }}
              aria-label={`Ir al puesto ${i + 1}`}
              className={`h-2 rounded-full transition-all ${
                active === i ? "w-6 bg-amber-500" : "w-2 bg-slate-300 hover:bg-slate-400"
              }`}
            />
          ))}
        </div>
          </>
        ) : (
          !loading && (
            <p className="mt-8 text-center text-sm text-muted-foreground">
              Pronto publicaremos nuevas búsquedas. Mientras tanto, podés dejarnos tu CV.
            </p>
          )
        )}

        {/* CTA ver todas */}
        <div className="mt-8 flex justify-center">
          <Button variant="brand" className="w-full rounded-2xl sm:w-fit" asChild>
            <a href="/ofertas" className="inline-flex items-center gap-2">
              Ver todas las ofertas <ArrowRight size={16} />
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}

function CarouselArrow({
  dir,
  onClick,
  disabled,
}: {
  dir: "prev" | "next";
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === "prev" ? "Anterior" : "Siguiente"}
      className="grid size-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition-all hover:border-amber-400 hover:text-amber-600 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {dir === "prev" ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
    </button>
  );
}
