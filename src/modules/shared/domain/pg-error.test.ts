import { describe, expect, it } from "vitest";
import { isForeignKeyViolation, isUniqueViolation } from "./pg-error";

const pgError = (code: string, constraint?: string) => Object.assign(new Error("pg"), { code, constraint });

describe("isUniqueViolation", () => {
  it("recognizes a unique violation, directly or wrapped by drizzle", () => {
    expect(isUniqueViolation(pgError("23505"))).toBe(true);
    expect(isUniqueViolation(new Error("Failed query", { cause: pgError("23505") }))).toBe(true);
  });

  it("can be narrowed to one constraint", () => {
    const error = pgError("23505", "loads_siesa_number_unique");
    expect(isUniqueViolation(error, "loads_siesa_number_unique")).toBe(true);
    expect(isUniqueViolation(error, "clients_nit_uq")).toBe(false);
  });

  it("ignores everything else", () => {
    expect(isUniqueViolation(pgError("23503"))).toBe(false);
    expect(isUniqueViolation(new Error("boom"))).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation("23505")).toBe(false);
  });
});

describe("isForeignKeyViolation", () => {
  it("recognizes a foreign key violation, directly or wrapped", () => {
    expect(isForeignKeyViolation(pgError("23503"))).toBe(true);
    expect(isForeignKeyViolation(new Error("Failed query", { cause: pgError("23503") }))).toBe(true);
  });

  it("ignores everything else", () => {
    expect(isForeignKeyViolation(pgError("23505"))).toBe(false);
    expect(isForeignKeyViolation(undefined)).toBe(false);
  });
});
