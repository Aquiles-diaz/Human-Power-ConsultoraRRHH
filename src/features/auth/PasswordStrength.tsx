// Medidor simple de fuerza de contraseña (para los formularios sobre fondo oscuro).
// passwordScore es un helper puro que convive con el componente por defecto.
// eslint-disable-next-line react-refresh/only-export-components
export function passwordScore(pw: string): number {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(s, 4); // 0..4
}

const LABELS = ["Muy débil", "Débil", "Aceptable", "Buena", "Fuerte"];
const COLORS = [
  "bg-red-500",
  "bg-orange-500",
  "bg-amber-500",
  "bg-lime-500",
  "bg-emerald-500",
];

export default function PasswordStrength({ value }: { value: string }) {
  if (!value) return null;
  const score = passwordScore(value);
  return (
    <div className="mt-1.5">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full ${i < score ? COLORS[score] : "bg-white/15"}`}
          />
        ))}
      </div>
      <p className="mt-1 text-xs text-white/50">Seguridad: {LABELS[score]}</p>
    </div>
  );
}
