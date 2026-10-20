/**
 * Turns the raw values of the vehicle forms (strings) into the JSON bodies of
 * `POST /api/vehiculos` and `PATCH /api/vehiculos/[placa]`. Validation stays on
 * the server; this only reshapes.
 */
type FormValues = Record<string, string | undefined>;

const str = (v: string | undefined) => (v?.trim() ? v.trim() : null);

/** Integer from a field; tolerates "359.174"-style thousands separators. */
const int = (v: string | undefined) => {
  const digits = (v ?? "").replace(/[.,\s]/g, "");
  return digits === "" ? null : Number(digits);
};

const checked = (v: string | undefined) => v === "on" || v === "true";

function owner(v: FormValues) {
  const choice = v.ownerChoice ?? "";
  if (choice === "") return null;
  const date = v.ownerDate ?? "";
  if (choice === "IMPERIO") return { kind: "imperio", date };
  if (choice === "NEW") {
    return { kind: "new", name: v.ownerName?.trim() ?? "", documentNumber: str(v.ownerDocument), date };
  }
  return { kind: "existing", id: Number(choice), date };
}

function driver(v: FormValues) {
  const choice = v.driverChoice ?? "";
  if (choice === "") return null;
  const date = v.driverDate ?? "";
  if (choice === "NEW") {
    return {
      kind: "new",
      name: v.driverName?.trim() ?? "",
      nationalId: str(v.driverNationalId),
      phone: str(v.driverPhone),
      date,
    };
  }
  return { kind: "existing", id: Number(choice), date };
}

function documents(v: FormValues) {
  const docs: Array<Record<string, unknown>> = [];
  for (const [type, prefix] of [["SOAT", "soat"], ["TECNO", "tecno"]] as const) {
    if (checked(v[`${prefix}NotApplicable`])) docs.push({ type, notApplicable: true });
    else if (str(v[`${prefix}ExpiresOn`])) docs.push({ type, expiresOn: str(v[`${prefix}ExpiresOn`]) });
  }
  if (str(v.policyExpiresOn)) {
    docs.push({ type: "POLICY", policyKind: str(v.policyKind), expiresOn: str(v.policyExpiresOn) });
  }
  return docs;
}

export function createBodyFromForm(v: FormValues) {
  return {
    plate: v.plate ?? "",
    classId: int(v.classId),
    brandLine: str(v.brandLine),
    notes: str(v.notes),
    municipality: str(v.municipality),
    serviceType: v.serviceType || undefined,
    status: v.status || undefined,
    oilMode: v.oilMode || undefined,
    odometerWorking: !checked(v.odometerBroken),
    currentKm: int(v.currentKm),
    towingPlate: str(v.towingPlate),
    owner: owner(v),
    driver: driver(v),
    documents: documents(v),
    tax: v.taxKind ? { kind: v.taxKind, year: int(v.taxYear) } : null,
    oilChange: str(v.oilDate) ? { date: str(v.oilDate), km: int(v.oilKm) } : null,
  };
}

export function editBodyFromForm(v: FormValues) {
  return {
    plate: v.plate ?? "",
    classId: int(v.classId),
    brandLine: str(v.brandLine),
    notes: str(v.notes),
    municipality: str(v.municipality),
    serviceType: v.serviceType || undefined,
    oilMode: v.oilMode || undefined,
    towingPlate: str(v.towingPlate),
  };
}
