import { cacheLife, cacheTag } from "next/cache";
import { readTags } from "@/lib/cache-tags";
import type { ClientLastDelivery, DeliveryRow } from "../domain/delivery-rules";
import { loadClientsLastDelivery, loadDeliveryRows } from "../infrastructure/delivery-repository";

/** Every delivery, newest day first; company-wide, filtered on the client. */
export async function listDeliveryRows(): Promise<DeliveryRow[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(...readTags("deliveryRows"));

  return loadDeliveryRows();
}

/** Each client with the date of its latest delivery: the input of the alerts tab. Same tags as the delivery rows. */
export async function listClientsLastDelivery(): Promise<ClientLastDelivery[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(...readTags("deliveryRows"));

  return loadClientsLastDelivery();
}
