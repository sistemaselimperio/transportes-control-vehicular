import { describe, expect, it } from "vitest";
import { PREOPERATIONAL_CHECKLIST } from "./preoperational-checklist";
import { HIGH_PRIORITY_ITEM_IDS, HIGH_PRIORITY_SECTION_IDS, highPriorityFailures } from "./high-priority";

const mal = { status: "MAL" as const };
const bien = { status: "BIEN" as const };

describe("HIGH_PRIORITY_SECTION_IDS", () => {
  it("lists the six mechanical sections in form order", () => {
    expect(HIGH_PRIORITY_SECTION_IDS).toEqual(["brakes", "tires", "steering", "lights", "engine", "cabin"]);
  });

  it("collects every item id of those sections only", () => {
    expect(HIGH_PRIORITY_ITEM_IDS).toContain("brakes.pedal");
    expect(HIGH_PRIORITY_ITEM_IDS).toContain("cabin.horn");
    expect(HIGH_PRIORITY_ITEM_IDS).not.toContain("documents.soat");
    const expected = PREOPERATIONAL_CHECKLIST.filter((s) => HIGH_PRIORITY_SECTION_IDS.includes(s.id)).flatMap((s) =>
      s.items.map((i) => i.id),
    );
    expect([...HIGH_PRIORITY_ITEM_IDS]).toEqual(expected);
  });
});

describe("highPriorityFailures", () => {
  it("is empty when nothing failed", () => {
    expect(highPriorityFailures({})).toEqual([]);
    expect(highPriorityFailures({ "brakes.pedal": bien })).toEqual([]);
  });

  it("counts a non-critical item of a high-priority section", () => {
    expect(highPriorityFailures({ "cabin.horn": mal })).toEqual([{ id: "cabin", title: "Cabina", items: ["Pito"] }]);
  });

  it("ignores failures in documents, driver and other sections", () => {
    expect(
      highPriorityFailures({ "documents.soat": mal, "driver.rested": mal, "visibility.mirrors": mal, "ppe.helmet": mal }),
    ).toEqual([]);
  });

  it("ignores items that were left blank", () => {
    expect(highPriorityFailures({ "brakes.pedal": bien, "brakes.parking": bien })).toEqual([]);
  });

  it("lists each failed section once, in form order, with its failed items in form order", () => {
    expect(
      highPriorityFailures({ "lights.brake": mal, "brakes.parking": mal, "brakes.pedal": mal, "engine.oil-level": mal }),
    ).toEqual([
      { id: "brakes", title: "Frenos", items: ["Freno de pedal", "Freno de parqueo / emergencia"] },
      { id: "lights", title: "Luces", items: ["Stop"] },
      { id: "engine", title: "Motor y líquidos", items: ["Nivel de aceite"] },
    ]);
  });

  it("ignores unknown item ids", () => {
    expect(highPriorityFailures({ "brakes.nope": mal, "unknown.thing": mal })).toEqual([]);
  });
});
