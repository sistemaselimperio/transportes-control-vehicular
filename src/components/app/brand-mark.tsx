import { cn } from "@/lib/utils";

/** The product mark: an amber tile holding a plate outline. Drawn, not an icon. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 32 32"
      className={cn("size-8 shrink-0", className)}
      fill="none"
    >
      <rect width="32" height="32" rx="8" fill="var(--primary)" />
      <rect
        x="5.5"
        y="10.5"
        width="21"
        height="11"
        rx="2"
        stroke="var(--primary-foreground)"
        strokeWidth="1.75"
      />
      <path
        d="M10 16h12"
        stroke="var(--primary-foreground)"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}
