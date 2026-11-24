import { describe, expect, it } from "vitest";
import { DELIVERY_TABS, parseDeliveryTab } from "./delivery-tabs";

describe("parseDeliveryTab", () => {
  it("keeps a valid tab", () => {
    expect(parseDeliveryTab("historial")).toBe("historial");
    expect(parseDeliveryTab("por-entregar")).toBe("por-entregar");
  });

  it("maps the old hoy tab to Por entregar so old links keep working", () => {
    expect(parseDeliveryTab("hoy")).toBe("por-entregar");
    expect(DELIVERY_TABS).not.toContain("hoy");
  });

  it("opens Por entregar for the removed registrar tab and anything unknown", () => {
    expect(parseDeliveryTab("registrar")).toBe("por-entregar");
    expect(parseDeliveryTab(undefined)).toBe("por-entregar");
    expect(DELIVERY_TABS).not.toContain("registrar");
  });
});
