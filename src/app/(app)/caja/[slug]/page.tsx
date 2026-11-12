import { notFound, permanentRedirect } from "next/navigation";
import { requirePettyCashAccess } from "@/lib/session";
import {
  getLedgerNumberById,
  getLedgerSheet,
  listOwnerOptions,
  listSuppliers,
  listVehicleOptions,
} from "@/modules/petty-cash/application/petty-cash-queries";
import { ledgerSlug, parseLedgerParam } from "@/modules/petty-cash/domain/ledger-slug";
import { LedgerSheetView } from "@/modules/petty-cash/ui/ledger-sheet";
import { todayInBogota } from "@/modules/shared/domain/dates";

// Reading a scanned PDF with the AI (an import server action used on this page) takes a while.
export const maxDuration = 300;

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const session = await requirePettyCashAccess();
  const { slug } = await params;
  const param = parseLedgerParam(slug);
  if (!param) notFound();
  if (param.kind === "legacyId") {
    // Old links carried the database id: send them to the ledger's own URL (looked up for this user only).
    const number = await getLedgerNumberById(param.id);
    if (number === null) notFound();
    permanentRedirect(`/caja/${ledgerSlug(number)}`);
  }
  const sheet = await getLedgerSheet(param.number);
  if (!sheet) notFound();
  const [suppliers, vehicles, owners] = await Promise.all([listSuppliers(), listVehicleOptions(), listOwnerOptions()]);
  return (
    <LedgerSheetView
      sheet={sheet}
      ownerName={session.user.name.toLocaleUpperCase("es-CO")}
      suppliers={suppliers}
      vehicles={vehicles}
      owners={owners}
      today={todayInBogota()}
    />
  );
}
