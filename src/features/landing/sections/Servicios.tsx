import { motion } from "framer-motion";
import { Target, UserSearch, ShieldCheck, Check, Ban } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fadeUp, staggerContainer } from "@/lib/motion";

const cardClass =
  "group rounded-3xl border-slate-200/70 shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-amber-500/10 hover:border-amber-300/60 h-full";

const iconBadge =
  "grid h-11 w-11 place-items-center rounded-2xl bg-slate-100 text-slate-700 transition-transform duration-300 group-hover:scale-110";

export default function Servicios() {
  return (
    <section
      id="servicios"
      className="scroll-mt-16 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 sm:py-24"
    >
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-500">
          Servicios en RRHH
        </p>
        <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight max-w-2xl mx-auto">
          Asesoría de punta a punta para tu organización
        </h2>
      </div>

      <motion.div
        className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
        variants={staggerContainer}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.15 }}
      >
        <motion.div variants={fadeUp}>
          <Card className={cardClass}>
            <CardHeader>
              <span className={iconBadge}>
                <Target size={22} />
              </span>
              <CardTitle className="mt-3">Objetivo</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Nos enfocamos en ser tu socio estratégico para potenciar el
                capital humano de tu organización a través de:
              </p>
              <ul className="list-disc pl-5 mt-3 space-y-1 text-sm text-muted-foreground">
                <li>Identificación precisa de necesidades.</li>
                <li>Creación de herramientas a medida.</li>
                <li>Asesoramiento para una delegación efectiva.</li>
                <li>Aumento de la rentabilidad y productividad.</li>
              </ul>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={fadeUp}>
          <Card className={cardClass}>
            <CardHeader>
              <span className={iconBadge}>
                <UserSearch size={22} />
              </span>
              <CardTitle className="mt-3">Búsqueda y selección</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground leading-relaxed">
              <ul className="space-y-2.5">
                {[
                  "Identificación de necesidades y perfil del puesto.",
                  "Publicación de avisos y hunting/reclutamiento en redes.",
                  "Evaluación de CVs, preselección e entrevista con candidato.",
                  "Presentación de candidatos para evaluación final.",
                ].map((paso) => (
                  <li key={paso} className="flex items-start gap-2.5">
                    <Check
                      size={16}
                      className="mt-0.5 shrink-0 text-amber-500"
                      strokeWidth={3}
                    />
                    <span>{paso}</span>
                  </li>
                ))}
              </ul>

              {/* Sello de garantías — el diferenciador de cara al cliente */}
              <div className="mt-5 space-y-2.5 rounded-2xl bg-slate-900 p-4 shadow-sm">
                <div className="flex items-center gap-2.5 text-white">
                  <Ban size={16} className="shrink-0 text-amber-400" />
                  <span className="text-sm">
                    <span className="font-extrabold text-amber-400">NO</span>{" "}
                    cobramos{" "}
                    <span className="font-semibold text-amber-400">anticipo</span>.
                  </span>
                </div>
                <div className="flex items-center gap-2.5 text-white">
                  <Ban size={16} className="shrink-0 text-amber-400" />
                  <span className="text-sm">
                    <span className="font-extrabold text-amber-400">NO</span>{" "}
                    pedimos{" "}
                    <span className="font-semibold text-amber-400">
                      exclusividad
                    </span>
                    .
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={fadeUp}>
          <Card className={cardClass}>
            <CardHeader>
              <span className={iconBadge}>
                <ShieldCheck size={22} />
              </span>
              <CardTitle className="mt-3">Asesoría integral</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Ofrecemos una consultoría 360° que abarca:
              </p>
              <ul className="list-disc pl-5 mt-3 space-y-1 text-sm text-muted-foreground">
                <li>Liquidación de nóminas.</li>
                <li>Temas de HR "Hard": Legales y administrativos.</li>
                <li>Temas de HR "Soft": Cultura y desarrollo.</li>
                <li>Gestión de desvinculaciones con foco humano.</li>
                <li>Negociación de acuerdos bajo marco legal.</li>
              </ul>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </section>
  );
}
