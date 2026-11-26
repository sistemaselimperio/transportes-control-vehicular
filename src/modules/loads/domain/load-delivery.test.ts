import { describe, expect, it } from "vitest";
import { loadDeliveryState, type DeliveryOrder } from "./load-delivery";

const order = (over: Partial<DeliveryOrder> = {}): DeliveryOrder => ({ id: 13, status: "cargado", ...over });

describe("loadDeliveryState", () => {
  it("has no delivery for a load without orders", () => {
    expect(loadDeliveryState([], [])).toEqual({ deliverable: false, delivered: false });
  });

  it("is deliverable when every order is loaded and has no balance", () => {
    expect(loadDeliveryState([order(), order({ id: 14 })], [])).toEqual({ deliverable: true, delivered: false });
  });

  it("explains the first order that is not loaded completely", () => {
    const state = loadDeliveryState([order(), order({ id: 14, status: "pendiente" })], []);
    expect(state).toEqual({ deliverable: false, delivered: false, reason: "El pedido #14 aún no está cargado completo." });
  });

  it("explains the first balance still to carry", () => {
    const state = loadDeliveryState([order()], [{ orderId: 13, bags: 200, trips: [{ bags: 25 }] }]);
    expect(state).toEqual({ deliverable: false, delivered: false, reason: "El pedido #13 tiene 175 bultos de saldo por llevar." });
  });

  it("is delivered once every order is delivered", () => {
    const state = loadDeliveryState([order({ status: "entregado" }), order({ id: 14, status: "entregado" })], []);
    expect(state).toEqual({ deliverable: false, delivered: true });
  });

  it("stays deliverable for the orders left when some are already delivered", () => {
    const state = loadDeliveryState([order({ status: "entregado" }), order({ id: 14 })], []);
    expect(state).toEqual({ deliverable: true, delivered: false });
  });

  it("is blocked by the balance of an order that is not delivered yet", () => {
    const state = loadDeliveryState([order({ status: "entregado" }), order({ id: 14 })], [{ orderId: 14, bags: 5, trips: [] }]);
    expect(state.deliverable).toBe(false);
    expect(state.reason).toBe("El pedido #14 tiene 5 bultos de saldo por llevar.");
  });
});
