import { describe, expect, it, vi } from "vitest";
import { ZodError, z } from "zod";
import { ForbiddenError } from "@/lib/permissions";
import { actionFailure } from "./action-failure";

class RuleError extends Error {}

const pgError = (code: string, constraint?: string) => Object.assign(new Error("pg"), { code, constraint });

describe("actionFailure", () => {
  it("passes the message of an expected domain error", () => {
    expect(actionFailure(new RuleError("Regla rota."), { label: "x", expected: [RuleError] })).toEqual({
      ok: false,
      error: "Regla rota.",
    });
  });

  it("reports the first validation issue", () => {
    const parsed = z.object({ a: z.string("Falta a.") }).safeParse({});
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(actionFailure(parsed.error, { label: "x", expected: [] })).toEqual({ ok: false, error: "Falta a." });
    }
    expect(actionFailure(new ZodError([]), { label: "x", expected: [] })).toEqual({
      ok: false,
      error: "Revisa los datos ingresados.",
    });
  });

  it("passes a forbidden error through", () => {
    expect(actionFailure(new ForbiddenError(), { label: "x", expected: [] })).toEqual({
      ok: false,
      error: "No tienes permiso para realizar esta acción.",
    });
  });

  it("tells an expired session apart", () => {
    expect(actionFailure(new Error("No autorizado"), { label: "x", expected: [] })).toEqual({
      ok: false,
      error: "Tu sesión expiró. Vuelve a iniciar sesión.",
    });
  });

  it("explains a unique violation, with a message per constraint", () => {
    const options = { label: "x", expected: [], unique: { loads_siesa_number_unique: "Ya existe un cargue con ese número SIESA." } };
    expect(actionFailure(pgError("23505", "loads_siesa_number_unique"), options)).toEqual({
      ok: false,
      error: "Ya existe un cargue con ese número SIESA.",
    });
    expect(actionFailure(pgError("23505", "other"), options)).toEqual({
      ok: false,
      error: "Ya existe un registro con esos datos.",
    });
  });

  it("explains a foreign key violation", () => {
    expect(actionFailure(pgError("23503"), { label: "x", expected: [] })).toEqual({
      ok: false,
      error: "El registro está en uso o ya no existe. Recarga e intenta de nuevo.",
    });
  });

  it("hides anything unexpected behind a generic message and logs it", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(actionFailure(new Error("boom"), { label: "client", expected: [] })).toEqual({
      ok: false,
      error: "No se pudo guardar. Intenta de nuevo.",
    });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
