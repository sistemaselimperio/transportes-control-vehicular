import { describe, expect, it } from "vitest";
import { isStorageNotFound, supabaseUrl } from "./supabase-config";

describe("supabaseUrl", () => {
  it("prefers SUPABASE_URL", () => {
    expect(
      supabaseUrl({ SUPABASE_URL: "https://custom.example.co", DATABASE_URL: "postgres://postgres.abc:pw@h:5432/db" }),
    ).toBe("https://custom.example.co");
  });

  it("derives the project url from the pooler username", () => {
    expect(supabaseUrl({ DATABASE_URL: "postgresql://postgres.myref:pw@aws-0.pooler.supabase.com:6543/postgres" })).toBe(
      "https://myref.supabase.co",
    );
  });

  it("fails when the url cannot be derived", () => {
    expect(() => supabaseUrl({ DATABASE_URL: "postgresql://postgres:pw@localhost:5432/db" })).toThrow(/SUPABASE_URL/);
  });
});

describe("isStorageNotFound", () => {
  it("recognizes missing-object errors", () => {
    expect(isStorageNotFound({ status: 404, message: "x" })).toBe(true);
    expect(isStorageNotFound({ code: "NoSuchKey", message: "x" })).toBe(true);
    expect(isStorageNotFound({ status: 400, message: "Object not found" })).toBe(true);
  });

  it("does not hide other failures", () => {
    expect(isStorageNotFound({ status: 500, message: "boom" })).toBe(false);
    expect(isStorageNotFound({ status: 403, message: "denied" })).toBe(false);
  });
});
