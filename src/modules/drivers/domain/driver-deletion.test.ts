import { describe, expect, it } from "vitest";
import { checkDriverDeletion } from "./driver-deletion";

describe("checkDriverDeletion", () => {
  it("allows deleting a driver without a current vehicle", () => {
    expect(checkDriverDeletion("Ana Pérez", [])).toEqual({ ok: true });
  });

  it("refuses when the driver is assigned to one vehicle, naming it", () => {
    expect(checkDriverDeletion("Ana Pérez", ["JSL978"])).toEqual({
      ok: false,
      message: "No se puede eliminar: Ana Pérez está asignado a un vehículo (JSL978). Desasígnalo primero.",
    });
  });

  it("refuses when the driver is assigned to several vehicles", () => {
    const result = checkDriverDeletion("Ana Pérez", ["JSL978", "ABC123"]);
    expect(result).toEqual({
      ok: false,
      message: "No se puede eliminar: Ana Pérez está asignado a 2 vehículos (JSL978, ABC123). Desasígnalo primero.",
    });
  });
});
