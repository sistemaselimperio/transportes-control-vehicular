import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <section className="space-y-4">
      <h1 className="page-title">Parte diario no encontrado</h1>
      <p className="page-desc">Puede que el enlace sea incorrecto o que el parte ya no exista.</p>
      <Link href="/parte-diario" className={buttonVariants({ variant: "outline", className: "h-11 px-4 md:h-10" })}>
        Volver a parte diario
      </Link>
    </section>
  );
}
