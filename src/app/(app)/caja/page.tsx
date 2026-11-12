import { requirePettyCashAccess } from "@/lib/session";
import { todayInBogota } from "@/modules/shared/domain/dates";
import { listLedgerBalances, listReviewCounts } from "@/modules/petty-cash/application/petty-cash-queries";
import { PettyCashView } from "@/modules/petty-cash/ui/petty-cash-view";

export default async function Page() {
  await requirePettyCashAccess();
  const [balances, reviewCounts] = await Promise.all([listLedgerBalances(), listReviewCounts()]);
  return <PettyCashView balances={balances} reviewCounts={reviewCounts} today={todayInBogota()} />;
}
