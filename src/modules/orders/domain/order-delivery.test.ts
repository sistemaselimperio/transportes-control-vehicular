import { describe, expect, it } from "vitest";
import { canDeliverOrder, deliveryBlockReason, type DeliveryBalance } from "./order-delivery";

const balance = (over: Partial<DeliveryBalance> = {}): DeliveryBalance => ({ orderId: 13, bags: 200, trips: [], ...over });

describe("deliveryBlockReason", () => {
  it("lets a loaded order without balances be delivered", () => {
    expect(deliveryBlockReason({ id: 13, status: "cargado" }, [])).toBeNull();
    expect(canDeliverOrder({ id: 13, status: "cargado" }, [])).toBe(true);
  });

  it("refuses an order that is not completely loaded", () => {
    expect(deliveryBlockReason({ id: 13, status: "pendiente" }, [])).toBe("El pedido #13 aún no está cargado completo.");
    expect(canDeliverOrder({ id: 13, status: "pendiente" }, [])).toBe(false);
  });

  it("refuses an annulled order", () => {
    expect(deliveryBlockReason({ id: 13, status: "anulado" }, [])).toBe("El pedido #13 está anulado.");
  });

  it("refuses an order that is already delivered", () => {
    expect(deliveryBlockReason({ id: 13, status: "entregado" }, [])).toBe("El pedido #13 ya está entregado.");
  });

  it("names the bags of the balance still to carry", () => {
    const reason = deliveryBlockReason({ id: 13, status: "cargado" }, [balance({ trips: [{ bags: 25 }] })]);
    expect(reason).toBe("El pedido #13 tiene 175 bultos de saldo por llevar.");
  });

  it("uses the singular for one bag", () => {
    expect(deliveryBlockReason({ id: 13, status: "cargado" }, [balance({ bags: 1 })])).toBe(
      "El pedido #13 tiene 1 bulto de saldo por llevar.",
    );
  });

  it("adds up several balances of the same order", () => {
    const reason = deliveryBlockReason({ id: 13, status: "cargado" }, [balance({ bags: 10 }), balance({ bags: 5 })]);
    expect(reason).toBe("El pedido #13 tiene 15 bultos de saldo por llevar.");
  });

  it("ignores balances of other orders and balances fully carried", () => {
    const balances = [balance({ orderId: 99, bags: 50 }), balance({ trips: [{ bags: 200 }] })];
    expect(deliveryBlockReason({ id: 13, status: "cargado" }, balances)).toBeNull();
  });
});
