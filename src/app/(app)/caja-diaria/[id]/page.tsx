import { notFound } from "next/navigation";
import { requireDailyCashAccess } from "@/lib/session";
import { getBoxSheet } from "@/modules/daily-cash/application/daily-cash-queries";
import { BoxSheetView } from "@/modules/daily-cash/ui/box-sheet-view";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireDailyCashAccess();
  const { id } = await params;
  if (!/^\d{1,9}$/.test(id)) notFound();
  const sheet = await getBoxSheet(Number(id));
  if (!sheet) notFound();
  return <BoxSheetView sheet={sheet} />;
}
