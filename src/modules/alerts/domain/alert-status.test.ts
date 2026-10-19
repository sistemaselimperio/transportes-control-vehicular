import { describe, expect, it } from "vitest";
import {
  documentStatus,
  vehicleOverallStatus,
  worstStatus,
} from "./alert-status";

const today = "2026-06-15";

describe("documentStatus", () => {
  it("is expired when the expiration date is before today", () => {
    expect(documentStatus({ expiresOn: "2026-06-14", today })).toBe("expired");
  });
  it("is warning when it expires today", () => {
    expect(documentStatus({ expiresOn: "2026-06-15", today })).toBe("warning");
  });
  it("is warning at exactly 30 days", () => {
    expect(documentStatus({ expiresOn: "2026-07-15", today })).toBe("warning");
  });
  it("is ok at 31 days", () => {
    expect(documentStatus({ expiresOn: "2026-07-16", today })).toBe("ok");
  });
  it("is not_applicable when flagged, regardless of date", () => {
    expect(
      documentStatus({ expiresOn: "2020-01-01", notApplicable: true, today }),
    ).toBe("not_applicable");
  });
  it("is warning when applicable but there is no date on record", () => {
    expect(documentStatus({ expiresOn: null, today })).toBe("warning");
  });
});

describe("worstStatus", () => {
  it("ranks expired > warning > ok > not_applicable > inactive", () => {
    expect(worstStatus(["ok", "expired", "warning"])).toBe("expired");
    expect(worstStatus(["ok", "warning"])).toBe("warning");
    expect(worstStatus(["ok", "not_applicable"])).toBe("ok");
    expect(worstStatus(["not_applicable", "inactive"])).toBe("not_applicable");
  });
  it("returns not_applicable for an empty list", () => {
    expect(worstStatus([])).toBe("not_applicable");
  });
});

describe("vehicleOverallStatus", () => {
  it("is the worst of its alerts", () => {
    expect(
      vehicleOverallStatus({
        vehicleStatus: "ACTIVE",
        alerts: ["ok", "warning", "ok"],
      }),
    ).toBe("warning");
  });
  it("is inactive for sold vehicles whatever the alerts say", () => {
    expect(
      vehicleOverallStatus({ vehicleStatus: "SOLD", alerts: ["expired"] }),
    ).toBe("inactive");
  });
  it("keeps document alerts for idle vehicles", () => {
    expect(
      vehicleOverallStatus({
        vehicleStatus: "IDLE",
        alerts: ["inactive", "expired"],
      }),
    ).toBe("expired");
  });
});
