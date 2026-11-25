import { requireCoteroPaymentsAccess } from "@/lib/session";
import {
  listFleetCandidates,
  listProfileRows,
  listReceiptRows,
  listSettlementRows,
  listTariffRows,
} from "@/modules/cotero-payments/application/cotero-queries";
import { CoteroPaymentsView } from "@/modules/cotero-payments/ui/cotero-payments-view";
import { todayInBogota } from "@/modules/shared/domain/dates";

export default async function Page() {
  await requireCoteroPaymentsAccess();
  const [receipts, settlements, tariffs, profiles, fleet] = await Promise.all([
    listReceiptRows(),
    listSettlementRows(),
    listTariffRows(),
    listProfileRows(),
    listFleetCandidates(),
  ]);
  return <CoteroPaymentsView receipts={receipts} settlements={settlements} tariffs={tariffs} profiles={profiles} fleet={fleet} today={todayInBogota()} />;
}
