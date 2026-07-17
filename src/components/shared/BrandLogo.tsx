// Lockup de marca: emblema + (opcional) wordmark legible.
// Usamos la versión blanca con fondo transparente (webp generado por
// scripts/optimize-images.mjs), que se apoya directo sobre el navbar oscuro
// sin disco blanco. 176px alcanza: se muestra a ~44px (88px en retina).
export function BrandLogo({
  imgClassName = "size-11",
  wordmark = true,
}: {
  imgClassName?: string;
  wordmark?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <img
        src="/logohumap-white-176.webp"
        alt="Human Power RRHH"
        loading="eager"
        className={`${imgClassName} shrink-0 object-contain`}
      />
      {wordmark && (
        <span className="hidden font-bold leading-none text-white sm:inline">
          <span className="text-lg">Human Power</span>
          <span className="ml-1 text-amber-400">| RRHH</span>
        </span>
      )}
    </span>
  );
}

export default BrandLogo;
