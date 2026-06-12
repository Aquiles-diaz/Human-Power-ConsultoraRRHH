import { Button } from "@/components/ui/button";

export default function CtaBanner() {
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-zinc-900 via-black to-zinc-900 px-6 py-10 sm:px-12 sm:py-12">
        {/* glow de marca */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 h-56 w-56 rounded-full bg-amber-500/30 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-10 bottom-0 h-48 w-48 rounded-full bg-orange-500/20 blur-3xl"
        />

        <div className="relative grid sm:grid-cols-2 gap-6 items-center">
          <div>
            <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              ¿Buscás cubrir una posición clave?
            </h3>
            <p className="mt-2 text-white/70 text-sm sm:text-base max-w-md">
              Contanos tu necesidad y te presentamos una terna en tiempo récord.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-end gap-3">
            <Button
              variant="brand"
              className="rounded-2xl w-full sm:w-auto"
              asChild
            >
              <a href="#contacto">Contactar ahora</a>
            </Button>
            <Button
              variant="outline"
              className="rounded-2xl border-white/30 bg-white/5 text-white hover:bg-white/15 hover:text-white backdrop-blur w-full sm:w-auto"
              asChild
            >
              <a href="#servicios">Ver servicios</a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
