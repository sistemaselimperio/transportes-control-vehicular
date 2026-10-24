/** The three owners seeded by `npm run db:seed` (matched by document number). */
export const KNOWN_OWNERS = {
  IMPERIO: {
    name: "Transportes El Imperio",
    documentNumber: "901838598",
    group: "IMPERIO",
  },
  FABIAN: { name: "Fabián Páez", documentNumber: "74439231", group: "PAEZ" },
  SANDRA: {
    name: "Sandra Marcela Páez Porras",
    documentNumber: "1053323036",
    group: "PAEZ",
  },
} as const;

export type KnownOwnerKey = keyof typeof KNOWN_OWNERS;
