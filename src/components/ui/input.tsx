import * as React from "react"

import { cn } from "@/lib/utils"

interface InputProps extends React.ComponentProps<"input"> {
  variant?: "light" | "dark"
}

const base =
  "flex h-10 w-full rounded-lg border px-3 py-2 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:border-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40 disabled:cursor-not-allowed disabled:opacity-50"
const light = "border-slate-200 bg-white text-slate-900 placeholder:text-slate-400"
const dark =
  "border-white/10 bg-white/5 text-white placeholder:text-white/40 [color-scheme:dark]"

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, variant = "light", ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(base, variant === "dark" ? dark : light, className)}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
