import type { Metadata } from "next";
import { listFleetPlates } from "@/modules/vehicles/application/vehicle-queries";
import { normalizePlateKey } from "@/modules/inspections/domain/inspection-links";
import { PreoperationalFlow } from "@/modules/inspections/ui/preoperational-form";

export const metadata: Metadata = {
  title: "Inspección preoperacional · Transportes El Imperio",
  description: "Formulario diario de inspección preoperacional del vehículo (FO-PESV-016).",
  // Open to anyone with the link, but not meant to be found through a search engine.
  robots: { index: false, follow: false },
};

/** Public on purpose (see `src/proxy.ts`): drivers fill it in from the phone without an account. */
export default async function Page() {
  // Plates only, written the way drivers type them: no driver data ever reaches this public page.
  const plates = (await listFleetPlates()).map(normalizePlateKey);
  return <PreoperationalFlow plates={plates} />;
}
