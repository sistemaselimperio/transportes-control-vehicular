import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <section className="space-y-4">
      <h1 className="page-title">Inspección no encontrada</h1>
      <p className="page-desc">Puede que el enlace sea incorrecto o que la inspección ya no exista.</p>
      <Link href="/preoperacionales" className={buttonVariants({ variant: "outline", className: "h-11 px-4 md:h-10" })}>
        Volver a preoperacionales
      </Link>
    </section>
  );
}
