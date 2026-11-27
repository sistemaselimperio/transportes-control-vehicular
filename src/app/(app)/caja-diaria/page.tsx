import { requireDailyCashAccess } from "@/lib/session";
import { listBoxFigures } from "@/modules/daily-cash/application/daily-cash-queries";
import { DailyCashView } from "@/modules/daily-cash/ui/daily-cash-view";
import { todayInBogota } from "@/modules/shared/domain/dates";

export default async function Page() {
  await requireDailyCashAccess();
  const boxes = await listBoxFigures();
  return <DailyCashView boxes={boxes} today={todayInBogota()} />;
}
