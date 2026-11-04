import type { Metadata } from "next";
import { listFleetPlates } from "@/modules/vehicles/application/vehicle-queries";
import { listDriverOptions } from "@/modules/drivers/application/driver-queries";
import { PreoperationalFlow } from "@/modules/inspections/ui/preoperational-form";

export const metadata: Metadata = {
  title: "Inspección preoperacional · Transportes El Imperio",
  description: "Formulario diario de inspección preoperacional del vehículo (FO-PESV-016).",
  // Open to anyone with the link, but not meant to be found through a search engine.
  robots: { index: false, follow: false },
};

/** Public on purpose (see `src/proxy.ts`): drivers fill it in from the phone without an account. */
export default async function Page() {
  // Plates and driver names only: no national id or other driver data ever reaches this public page.
  // Plates as stored ("ABC-123"); linking to the vehicle compares them without the hyphen.
  const [plates, drivers] = await Promise.all([listFleetPlates(), listDriverOptions()]);
  return <PreoperationalFlow plates={plates} drivers={drivers} />;
}
