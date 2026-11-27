import { currentDay } from "@/lib/current-day";
import { requireTurnsAccess } from "@/lib/session";
import { getTurnPage } from "@/modules/turns/application/turn-queries";
import { TurnsView } from "@/modules/turns/ui/turns-view";

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireTurnsAccess();
  const { fecha } = await searchParams;
  // Reading the day also opts the page into request time, so `now` below is the real clock.
  const today = await currentDay();
  const date = typeof fecha === "string" && ISO_DAY.test(fecha) && !Number.isNaN(Date.parse(`${fecha}T00:00:00Z`)) ? fecha : today;
  const { board, vehicles, defaultTimes } = await getTurnPage(date, new Date());
  return <TurnsView date={date} today={today} board={board} vehicles={vehicles} defaultTimes={defaultTimes} />;
}
