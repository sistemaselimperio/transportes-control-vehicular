export const RESPONSIBILITY_TYPES = ["none_active", "electronic_invoicer"] as const;
export type ResponsibilityType = (typeof RESPONSIBILITY_TYPES)[number];

/** How the sheet writes each tax responsibility. */
export const RESPONSIBILITY_LABELS: Record<ResponsibilityType, string> = {
  none_active: "SIN RESPONSABILIDAD ACTIVA",
  electronic_invoicer: "FACTURADOR ELECTRONICO",
};

export const isResponsibilityType = (value: unknown): value is ResponsibilityType =>
  typeof value === "string" && (RESPONSIBILITY_TYPES as readonly string[]).includes(value);

/** An expense whose supplier or billed party is not fully identified yet: the sheet shows its NIT in red. */
export function isExpensePending(expense: {
  nit: string | null;
  company: string | null;
  responsibilityType: ResponsibilityType | null;
}): boolean {
  return !expense.nit || !expense.company || expense.company.trim() === "" || expense.responsibilityType === null;
}

/** An expense without a value (still to be completed after an AI import) counts as zero. */
export function sumExpenses(expenses: ReadonlyArray<{ value: number | null }>): number {
  return expenses.reduce((total, e) => total + (e.value ?? 0), 0);
}
