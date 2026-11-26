import { describe, expect, it } from "vitest";
import { RELOAD_GUARD_MS, shouldReloadForStaleDeployment } from "./stale-deployment";

const NOW = 1_800_000_000_000;

describe("shouldReloadForStaleDeployment", () => {
  it("reloads when an action of an older deployment was not found", () => {
    expect(shouldReloadForStaleDeployment(true, null, NOW)).toBe(true);
  });

  it("never reloads for any other error", () => {
    expect(shouldReloadForStaleDeployment(false, null, NOW)).toBe(false);
  });

  it("does not reload again right after a reload, so a real mismatch cannot loop", () => {
    expect(shouldReloadForStaleDeployment(true, String(NOW - 5_000), NOW)).toBe(false);
  });

  it("reloads again once the guard window has passed", () => {
    expect(shouldReloadForStaleDeployment(true, String(NOW - RELOAD_GUARD_MS - 1), NOW)).toBe(true);
  });

  it("ignores an unreadable stored timestamp", () => {
    expect(shouldReloadForStaleDeployment(true, "garbage", NOW)).toBe(true);
  });
});
