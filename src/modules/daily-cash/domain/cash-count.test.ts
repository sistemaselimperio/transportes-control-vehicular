import { describe, expect, it } from "vitest";
import { countedTotal, DENOMINATIONS, parseCounts } from "./cash-count";

describe("DENOMINATIONS", () => {
  it("lists every Colombian bill and coin of the sheet, largest first", () => {
    expect([...DENOMINATIONS]).toEqual([100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50]);
  });
});

describe("countedTotal", () => {
  it("is zero for an empty count", () => {
    expect(countedTotal({})).toBe(0);
  });

  it("adds denomination times quantity", () => {
    expect(countedTotal({ 100000: 3, 50000: 1, 500: 4 })).toBe(300000 + 50000 + 2000);
  });

  it("ignores quantities of denominations that do not exist", () => {
    expect(countedTotal({ 100000: 1, 7: 99 })).toBe(100000);
  });
});

describe("parseCounts", () => {
  it("keeps only positive quantities, keyed by denomination", () => {
    expect(parseCounts({ 100000: "2", 50000: "0", 20000: "" })).toEqual({ 100000: 2 });
  });

  it("accepts numbers as well as text", () => {
    expect(parseCounts({ 1000: 5 })).toEqual({ 1000: 5 });
  });

  it("refuses an unknown denomination", () => {
    expect(() => parseCounts({ 7: "1" })).toThrow(/denominación/i);
  });

  it("refuses a negative or fractional quantity", () => {
    expect(() => parseCounts({ 1000: "-1" })).toThrow(/cantidad/i);
    expect(() => parseCounts({ 1000: "1.5" })).toThrow(/cantidad/i);
    expect(() => parseCounts({ 1000: "abc" })).toThrow(/cantidad/i);
  });

  it("accepts up to 100000 and refuses more, so totals stay within int4", () => {
    expect(parseCounts({ 100000: "100000" })).toEqual({ 100000: 100000 });
    expect(() => parseCounts({ 100000: "100001" })).toThrow(/cantidad/i);
  });

  it("refuses an absurd quantity", () => {
    expect(() => parseCounts({ 1000: "100000000" })).toThrow(/cantidad/i);
  });
});
