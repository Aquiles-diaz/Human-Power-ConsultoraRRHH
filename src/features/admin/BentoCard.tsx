import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// Tarjeta de la grilla bento del Resumen. Basada en FeatCard de VengeanceUI
// (agent-bento-grid), pero fija en oscuro con la paleta flat amarillo/negro del
// panel, y con `onClick` opcional: si se puede tocar, la tarjeta entera es el
// botón (su nombre accesible es el título + el contenido). `hero` la pinta de
// amarillo pleno con texto negro: es el dato principal de la grilla.
export function BentoCard({
  title,
  description,
  children,
  className,
  onClick,
  hero = false,
  index = 0,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hero?: boolean;
  index?: number;
}) {
  const shell = cn(
    "group relative flex flex-col gap-2 overflow-hidden rounded-[20px] p-4 text-left",
    hero ? "bg-yellow-400 text-black" : "bg-neutral-900 text-white",
    "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05),0_0_0_1px_rgba(255,255,255,0.06),0_2px_4px_rgba(0,0,0,0.2)]",
    onClick && "transition focus-visible:outline focus-visible:outline-2",
    onClick && (hero ? "hover:bg-yellow-300 focus-visible:outline-white" : "hover:bg-neutral-800/80 focus-visible:outline-yellow-400"),
    className,
  );
  const body = (
    <>
      <div className="z-10 flex flex-col gap-1">
        <h3 className={cn("text-sm font-semibold tracking-tight", hero ? "text-black" : "text-white")}>{title}</h3>
        {description && (
          <p className={cn("max-w-[95%] text-xs leading-relaxed", hero ? "text-black/60" : "text-white/50")}>{description}</p>
        )}
      </div>
      <div className="relative mt-2 w-full flex-1">{children}</div>
    </>
  );
  const anim = {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.45, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] as const },
  };
  return onClick ? (
    <motion.button type="button" onClick={onClick} className={shell} {...anim}>
      {body}
    </motion.button>
  ) : (
    <motion.div className={shell} {...anim}>
      {body}
    </motion.div>
  );
}
