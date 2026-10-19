/** The three owners seeded by `npm run db:seed` (matched by document number). */
export const KNOWN_OWNERS = {
  IMPERIO: {
    name: "TRANSPORTES EL IMPERIO",
    documentNumber: "901838598",
    group: "IMPERIO",
  },
  FABIAN: { name: "FABIÁN PÁEZ", documentNumber: "74439231", group: "PAEZ" },
  SANDRA: {
    name: "SANDRA MARCELA PÁEZ PORRAS",
    documentNumber: "1053323036",
    group: "PAEZ",
  },
} as const;

export type KnownOwnerKey = keyof typeof KNOWN_OWNERS;
