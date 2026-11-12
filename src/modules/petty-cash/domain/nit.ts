/** A NIT / ID number is stored as digits only and shown with dots: 1073382044 -> 1.073.382.044. */
export function normalizeNit(raw: string): string {
  return raw.replace(/\D/g, "");
}

export function formatNit(raw: string): string {
  const digits = normalizeNit(raw);
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
