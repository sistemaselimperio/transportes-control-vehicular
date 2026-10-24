import { describe, expect, it } from "vitest";
import { oilItemsField } from "./oil-items-schema";

describe("oilItemsField", () => {
  it("defaults to no supplies", () => {
    expect(oilItemsField.parse(undefined)).toEqual([]);
    expect(oilItemsField.parse("")).toEqual([]);
    expect(oilItemsField.parse("[]")).toEqual([]);
  });

  it("parses the JSON the form sends, trimming the detail", () => {
    const raw = JSON.stringify([
      { quantity: "48", detail: "  CUARTOS DELO 15W40 " },
      { quantity: "1", detail: "FILTRO ACEITE FL 14000 NN" },
    ]);
    expect(oilItemsField.parse(raw)).toEqual([
      { quantity: 48, detail: "CUARTOS DELO 15W40" },
      { quantity: 1, detail: "FILTRO ACEITE FL 14000 NN" },
    ]);
  });

  it("accepts a decimal quantity with a comma or a dot", () => {
    const raw = JSON.stringify([
      { quantity: "2,5", detail: "GALONES" },
      { quantity: "0.5", detail: "LITROS" },
    ]);
    expect(oilItemsField.parse(raw).map((i) => i.quantity)).toEqual([2.5, 0.5]);
  });

  it("drops rows that are completely blank", () => {
    const raw = JSON.stringify([
      { quantity: "", detail: " " },
      { quantity: "1", detail: "FILTRO" },
    ]);
    expect(oilItemsField.parse(raw)).toEqual([{ quantity: 1, detail: "FILTRO" }]);
  });

  it("rejects a row with a detail but no valid quantity", () => {
    const raw = JSON.stringify([{ quantity: "", detail: "FILTRO" }]);
    expect(() => oilItemsField.parse(raw)).toThrow("cantidad");
    expect(() => oilItemsField.parse(JSON.stringify([{ quantity: "0", detail: "FILTRO" }]))).toThrow("cantidad");
  });

  it("rejects a row with a quantity but no detail", () => {
    expect(() => oilItemsField.parse(JSON.stringify([{ quantity: "2", detail: "" }]))).toThrow("insumo");
  });

  it("rejects malformed JSON", () => {
    expect(() => oilItemsField.parse("{nope")).toThrow("insumos");
  });
});
