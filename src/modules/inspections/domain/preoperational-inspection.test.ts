import { describe, expect, it } from "vitest";
import { ALL_CHECKLIST_ITEMS, PREOPERATIONAL_CHECKLIST, findChecklistItem } from "./preoperational-checklist";
import {
  applicableItems,
  uncheckedCount,
  type InspectionAnswers,
  bogotaDateTime,
  failedCriticalItems,
  MAX_SIGNATURE_LENGTH,
  validateInspection,
} from "./preoperational-inspection";

const SIGNATURE = "data:image/png;base64,iVBORw0KGgo=";

const allBien = (muleNotApplicable = false) =>
  Object.fromEntries(applicableItems(muleNotApplicable).map((item) => [item.id, { status: "BIEN" }]));

const draft = (over: Record<string, unknown> = {}) => ({
  date: "2026-03-14",
  time: "06:30",
  plate: "abc 123",
  trailerPlate: "",
  driverName: "Juan Pérez",
  driverId: "1234567",
  odometer: "150000",
  route: "Bogotá - Cartagena",
  muleNotApplicable: false,
  answers: allBien(),
  signature: SIGNATURE,
  ...over,
});

describe("PREOPERATIONAL_CHECKLIST", () => {
  it("has 13 sections with unique, stable item ids", () => {
    expect(PREOPERATIONAL_CHECKLIST).toHaveLength(13);
    const ids = ALL_CHECKLIST_ITEMS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps the illegal-items point optional, not critical", () => {
    expect(ALL_CHECKLIST_ITEMS.find((i) => i.id === "prohibited.illegal-items")?.critical).toBe(false);
  });

  it("marks only the mule section as mule-only", () => {
    expect(PREOPERATIONAL_CHECKLIST.filter((s) => s.muleOnly).map((s) => s.id)).toEqual(["mule"]);
  });

  it("flags the critical points", () => {
    expect(findChecklistItem("brakes.pedal")?.critical).toBe(true);
    expect(findChecklistItem("tires.spare")?.critical).toBe(false);
  });
});

describe("applicableItems", () => {
  it("includes the mule items unless they do not apply", () => {
    expect(applicableItems(false).some((i) => i.id === "mule.fifth-wheel")).toBe(true);
    expect(applicableItems(true).some((i) => i.id === "mule.fifth-wheel")).toBe(false);
  });
});

