import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <section className="panel mx-auto max-w-lg">
      <div className="plate-head" data-tone="rose">
        <h1 className="micro-label text-foreground">Vehículo no encontrado</h1>
      </div>
      <div className="space-y-4 p-5">
        <p className="text-sm text-muted-foreground">
          No hay ningún vehículo con esa placa. Revisa que esté bien escrita o búscala en la flota.
        </p>
        <Link
          href="/flota"
          className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium underline decoration-primary decoration-2 underline-offset-4"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Volver a la flota
        </Link>
      </div>
    </section>
  );
}
