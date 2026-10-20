import * as React from "react"
import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "min-h-16 w-full min-w-0 rounded-lg border border-input bg-card px-2.5 py-1.5 text-base transition-colors outline-none placeholder:text-muted-foreground hover:border-brand/60 focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-primary/70 disabled:opacity-50 md:text-sm dark:bg-input/30",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
