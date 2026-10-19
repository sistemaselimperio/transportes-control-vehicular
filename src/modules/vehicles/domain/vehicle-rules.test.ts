import { describe, expect, it } from "vitest";
import {
  assertCanAssignDriver,
  assertCanChangeStatus,
  assertCanSell,
  assertCanTransfer,
  assertEditable,
  assertKmNotDecreasing,
  closePeriod,
  RuleError,
} from "./vehicle-rules";

const TODAY = "2026-10-17";

describe("assertEditable", () => {
  it("allows non-sold vehicles", () => {
    expect(() => assertEditable("ACTIVE")).not.toThrow();
    expect(() => assertEditable("IDLE")).not.toThrow();
  });
  it("rejects sold vehicles", () => {
    expect(() => assertEditable("SOLD")).toThrow(RuleError);
  });
});

describe("assertKmNotDecreasing", () => {
  it("accepts equal or higher km", () => {
    expect(() => assertKmNotDecreasing(1000, 1000)).not.toThrow();
    expect(() => assertKmNotDecreasing(1000, 1500)).not.toThrow();
  });
  it("accepts any km when there is no current km", () => {
    expect(() => assertKmNotDecreasing(null, 10)).not.toThrow();
  });
  it("rejects lower km and mentions the current value", () => {
    expect(() => assertKmNotDecreasing(359174, 100)).toThrow(/359\.174/);
  });
});

describe("assertCanChangeStatus", () => {
  it("rejects changing a sold vehicle", () => {
    expect(() => assertCanChangeStatus("SOLD", "ACTIVE")).toThrow(RuleError);
  });
  it("rejects the same status", () => {
    expect(() => assertCanChangeStatus("IDLE", "IDLE")).toThrow(RuleError);
  });
  it("rejects SOLD as a target (sales have their own flow)", () => {
    expect(() => assertCanChangeStatus("ACTIVE", "SOLD")).toThrow(RuleError);
  });
  it("allows a different non-sold status", () => {
    expect(() => assertCanChangeStatus("ACTIVE", "IN_WORKSHOP")).not.toThrow();
  });
});

describe("assertCanTransfer", () => {
  const base = { status: "ACTIVE", currentOwnerId: 1, targetOwnerId: 2, date: TODAY, today: TODAY } as const;
  it("allows a transfer to a different owner", () => {
    expect(() => assertCanTransfer(base)).not.toThrow();
  });
  it("allows a vehicle without owner", () => {
    expect(() => assertCanTransfer({ ...base, currentOwnerId: null })).not.toThrow();
  });
  it("rejects transferring to the current owner", () => {
    expect(() => assertCanTransfer({ ...base, targetOwnerId: 1 })).toThrow(RuleError);
  });
  it("rejects sold vehicles", () => {
    expect(() => assertCanTransfer({ ...base, status: "SOLD" })).toThrow(RuleError);
  });
  it("rejects future dates", () => {
    expect(() => assertCanTransfer({ ...base, date: "2026-10-18" })).toThrow(/futura/);
  });
});

describe("assertCanSell", () => {
  it("allows selling an active vehicle today", () => {
    expect(() => assertCanSell({ status: "ACTIVE", date: TODAY, today: TODAY })).not.toThrow();
  });
  it("rejects selling an already sold vehicle", () => {
    expect(() => assertCanSell({ status: "SOLD", date: TODAY, today: TODAY })).toThrow(RuleError);
  });
  it("rejects future sale dates", () => {
    expect(() => assertCanSell({ status: "IDLE", date: "2027-01-01", today: TODAY })).toThrow(
      RuleError,
    );
  });
});

describe("assertCanAssignDriver", () => {
  const base = { status: "ACTIVE", currentDriverId: 5, targetDriverId: 6, date: TODAY, today: TODAY } as const;
  it("allows a different driver", () => {
    expect(() => assertCanAssignDriver(base)).not.toThrow();
  });
  it("allows a first driver", () => {
    expect(() => assertCanAssignDriver({ ...base, currentDriverId: null })).not.toThrow();
  });
  it("rejects the driver already assigned", () => {
    expect(() => assertCanAssignDriver({ ...base, targetDriverId: 5 })).toThrow(RuleError);
  });
  it("rejects sold vehicles", () => {
    expect(() => assertCanAssignDriver({ ...base, status: "SOLD" })).toThrow(RuleError);
  });
});

describe("closePeriod", () => {
  it("closes at the given date", () => {
    expect(closePeriod("2026-01-01", "2026-06-01")).toEqual({
      fromDate: "2026-01-01",
      toDate: "2026-06-01",
    });
  });
  it("pulls the start back when the close date precedes it (placeholder import dates)", () => {
    expect(closePeriod("2026-10-17", "2026-03-05")).toEqual({
      fromDate: "2026-03-05",
      toDate: "2026-03-05",
    });
  });
});
