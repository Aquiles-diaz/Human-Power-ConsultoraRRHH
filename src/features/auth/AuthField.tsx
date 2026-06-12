import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type AuthFieldProps = Omit<React.ComponentProps<typeof Input>, "id"> & {
  id: string;
  label: string;
  icon: React.ReactNode;
  hint?: string;
};

/**
 * Campo de formulario de auth: label + input con ícono a la izquierda y, si es
 * de tipo password, un botón para mostrar/ocultar. Usa el componente Input base
 * (bg-transparent) para que los overrides de tema del AuthPage oscuro sigan
 * aplicando sin conflictos.
 */
export default function AuthField({
  id,
  label,
  icon,
  hint,
  type = "text",
  className,
  ...props
}: AuthFieldProps) {
  const isPassword = type === "password";
  const [show, setShow] = useState(false);
  const inputType = isPassword ? (show ? "text" : "password") : type;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-amber-500">
          {icon}
        </span>
        <Input
          id={id}
          type={inputType}
          className={cn(
            "h-11 rounded-xl pl-10 transition-shadow focus-visible:ring-2 focus-visible:ring-amber-400/60",
            isPassword && "pr-10",
            className
          )}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-amber-500"
          >
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
