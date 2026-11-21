import { describe, expect, it, vi } from "vitest";
import { resolveReferenceIds } from "./reference-resolver";

describe("resolveReferenceIds", () => {
  it("asks once per name, the first spelling winning, and answers by search key", async () => {
    const ensure = vi.fn(async (refs: ReadonlyArray<{ name: string; key: string }>) => new Map(refs.map((r, i) => [r.key, 10 + i])));
    const ids = await resolveReferenceIds(ensure, ["Engorde Último", "engorde ultimo", "Levante"]);
    expect(ensure).toHaveBeenCalledWith([
      { name: "Engorde Último", key: "engordeultimo" },
      { name: "Levante", key: "levante" },
    ]);
    expect(ids.get("engordeultimo")).toBe(10);
    expect(ids.get("levante")).toBe(11);
  });
});
