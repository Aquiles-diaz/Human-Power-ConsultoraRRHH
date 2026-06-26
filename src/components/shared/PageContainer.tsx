import React from "react";

import { cn } from "@/lib/utils";

/** Single source of truth for the page-shell width and horizontal gutters. */
export const PAGE_SHELL = "mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8";

export function PageContainer({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn(PAGE_SHELL, className)} {...props} />;
}
