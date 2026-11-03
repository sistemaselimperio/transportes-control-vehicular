import type { Metadata } from "next";
import { PreoperationalFlow } from "@/modules/inspections/ui/preoperational-form";

export const metadata: Metadata = {
  title: "Inspección preoperacional · Transportes El Imperio",
  description: "Formulario diario de inspección preoperacional del vehículo (FO-PESV-016).",
  // Open to anyone with the link, but not meant to be found through a search engine.
  robots: { index: false, follow: false },
};

/** Public on purpose (see `src/proxy.ts`): drivers fill it in from the phone without an account. */
export default function Page() {
  return <PreoperationalFlow />;
}
