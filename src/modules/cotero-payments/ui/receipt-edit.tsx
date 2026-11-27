"use client";

import { useState } from "react";
import { ActionForm } from "@/components/app/action-form";
import { SlideOver } from "@/components/app/slide-over";
import { formatVehiclePlate } from "../domain/plates";
import type { ReceiptDraft, ReceiptRow } from "../domain/receipt-rules";
import { updateReceiptAction } from "../application/cotero-actions";
import { ReceiptFields } from "./receipt-fields";
import { useOnWindowFocus, type FleetControl } from "./use-fleet";

/** The draft a stored receipt is edited as: what it holds, written the way a person would type it. */
function draftOf(row: ReceiptRow): ReceiptDraft {
  return {
    receiptNumber: row.receiptNumber,
    date: row.date,
    destination: row.destination,
    remissions: row.remissions.join(" "),
    tons: String(row.tons),
    vehiclePlate: formatVehiclePlate(row.vehiclePlate),
    trailerPlate: row.trailerPlate ? formatVehiclePlate(row.trailerPlate) : "",
    coteroName: row.coteroName,
    coteroDocument: row.coteroDocument ?? "",
    driverName: row.driverName,
    amount: String(row.amount),
  };
}

function EditForm({
  row,
  fleet,
  onDone,
  onCancel,
}: {
  row: ReceiptRow;
  fleet: FleetControl;
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(() => draftOf(row));
  // Coming back from the drivers section (another tab): read the fleet again.
  useOnWindowFocus(true, () => void fleet.refresh());
  return (
    <ActionForm action={(fd) => updateReceiptAction(row.id, fd)} submitLabel="Guardar" onDone={onDone} onCancel={onCancel}>
      <ReceiptFields draft={draft} onChange={setDraft} idPrefix={`edit-${row.id}`} fleet={fleet} />
    </ActionForm>
  );
}

/** Side sheet to edit a pending receipt. */
export function ReceiptEdit({
  row,
  fleet,
  onClose,
  onDone,
}: {
  row: ReceiptRow | undefined;
  fleet: FleetControl;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  return (
    <SlideOver open={row !== undefined} onOpenChange={(open) => !open && onClose()} title="Editar recibo" description={row?.receiptNumber} wide>
      {row && (
        <EditForm
          key={row.id}
          row={row}
          fleet={fleet}
          onCancel={onClose}
          onDone={(message) => {
            onDone(message);
            onClose();
          }}
        />
      )}
    </SlideOver>
  );
}
