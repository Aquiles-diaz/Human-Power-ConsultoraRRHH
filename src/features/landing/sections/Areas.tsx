import { Link } from "react-router-dom";
import { motion, type Variants } from "framer-motion";
import { Flame } from "lucide-react";
import { CATEGORIES } from "@/features/jobs/categories";

// Variantes locales: entrada escalonada un poco más ágil y con un toque de escala,
// para que la grilla "respire" al aparecer sin volverse lenta con 16 tarjetas.
const gridVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04, delayChildren: 0.05 } },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.96 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.35, ease: "easeOut" } },
};

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
        variants={gridVariants}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.1 }}
      >
        {CATEGORIES.map((c) => {
          const Icon = c.Icon;
          return (
            <motion.div
              key={c.value}
              variants={cardVariants}
              whileHover={{ y: -5 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", stiffness: 350, damping: 22 }}
            >
              <Link
                to={`/ofertas?categoria=${c.value}`}
                className={`group relative flex h-full flex-col items-center gap-2.5 rounded-2xl border bg-white p-4 text-center transition-all duration-300 hover:shadow-lg hover:shadow-amber-500/10 ${
                  c.hot
                    ? "border-amber-300 shadow-sm hover:border-amber-400"
                    : "border-slate-200 hover:border-amber-300"
                }`}
              >
                {c.hot && (
                  <Flame
                    size={14}
                    className="absolute right-2.5 top-2.5 text-amber-500 motion-safe:animate-pulse"
                    aria-hidden
                  />
                )}
                <span
                  className={`grid size-11 place-items-center rounded-xl transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6 ${
                    c.hot ? "bg-amber-500 text-slate-900" : "bg-amber-100 text-amber-700"
                  }`}
                >
                  <Icon size={20} aria-hidden />
                </span>
                <span className="text-xs font-semibold leading-tight text-slate-800 transition-colors duration-300 group-hover:text-amber-600">
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
