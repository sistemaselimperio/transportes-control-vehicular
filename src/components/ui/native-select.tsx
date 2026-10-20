import * as React from "react"
import { cn } from "@/lib/utils"

/** Native <select>: best touch UX on phones, styled like <Input>. */
function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="native-select"
      className={cn(
        "h-10 w-full min-w-0 rounded-lg border border-input bg-card px-2.5 text-base transition-[color,border-color,box-shadow] duration-150 outline-none hover:border-brand/60 focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-primary/70 disabled:opacity-50 md:h-8 md:text-sm dark:bg-input/30",
        className
      )}
      {...props}
    />
  )
}

export { NativeSelect }
