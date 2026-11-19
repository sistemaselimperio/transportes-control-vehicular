/** Reads the PostgreSQL error behind a failed query (drizzle wraps the driver error in `cause`). */
function pgFields(error: unknown): { code?: string; constraint?: string } | null {
  for (let current: unknown = error, depth = 0; current && typeof current === "object" && depth < 4; depth++) {
    const { code, constraint, cause } = current as { code?: unknown; constraint?: unknown; cause?: unknown };
    if (typeof code === "string") {
      return { code, constraint: typeof constraint === "string" ? constraint : undefined };
    }
    current = cause;
  }
  return null;
}

/** A unique constraint refused the write (23505), optionally only the one named `constraint`. */
export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  const fields = pgFields(error);
  if (fields?.code !== "23505") return false;
  return constraint === undefined || fields.constraint === constraint;
}

/** A foreign key refused the write (23503): the row is still referenced, or the referenced row is gone. */
export function isForeignKeyViolation(error: unknown): boolean {
  return pgFields(error)?.code === "23503";
}