describe("validateInspection national id", () => {
  it("is required without a selected driver", () => {
    const result = validateInspection(draft({ driverId: " " }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.driverId).toBeTruthy();
  });

  it("may be blank with a selected driver (the server checks the registered one)", () => {
    const result = validateInspection(draft({ driverId: "", selectedDriverId: 3 }));
    expect(result.ok && result.value.driverNationalId).toBe("");
  });

  it("still caps its length when present", () => {
    expect(validateInspection(draft({ driverId: "1".repeat(21), selectedDriverId: 3 })).ok).toBe(false);
  });
});

describe("validateInspection selectedDriverId", () => {
  it("defaults to null when absent or null", () => {
    const absent = validateInspection(draft());
    const explicit = validateInspection(draft({ selectedDriverId: null }));
    expect(absent.ok && absent.value.selectedDriverId).toBeNull();
    expect(explicit.ok && explicit.value.selectedDriverId).toBeNull();
  });

  it("keeps a positive integer id", () => {
    const result = validateInspection(draft({ selectedDriverId: 7 }));
    expect(result.ok && result.value.selectedDriverId).toBe(7);
  });

  it.each([0, -1, 1.5, "7", NaN, {}, true])("rejects %j", (bad) => {
    const result = validateInspection(draft({ selectedDriverId: bad }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.selectedDriverId).toBeTruthy();
  });
});

describe("validateInspection", () => {
  it("accepts a complete inspection and normalizes the header", () => {
    const result = validateInspection(draft({ driverName: "  Juan   Pérez " }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      date: "2026-03-14",
      time: "06:30",
      plate: "ABC-123",
      trailerPlate: null,
      driverName: "Juan Pérez",
      driverNationalId: "1234567",
      odometer: "150000",
      route: "Bogotá - Cartagena",
      muleNotApplicable: false,
      hasCriticalFailure: false,
      signature: SIGNATURE,
    });
  });

  it("writes car and motorcycle plates with their hyphen, however they were typed", () => {
    const plateOf = (plate: string) => {
      const result = validateInspection(draft({ plate }));
      return result.ok ? result.value.plate : null;
    };
    expect(plateOf("abc123")).toBe("ABC-123");
    expect(plateOf("ABC-123")).toBe("ABC-123");
    expect(plateOf("abc 12d")).toBe("ABC-12D");
  });

  it("keeps a trailer plate when given", () => {
    const result = validateInspection(draft({ trailerPlate: " r 12345 " }));
    expect(result.ok && result.value.trailerPlate).toBe("R-12345");
  });

  it("requires every header field except the trailer plate and the odometer", () => {
    const result = validateInspection(
      draft({ plate: " ", driverName: "", driverId: "", odometer: "", route: "  " }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.errors).sort()).toEqual(["driverId", "driverName", "plate", "route"]);
  });

  it("accepts a blank odometer as an empty string and caps a present one", () => {
    const blank = validateInspection(draft({ odometer: "  " }));
    expect(blank.ok && blank.value.odometer).toBe("");
    const missing = validateInspection(draft({ odometer: undefined }));
    expect(missing.ok && missing.value.odometer).toBe("");
    const tooLong = validateInspection(draft({ odometer: "1".repeat(21) }));
    expect(tooLong.ok).toBe(false);
    if (!tooLong.ok) expect(tooLong.errors.odometer).toBeTruthy();
  });

  it("rejects a malformed date or time", () => {
    const result = validateInspection(draft({ date: "14/03/2026", time: "6:30pm" }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toHaveProperty("date");
    expect(result.errors).toHaveProperty("time");
  });

  it("rejects a calendar date that does not exist", () => {
    const result = validateInspection(draft({ date: "2026-02-31" }));
    expect(result.ok).toBe(false);
  });

  it("caps the length of free text", () => {
    const result = validateInspection(draft({ plate: "A".repeat(40), route: "x".repeat(500) }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toHaveProperty("plate");
    expect(result.errors).toHaveProperty("route");
  });

  it("lets non-critical items stay unanswered", () => {
    const answers = allBien() as Record<string, unknown>;
    delete answers["tires.spare"];
    delete answers["cabin.horn"];
    const result = validateInspection(draft({ answers }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.keys(result.value.answers)).not.toContain("tires.spare");
  });

  it("still requires the description of a non-critical MAL item", () => {
    const result = validateInspection(draft({ answers: { ...allBien(), "tires.spare": { status: "MAL" } } }));
    expect(result.ok).toBe(false);
  });

  it("requires every applicable critical item to be answered", () => {
    const answers = allBien() as Record<string, unknown>;
    delete answers["brakes.pedal"];
    const result = validateInspection(draft({ answers }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.errors)).toEqual(["brakes.pedal"]);
  });

  it("rejects a status that is neither BIEN nor MAL", () => {
    const result = validateInspection(draft({ answers: { ...allBien(), "tires.spare": { status: "REGULAR" } } }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toHaveProperty("tires.spare");
  });

  it("requires a description for every MAL item", () => {
    const result = validateInspection(
      draft({ answers: { ...allBien(), "tires.spare": { status: "MAL", note: "  " } } }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toHaveProperty("tires.spare");
  });

  it("caps the length of a description", () => {
    const result = validateInspection(
      draft({ answers: { ...allBien(), "tires.spare": { status: "MAL", note: "x".repeat(1000) } } }),
    );
    expect(result.ok).toBe(false);
  });

  it("keeps the description of a MAL item and drops the note of a BIEN one", () => {
    const result = validateInspection(
      draft({
        answers: {
          ...allBien(),
          "tires.spare": { status: "MAL", note: " Sin aire " },
          "cabin.horn": { status: "BIEN", note: "ignored" },
        },
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.answers["tires.spare"]).toEqual({ status: "MAL", note: "Sin aire" });
    expect(result.value.answers["cabin.horn"]).toEqual({ status: "BIEN" });
  });

  it("flags a critical failure and not a regular one", () => {
    const regular = validateInspection(
      draft({ answers: { ...allBien(), "tires.spare": { status: "MAL", note: "Pinchada" } } }),
    );
    expect(regular.ok && regular.value.hasCriticalFailure).toBe(false);

    const critical = validateInspection(
      draft({ answers: { ...allBien(), "brakes.pedal": { status: "MAL", note: "Pedal bajo" } } }),
    );
    expect(critical.ok && critical.value.hasCriticalFailure).toBe(true);
  });

  it("does not require the mule items when they do not apply, and discards them", () => {
    const answers = { ...allBien(true), "mule.fifth-wheel": { status: "MAL", note: "stale" } };
    const result = validateInspection(draft({ muleNotApplicable: true, answers }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.muleNotApplicable).toBe(true);
    expect(result.value.hasCriticalFailure).toBe(false);
    expect(Object.keys(result.value.answers)).not.toContain("mule.fifth-wheel");
  });

  it("requires the mule items when they apply", () => {
    const answers = allBien() as Record<string, unknown>;
    delete answers["mule.fifth-wheel"];
    delete answers["mule.landing-gear"];
    const result = validateInspection(draft({ answers }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.errors)).toEqual(["mule.fifth-wheel"]);
  });

  it("ignores answers for unknown items", () => {
    const result = validateInspection(draft({ answers: { ...allBien(), "made.up": { status: "MAL", note: "x" } } }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.keys(result.value.answers)).not.toContain("made.up");
  });

  it("requires the signature to be a PNG data URL within the size cap", () => {
    for (const signature of ["", "hello", "data:text/html;base64,PGI+", "data:image/png;base64,"]) {
      const result = validateInspection(draft({ signature }));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors).toHaveProperty("signature");
    }
    const tooBig = `data:image/png;base64,${"A".repeat(MAX_SIGNATURE_LENGTH)}`;
    expect(validateInspection(draft({ signature: tooBig })).ok).toBe(false);
  });

  it("rejects anything that is not an object", () => {
    for (const input of [null, undefined, "x", 42, []]) {
      const result = validateInspection(input);
      expect(result.ok).toBe(false);
    }
  });

  it("tolerates non-string header values", () => {
    const result = validateInspection(draft({ plate: 123, route: { a: 1 } }));
    expect(result.ok).toBe(false);
  });
});

describe("failedCriticalItems", () => {
  it("lists the critical items marked MAL in form order", () => {
    const failed = failedCriticalItems({
      "tires.spare": { status: "MAL", note: "x" },
      "soat-not-here": { status: "MAL", note: "x" },
      "brakes.parking": { status: "MAL", note: "x" },
      "documents.soat": { status: "MAL", note: "x" },
      "cabin.seat-belt": { status: "BIEN" },
    });
    expect(failed.map((i) => i.id)).toEqual(["documents.soat", "brakes.parking"]);
  });
});

describe("bogotaDateTime", () => {
  it("formats the date and time in Colombia time, not UTC", () => {
    expect(bogotaDateTime(new Date("2026-01-01T03:15:00Z"))).toEqual({ date: "2025-12-31", time: "22:15" });
  });

  it("pads the hour and keeps midnight as 00", () => {
    expect(bogotaDateTime(new Date("2026-06-10T05:05:00Z"))).toEqual({ date: "2026-06-10", time: "00:05" });
  });
});

describe("uncheckedCount", () => {
  it("is zero when everything applicable is answered", () => {
    expect(uncheckedCount(allBien() as InspectionAnswers, false)).toBe(0);
  });

  it("counts the applicable items without an answer", () => {
    const answers = allBien() as Record<string, { status: "BIEN" | "MAL" }>;
    delete answers["tires.spare"];
    delete answers["cabin.horn"];
    expect(uncheckedCount(answers, false)).toBe(2);
  });

  it("ignores the mule items when they do not apply", () => {
    const answers = allBien(true) as Record<string, { status: "BIEN" | "MAL" }>;
    expect(uncheckedCount(answers, true)).toBe(0);
    expect(uncheckedCount(answers, false)).toBe(applicableItems(false).length - applicableItems(true).length);
  });
});
