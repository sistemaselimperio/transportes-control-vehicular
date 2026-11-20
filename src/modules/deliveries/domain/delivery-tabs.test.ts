import { describe, expect, it } from "vitest";
import { DELIVERY_TABS, parseDeliveryTab } from "./delivery-tabs";

describe("parseDeliveryTab", () => {
  it("keeps a valid tab", () => {
    expect(parseDeliveryTab("historial")).toBe("historial");
  });

  it("opens Hoy for the removed registrar tab and anything unknown", () => {
    expect(parseDeliveryTab("registrar")).toBe("hoy");
    expect(parseDeliveryTab(undefined)).toBe("hoy");
    expect(DELIVERY_TABS).not.toContain("registrar");
  });
});
