"use client";

import { Field } from "@/components/app/action-form";
import { Input } from "@/components/ui/input";
import type { CorrectedFields } from "../domain/fleet-matching";
import type { DraftField, DraftIssue, ReceiptDraft } from "../domain/receipt-rules";
import { FleetInput, type FleetInputKind } from "./fleet-input";
import type { FleetControl } from "./use-fleet";

const CONTROL = "h-10 md:h-9";

/**
 * The twelve fields of a receipt, controlled; a field with an issue is marked and says what is wrong. The
 * plates and the driver are tied to the fleet (`fleet`): they suggest while typing and say when one is not
 * in it; `corrected` holds what the AI read for the ones the fleet corrected.
 */
export function ReceiptFields({
  draft,
  onChange,
  issues = [],
  idPrefix,
  fleet,
  corrected = {},
}: {
  draft: ReceiptDraft;
  onChange: (next: ReceiptDraft) => void;
  issues?: readonly DraftIssue[];
  idPrefix: string;
  fleet: FleetControl;
  corrected?: CorrectedFields;
}) {
  const issueOf = (field: DraftField) => issues.find((i) => i.field === field);

  function text(field: DraftField, label: string, options: { required?: boolean; type?: string; inputMode?: "numeric" | "decimal" | "text"; hint?: string; className?: string; list?: string } = {}) {
    const issue = issueOf(field);
    const id = `${idPrefix}-${field}`;
    return (
      <div className={options.className}>
        <Field
          label={label}
          htmlFor={id}
          required={options.required}
          hint={issue ? (issue.kind === "missing" ? "Falta este dato." : "No se entiende este dato.") : options.hint}
        >
          <Input
            id={id}
            name={field}
            type={options.type ?? "text"}
            inputMode={options.inputMode}
            autoComplete="off"
            list={options.list}
            className={CONTROL}
            aria-invalid={issue ? true : undefined}
            value={draft[field]}
            onChange={(e) => onChange({ ...draft, [field]: e.target.value })}
          />
        </Field>
      </div>
    );
  }

  function fleetField(field: "vehiclePlate" | "trailerPlate" | "driverName", label: string, kind: FleetInputKind, required = false) {
    return (
      <FleetInput
        id={`${idPrefix}-${field}`}
        name={field}
        label={label}
        kind={kind}
        value={draft[field]}
        onChange={(value) => onChange({ ...draft, [field]: value })}
        fleet={fleet}
        required={required}
        issue={issueOf(field)}
        corrected={corrected[field]}
      />
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {text("receiptNumber", "N.º de recibo", { required: true, hint: "Ej. T 0248" })}
      {text("date", "Fecha", { required: true, type: "date" })}
      {text("destination", "Destino de descargue", { className: "sm:col-span-2" })}
      {text("remissions", "Número de remisión", { className: "sm:col-span-2", hint: "Solo informativo; puede haber varios." })}
      {text("tons", "Toneladas", { required: true, inputMode: "decimal", hint: "Si está en kg, escribe «12.880 kg»." })}
      {text("amount", "Liquidación ($)", { required: true, inputMode: "numeric", hint: "El valor escrito en el recibo." })}
      {fleetField("vehiclePlate", "Placa del vehículo", "vehicle", true)}
      {fleetField("trailerPlate", "Placa del trailer", "trailer")}
      {text("crew", "Cuadrilla")}
      {fleetField("driverName", "Conductor", "driver", true)}
      {text("coteroName", "Nombre del cotero", { required: true, className: "sm:col-span-2", list: "cotero-names" })}
      {text("coteroDocument", "Cédula del cotero", { className: "sm:col-span-2", inputMode: "numeric", hint: "Junto a la firma; identifica al cotero aunque el nombre cambie." })}
    </div>
  );
}
