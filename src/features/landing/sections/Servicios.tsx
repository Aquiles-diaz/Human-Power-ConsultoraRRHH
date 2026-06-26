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
        <p className="t-eyebrow">
          Servicios en Recursos Humanos
        </p>
        <h2 className="t-h2 mt-3 leading-tight max-w-2xl mx-auto">
          Asesoría de punta a punta para tu organización
        </h2>
      </div>

      <motion.div
        className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
        variants={staggerContainer}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.15 }}
      >
        <motion.div variants={fadeUp} className="h-full">
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
              <CheckList
                className="mt-3"
                items={[
                  "Identificación precisa de necesidades.",
                  "Creación de herramientas a medida.",
                  "Asesoramiento para una delegación efectiva.",
                  "Aumento de la rentabilidad y productividad.",
                ]}
              />
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={fadeUp} className="h-full">
          <Card className={cardClass}>
            <CardHeader>
              <span className={iconBadge}>
                <UserSearch size={22} />
              </span>
              <CardTitle className="mt-3">Búsqueda y selección</CardTitle>
            </CardHeader>
            <CardContent>
              <CheckList
                items={[
                  "Identificación de necesidades y perfil del puesto.",
                  "Publicación de avisos y hunting/reclutamiento en redes.",
                  "Evaluación de CVs, preselección e entrevista con candidato.",
                  "Presentación de candidatos para evaluación final.",
                ]}
              />

              {/* Sello de garantías — liviano (ámbar tenue) para no desbalancear la fila */}
              <div className="mt-5 space-y-2 rounded-2xl border border-amber-300 bg-amber-50 p-4">
                <div className="flex items-center gap-2.5 text-slate-700">
                  <Ban size={16} className="shrink-0 text-amber-500" />
                  <span className="text-sm">
                    <span className="font-extrabold text-amber-600">NO</span>{" "}
                    cobramos{" "}
                    <span className="font-semibold text-amber-600">anticipo</span>.
                  </span>
                </div>
                <div className="flex items-center gap-2.5 text-slate-700">
                  <Ban size={16} className="shrink-0 text-amber-500" />
                  <span className="text-sm">
                    <span className="font-extrabold text-amber-600">NO</span>{" "}
                    pedimos{" "}
                    <span className="font-semibold text-amber-600">
                      exclusividad
                    </span>
                    .
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={fadeUp} className="h-full">
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
              <CheckList
                className="mt-3"
                items={[
                  "Liquidación de nóminas.",
                  'Temas de HR "Hard": Legales y administrativos.',
                  'Temas de HR "Soft": Cultura y desarrollo.',
                  "Gestión de desvinculaciones con foco humano.",
                  "Negociación de acuerdos bajo marco legal.",
                ]}
              />
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </section>
  );
}

// Lista de ítems con check ámbar — estilo compartido por las tres cards de servicios.
function CheckList({
  items,
  className = "",
}: {
  items: string[];
  className?: string;
}) {
  return (
    <ul
      className={`space-y-2.5 text-sm leading-relaxed text-muted-foreground ${className}`.trim()}
    >
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2.5">
          <Check size={16} strokeWidth={3} className="mt-0.5 shrink-0 text-amber-500" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
