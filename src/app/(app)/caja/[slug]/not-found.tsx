import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <section className="space-y-4">
      <h1 className="page-title">Planilla no encontrada</h1>
      <p className="page-desc">Puede que el enlace sea incorrecto o que la planilla ya no exista.</p>
      <Link href="/caja" className={buttonVariants({ variant: "outline", className: "h-11 px-4 md:h-10" })}>
        Volver a caja
      </Link>
    </section>
  );
}
