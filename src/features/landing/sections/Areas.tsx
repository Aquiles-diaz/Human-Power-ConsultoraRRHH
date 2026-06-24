// src/features/landing/sections/Areas.tsx
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Flame } from "lucide-react";
import { CATEGORIES } from "@/features/jobs/categories";
import { fadeUp, staggerContainer } from "@/lib/motion";

export default function Areas() {
  return (
    <section
      id="areas"
      className="scroll-mt-16 mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8"
    >
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-500">
          Áreas que manejamos
        </p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          Buscá por rubro
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
          Tocá un área y mirá las búsquedas abiertas. Las marcadas con llama son
          las más activas hoy.
        </p>
      </div>

      <motion.div
        className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4"
        variants={staggerContainer}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.1 }}
      >
        {CATEGORIES.map((c) => {
          const Icon = c.Icon;
          return (
            <motion.div key={c.value} variants={fadeUp}>
              <Link
                to={`/ofertas?categoria=${c.value}`}
                className={`group relative flex h-full flex-col items-center gap-2.5 rounded-2xl border bg-white p-4 text-center transition-all hover:-translate-y-1 hover:shadow-lg ${
                  c.hot ? "border-amber-300 shadow-sm" : "border-slate-200 hover:border-amber-300"
                }`}
              >
                {c.hot && (
                  <Flame
                    size={14}
                    className="absolute right-2.5 top-2.5 text-amber-500"
                    aria-hidden
                  />
                )}
                <span
                  className={`grid size-11 place-items-center rounded-xl transition-transform group-hover:scale-110 ${
                    c.hot ? "bg-amber-500 text-slate-900" : "bg-amber-100 text-amber-700"
                  }`}
                >
                  <Icon size={20} />
                </span>
                <span className="text-xs font-semibold leading-tight text-slate-800">
                  {c.label}
                </span>
              </Link>
            </motion.div>
          );
        })}
      </motion.div>
    </section>
  );
}
