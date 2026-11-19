import type { Role } from "@/lib/permissions";

export type BrandVariant = "imperio" | "logistics";

export interface Brand {
  variant: BrandVariant;
  name: string;
  slogan: string;
}

const FLEET_BRAND: Brand = { variant: "imperio", name: "Transportes El Imperio", slogan: "Control de Flota" };
const LOGISTICS_BRAND: Brand = { variant: "logistics", name: "Logística Ganadera", slogan: "Del campo a tu destino" };

/** The lockup the sidebar shows: the commercial area has its own brand, every other role the fleet one. */
export function brandFor(role: Role): Brand {
  return role === "commercial" ? LOGISTICS_BRAND : FLEET_BRAND;
}
