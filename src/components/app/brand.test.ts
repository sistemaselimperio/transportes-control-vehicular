import { describe, expect, it } from "vitest";
import type { Role } from "@/lib/permissions";
import { brandFor } from "./brand";

describe("brandFor", () => {
  it.each<Role>(["dispatcher", "loader"])("gives %s the livestock logistics brand", (role) => {
    expect(brandFor(role)).toEqual({
      variant: "logistics",
      name: "Logística Ganadera",
      slogan: "Del campo a tu destino",
    });
  });

  it.each<Role>(["admin", "staff", "assistant", "superadmin"])("keeps the fleet brand for %s", (role) => {
    expect(brandFor(role)).toEqual({
      variant: "imperio",
      name: "Transportes El Imperio",
      slogan: "Control de Flota",
    });
  });
});
