import { Fuel } from "lucide-react";
import { cn } from "@/lib/utils";
import { FUEL_OPTIONS } from "../domain/preoperational-inspection";

/** Reported fuel as typed; "Requiere tanqueo" gets an amber chip (icon + text) so the office spots it; "—" when unknown. */
export function FuelValue({ fuel, className }: { fuel: string | null; className?: string }) {
  const text = fuel?.trim();
  if (!text) return <span className={className}>—</span>;
  if (text !== FUEL_OPTIONS[0]) return <span className={className}>{text}</span>;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md bg-warn px-1.5 py-0.5 font-semibold text-warn-foreground", className)}>
      <Fuel className="size-3.5 shrink-0" aria-hidden />
      {text}
    </span>
  );
}
