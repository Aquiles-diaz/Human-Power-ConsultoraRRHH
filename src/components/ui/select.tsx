import * as React from "react"
import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

const Select = React.forwardRef<
  HTMLSelectElement,
  React.ComponentProps<"select"> & { variant?: "light" | "dark" }
>(({ className, variant = "light", children, ...props }, ref) => {
  return (
    <div className="relative">
      <select
        className={cn(
          "flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition-colors focus-visible:border-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40 disabled:cursor-not-allowed disabled:opacity-50 appearance-none pr-9",
          variant === "dark" &&
            "border-white/10 bg-white/5 text-white placeholder:text-white/40 [color-scheme:dark]",
          className
        )}
        ref={ref}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        size={15}
        className={cn(
          "pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400",
          variant === "dark" && "text-white/40"
        )}
      />
    </div>
  )
})
Select.displayName = "Select"

export { Select }
