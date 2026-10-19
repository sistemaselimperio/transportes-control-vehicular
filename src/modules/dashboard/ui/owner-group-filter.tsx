import Link from "next/link";
import { cn } from "@/lib/utils";
import type { OwnerGroup } from "../domain/dashboard-metrics";

const OPTIONS: Array<{ value: OwnerGroup | null; label: string }> = [
  { value: null, label: "Todos" },
  { value: "IMPERIO", label: "Transportes" },
  { value: "PAEZ", label: "Fabián Páez" },
  { value: "THIRD_PARTY", label: "Terceros" },
];

/** Server-rendered, shareable filter: plain links that set `?grupo=`. */
export function OwnerGroupFilter({ active }: { active: OwnerGroup | null }) {
  return (
    <nav aria-label="Filtrar por propietario" className="flex flex-wrap gap-2">
      {OPTIONS.map((o) => {
        const selected = o.value === active;
        return (
          <Link
            key={o.label}
            href={o.value ? `/?grupo=${o.value}` : "/"}
            aria-current={selected ? "true" : undefined}
            className={cn(
              "inline-flex min-h-10 items-center rounded-lg border px-3 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              selected
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-background hover:bg-muted",
            )}
          >
            {o.label}
          </Link>
        );
      })}
    </nav>
  );
}
