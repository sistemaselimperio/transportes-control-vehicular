import { describe, expect, it } from "vitest";
import { isPlaceholderDriverName } from "./placeholder-name";

describe("isPlaceholderDriverName", () => {
  it("flags names that mean 'no driver', in any case or accent", () => {
    for (const name of ["Sin Conductor", "SIN CONDUCTOR", "sin vehículo", "Sin vehiculo", "Ninguno", "N/A", "  sin   asignar "]) {
      expect(isPlaceholderDriverName(name)).toBe(true);
    }
  });

  it("accepts real names, even ones that contain those words", () => {
    for (const name of ["Juan Pérez", "Sinforoso Gómez", "Camilo Cortes"]) {
      expect(isPlaceholderDriverName(name)).toBe(false);
    }
  });
});
