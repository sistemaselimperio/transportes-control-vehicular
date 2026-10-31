import { describe, expect, it } from "vitest";
import { withRetry } from "./retry";

const noWait = { baseDelayMs: 0 };

describe("withRetry", () => {
  it("returns the first successful result", async () => {
    let calls = 0;
    const result = await withRetry(async () => {
      calls++;
      return "ok";
    }, noWait);
    expect(result).toBe("ok");
    expect(calls).toBe(1);
  });

  it("retries until a call succeeds", async () => {
    let calls = 0;
    const result = await withRetry(async () => {
      calls++;
      if (calls < 3) throw new Error("timeout");
      return calls;
    }, noWait);
    expect(result).toBe(3);
  });

  it("gives up after the last attempt with the last error", async () => {
    let calls = 0;
    await expect(
      withRetry(async () => {
        calls++;
        throw new Error(`fail ${calls}`);
      }, { ...noWait, attempts: 4 }),
    ).rejects.toThrow("fail 4");
    expect(calls).toBe(4);
  });

  it("reports each failed attempt", async () => {
    const seen: number[] = [];
    let calls = 0;
    await withRetry(
      async () => {
        if (++calls < 3) throw new Error("x");
      },
      { ...noWait, onRetry: (attempt) => seen.push(attempt) },
    );
    expect(seen).toEqual([1, 2]);
  });
});
