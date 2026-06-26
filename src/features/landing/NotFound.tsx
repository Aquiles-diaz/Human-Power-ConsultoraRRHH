// src/features/landing/NotFound.tsx
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-neutral-950 px-4 text-center">
      <p className="text-sm font-medium uppercase tracking-widest text-amber-400">
        404
      </p>
      <h1 className="mt-3 text-2xl font-semibold text-white sm:text-3xl">
        Página no encontrada
      </h1>
      <p className="mt-3 max-w-md text-sm text-white/60">
        La página que buscás no existe o fue movida. Revisá la dirección o
        volvé al inicio.
      </p>
      <Button asChild variant="brand" size="lg" className="mt-8">
        <Link to="/">Volver al inicio</Link>
      </Button>
    </div>
  );
}
