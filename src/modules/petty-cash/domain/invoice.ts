/** Invoice numbers are compared without case, spaces or punctuation: "fe-0012" equals "FE 0012". */
export function normalizeInvoiceNumber(raw: string | null): string {
  return (raw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * An expense repeats another one when the same supplier (NIT) issued the same invoice number.
 * `sameNitInvoiceNumbers` are the invoice numbers of the user's other expenses with that NIT.
 * Without a NIT or an invoice number nothing can be compared, so it is never a duplicate.
 */
export function isPossibleDuplicate(
  nit: string | null,
  invoiceNumber: string | null,
  sameNitInvoiceNumbers: ReadonlyArray<string | null>,
): boolean {
  const wanted = normalizeInvoiceNumber(invoiceNumber);
  if (!nit || wanted === "") return false;
  return sameNitInvoiceNumbers.some((other) => normalizeInvoiceNumber(other) === wanted);
}
