/** The two owners seeded by `npm run db:seed` (matched by document number). */
export const KNOWN_OWNERS = {
  IMPERIO: {
    name: "Transportes El Imperio",
    documentNumber: "901838598",
    group: "IMPERIO",
  },
  FABIAN: { name: "Fabián Páez", documentNumber: "74439231", group: "PAEZ" },
} as const;

export type KnownOwnerKey = keyof typeof KNOWN_OWNERS;
