/**
 * One-off load of the company trailers (vehicles of class "Remolque") and their owners.
 * The plan is pure and idempotent: it only lists what is missing, so running the load again is a no-op.
 */
import { stripAccents } from "@/modules/import-export/domain/cell-parsers";
import { KNOWN_OWNERS } from "@/modules/owners/domain/known-owners";
import { normalizePlate } from "./plate";

export type TrailerLoadStatus = "ACTIVE" | "IDLE" | "SOLD";
type OwnerGroup = "IMPERIO" | "PAEZ" | "THIRD_PARTY";

export interface TrailerSeedOwner {
  name: string;
  group: OwnerGroup;
  /** Matches an existing owner even when the stored name is spelled differently. */
  documentNumber?: string;
}

export interface TrailerSeed {
  plate: string;
  status: TrailerLoadStatus;
  /** Null for the blocked trailers (sold or idle without a known owner). */
  owner: TrailerSeedOwner | null;
}

const thirdParty = (name: string): TrailerSeedOwner => ({ name, group: "THIRD_PARTY" });

const trailersOf = (
  owner: TrailerSeedOwner | null,
  status: TrailerLoadStatus,
  plates: string[],
): TrailerSeed[] => plates.map((plate) => ({ plate, status, owner }));

export const TRAILERS_TO_LOAD: readonly TrailerSeed[] = [
  ...trailersOf({ ...KNOWN_OWNERS.IMPERIO }, "ACTIVE", ["S88490", "R31597", "S91997", "S90765"]),
  ...trailersOf({ ...KNOWN_OWNERS.FABIAN }, "ACTIVE", [
    "R81862",
    "S80720",
    "S80451",
    "S82646",
    "S84577",
    "R21396",
    "R12423",
    "R44884",
    "R33293",
    "S73172",
    "S68424",
    "S76715",
  ]),
  ...trailersOf(thirdParty("BANCOLOMBIA"), "ACTIVE", ["S82596"]),
  ...trailersOf(thirdParty("IVAN DARIO SARMIENTO"), "ACTIVE", ["S58917"]),
  ...trailersOf(thirdParty("ROSA ISABEL RODRIGUEZ"), "ACTIVE", ["R09022"]),
  ...trailersOf(thirdParty("TIZZON SAS"), "ACTIVE", ["R45245"]),
  ...trailersOf(null, "SOLD", ["R18876"]),
  ...trailersOf(null, "IDLE", ["R18936", "R44914"]),
];

export interface ExistingOwner {
  id: number;
  name: string;
  documentNumber: string | null;
}

export type OwnerRef = { kind: "existing"; id: number } | { kind: "new"; key: string };

export interface TrailerLoadPlan {
  trailers: Array<{ plate: string; status: TrailerLoadStatus; owner: OwnerRef | null }>;
  newOwners: Array<{ key: string; name: string; group: OwnerGroup; documentNumber: string | null }>;
  /** Plates of the list that already exist and are left untouched. */
  skippedPlates: string[];
}

/** Case-, accent- and spacing-insensitive owner name. */
export const ownerNameKey = (name: string) => stripAccents(name).toUpperCase().replace(/\s+/g, " ").trim();

export function planTrailerLoad(
  seeds: readonly TrailerSeed[],
  existingPlates: Iterable<string>,
  existingOwners: readonly ExistingOwner[],
): TrailerLoadPlan {
  const taken = new Set<string>();
  for (const plate of existingPlates) taken.add(normalizePlate(plate));

  const plan: TrailerLoadPlan = { trailers: [], newOwners: [], skippedPlates: [] };
  const newOwnerKeys = new Set<string>();

  const resolveOwner = (owner: TrailerSeedOwner): OwnerRef => {
    const key = ownerNameKey(owner.name);
    const found = existingOwners.find(
      (o) => (owner.documentNumber && o.documentNumber === owner.documentNumber) || ownerNameKey(o.name) === key,
    );
    if (found) return { kind: "existing", id: found.id };
    if (!newOwnerKeys.has(key)) {
      newOwnerKeys.add(key);
      plan.newOwners.push({ key, name: owner.name, group: owner.group, documentNumber: owner.documentNumber ?? null });
    }
    return { kind: "new", key };
  };

  const planned = new Set<string>();
  for (const seed of seeds) {
    const plate = normalizePlate(seed.plate);
    if (planned.has(plate)) continue; // repeated inside the list
    planned.add(plate);
    if (taken.has(plate)) {
      plan.skippedPlates.push(plate);
      continue;
    }
    plan.trailers.push({ plate, status: seed.status, owner: seed.owner ? resolveOwner(seed.owner) : null });
  }
  return plan;
}
