import { describe, expect, it } from "vitest";
import {
  exitStatus,
  hasFailedItems,
  MAX_CLOSURE_ACTION_LENGTH,
  MAX_CLOSURE_RESPONSIBLE_LENGTH,
  MAX_CLOSURE_WORK_ORDER_LENGTH,
  validateClosure,
  validateExitDecision,
} from "./exit-decision";

describe("exitStatus", () => {
  it("is PENDING until a decision is recorded", () => {
    expect(exitStatus({ exitDecision: null })).toBe("PENDING");
    expect(exitStatus({ exitDecision: "APTO" })).toBe("APTO");
    expect(exitStatus({ exitDecision: "NO_APTO" })).toBe("NO_APTO");
  });
});

describe("hasFailedItems", () => {
  it("is true when any item is MAL, critical or not", () => {
    expect(hasFailedItems({})).toBe(false);
    expect(hasFailedItems({ a: { status: "BIEN" } })).toBe(false);
    expect(hasFailedItems({ a: { status: "BIEN" }, b: { status: "MAL", note: "x" } })).toBe(true);
  });
});

describe("validateExitDecision", () => {
  it("requires a known decision", () => {
    for (const bad of [null, undefined, {}, { decision: "" }, { decision: "SI" }, { decision: 1 }, "APTO"]) {
      expect(validateExitDecision(bad).ok).toBe(false);
    }
    expect(validateExitDecision({ decision: "x" })).toEqual({ ok: false, errors: { decision: "Elige APTO o NO APTO." } });
  });

  it("requires a valid HH:MM time for APTO", () => {
    expect(validateExitDecision({ decision: "APTO" })).toEqual({
      ok: false,
      errors: { authorizedTime: "Indica la hora de salida autorizada." },
    });
    for (const bad of ["24:00", "7:30", "12:60", "ab:cd", "12:5"]) {
      expect(validateExitDecision({ decision: "APTO", authorizedTime: bad }).ok).toBe(false);
    }
    expect(validateExitDecision({ decision: "APTO", authorizedTime: " 06:30 " })).toEqual({
      ok: true,
      value: { decision: "APTO", authorizedTime: "06:30" },
    });
  });

  it("ignores the time for NO_APTO, even an invalid one", () => {
    expect(validateExitDecision({ decision: "NO_APTO" })).toEqual({
      ok: true,
      value: { decision: "NO_APTO", authorizedTime: null },
    });
    expect(validateExitDecision({ decision: "NO_APTO", authorizedTime: "zz" })).toEqual({
      ok: true,
      value: { decision: "NO_APTO", authorizedTime: null },
    });
  });
});

describe("validateClosure", () => {
  const ctx = { inspectionDate: "2026-03-10", hasFailedItems: true };
  const valid = { date: "2026-03-12", workOrder: "OT-45", action: "Se cambió la llanta", responsible: "Taller Pérez" };

  it("accepts a complete closure and trims it", () => {
    expect(
      validateClosure({ date: "2026-03-12", workOrder: "  OT  45 ", action: " Se  cambió ", responsible: " Juan " }, ctx),
    ).toEqual({ ok: true, value: { date: "2026-03-12", workOrder: "OT 45", action: "Se cambió", responsible: "Juan" } });
  });

  it("only allows a closure when something is MAL", () => {
    expect(validateClosure(valid, { ...ctx, hasFailedItems: false })).toEqual({
      ok: false,
      errors: { form: "Esta inspección no tiene novedades por cerrar." },
    });
  });

  it("requires a real date that is not before the inspection date", () => {
    expect(validateClosure({ ...valid, date: "" }, ctx)).toMatchObject({ ok: false, errors: { date: "Indica la fecha de cierre." } });
    expect(validateClosure({ ...valid, date: "2026-02-31" }, ctx)).toMatchObject({ ok: false, errors: { date: "Indica la fecha de cierre." } });
    expect(validateClosure({ ...valid, date: "2026-03-09" }, ctx)).toMatchObject({
      ok: false,
      errors: { date: "La fecha de cierre no puede ser anterior a la inspección." },
    });
    expect(validateClosure({ ...valid, date: "2026-03-10" }, ctx).ok).toBe(true);
  });

  it("requires what was done", () => {
    expect(validateClosure({ ...valid, action: "  " }, ctx)).toMatchObject({ ok: false, errors: { action: "Describe qué se hizo." } });
  });

  it("makes work order and responsible optional", () => {
    expect(validateClosure({ date: "2026-03-12", action: "Listo" }, ctx)).toEqual({
      ok: true,
      value: { date: "2026-03-12", workOrder: "", action: "Listo", responsible: "" },
    });
  });

  it("caps the lengths", () => {
    const result = validateClosure(
      {
        ...valid,
        workOrder: "x".repeat(MAX_CLOSURE_WORK_ORDER_LENGTH + 1),
        action: "x".repeat(MAX_CLOSURE_ACTION_LENGTH + 1),
        responsible: "x".repeat(MAX_CLOSURE_RESPONSIBLE_LENGTH + 1),
      },
      ctx,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(["action", "responsible", "workOrder"]);
  });

  it("rejects a non-object input", () => {
    expect(validateClosure(null, ctx)).toEqual({ ok: false, errors: { form: "Revisa los datos ingresados." } });
  });
});
