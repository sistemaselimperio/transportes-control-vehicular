import { describe, expect, it, vi } from "vitest";
import type { FleetCandidates } from "../domain/fleet-matching";
import { CoteroError } from "../domain/settlement-rules";
import { createCoteroCommands, type CoteroPorts, type CoteroStorage, type SettlementCandidate } from "./cotero-commands";
import type { ReceiptBatchItem } from "./cotero-schemas";

const USER = "user-1";
const UUID = "123e4567-e89b-42d3-a456-426614174000";

const item = (over: Partial<ReceiptBatchItem> = {}): ReceiptBatchItem => ({
  receiptNumber: "T 0248",
  date: "2026-11-11",
  destination: "Finca La Esperanza",
  remissions: "44092",
  tons: "33.213",
  vehiclePlate: "ABC-123",
  trailerPlate: "",
  coteroName: "Juan Perez",
  coteroDocument: "1056507092",
  driverName: "Pedro",
  amount: "$325'498",
  filePath: `recibos/2026/11/${UUID}.jpg`,
  pageNumber: 1,
  ...over,
});

const candidate = (over: Partial<SettlementCandidate> = {}): SettlementCandidate => ({
  id: 1,
  status: "pending",
  coteroKey: "doc:1056507092",
  coteroName: "Juan Perez",
  coteroDocument: "1056507092",
  amount: 100000,
  date: "2026-11-01",
  ...over,
});

const FLEET: FleetCandidates = {
  vehicles: [
    { id: 11, plate: "ABC-123", isTrailer: false },
    { id: 12, plate: "S-88490", isTrailer: true },
  ],
  drivers: [{ id: 21, name: "Pedro" }],
};

function ports(over: Partial<CoteroPorts> = {}): CoteroPorts {
  return {
    loadFleet: vi.fn(async () => FLEET),
    listTariffs: vi.fn(async () => [{ validFrom: "2026-01-01", pricePerTon: 9800 }]),
    findExistingNumbers: vi.fn(async () => [] as string[]),
    insertReceipts: vi.fn(async (_userId: string, rows: unknown[]) => rows.map((_, i) => 100 + i)),
    findReceipt: vi.fn(async () => ({ id: 5, status: "pending" as const, filePath: `recibos/2026/11/${UUID}.jpg` as string | null, pageNumber: 2 as number | null, settlementId: null as number | null })),
    updateReceipt: vi.fn(async () => undefined),
    deleteReceipt: vi.fn(async () => ({ removedProofPath: null }) as { removedProofPath: string | null } | null),
    countReceiptsWithFile: vi.fn(async () => 0),
    insertTariff: vi.fn(async () => undefined),
    findReceiptsForSettlement: vi.fn(async () => [candidate({ id: 1 }), candidate({ id: 2, amount: 50000 })]),
    upsertProfile: vi.fn(async () => undefined),
    createSettlement: vi.fn(async () => ({ id: 70, number: 7 }) as { id: number; number: number } | null),
    findSettlement: vi.fn(async () => ({ id: 3, status: "open" as const })),
    annulSettlement: vi.fn(async () => true),
    deleteSettlement: vi.fn(async () => ({ proofPath: null }) as { proofPath: string | null } | null),
    countSettlementsWithProof: vi.fn(async () => 0),
    paySettlement: vi.fn(async () => true),
    ...over,
  };
}

const storage = (): CoteroStorage => ({ remove: vi.fn(async () => undefined) });

describe("createReceipts", () => {
  it("stores normalized receipts with the tariff snapshot", async () => {
    const p = ports();
    const created = await createCoteroCommands(p, storage()).createReceipts(USER, [item()]);
    expect(created).toEqual({ count: 1, ids: [100] });
    expect(p.insertReceipts).toHaveBeenCalledWith(USER, [
      expect.objectContaining({
        receiptNumber: "T-0248",
        vehiclePlate: "ABC123",
        tons: 33.213,
        amount: 325498,
        coteroKey: "doc:1056507092",
        tariffPerTon: 9800,
        expectedAmount: 325487,
        amountMismatch: false,
        filePath: `recibos/2026/11/${UUID}.jpg`,
        pageNumber: 1,
      }),
    ]);
  });

  it("stores the fleet references and the snapshot as the app has them", async () => {
    const p = ports();
    await createCoteroCommands(p, storage()).createReceipts(USER, [item({ vehiclePlate: "abc123", trailerPlate: "s 88490", driverName: " pedro " })]);
    expect(p.insertReceipts).toHaveBeenCalledWith(USER, [
      expect.objectContaining({ vehicleId: 11, trailerId: 12, driverId: 21, vehiclePlate: "ABC123", trailerPlate: "S88490", driverName: "Pedro" }),
    ]);
  });

  it("stores no trailer reference when there is no trailer", async () => {
    const p = ports();
    await createCoteroCommands(p, storage()).createReceipts(USER, [item({ trailerPlate: "" })]);
    expect(p.insertReceipts).toHaveBeenCalledWith(USER, [expect.objectContaining({ trailerId: null, trailerPlate: null })]);
  });

  it("refuses, naming the receipt, a plate or a driver that is not in the fleet", async () => {
    const p = ports();
    const commands = createCoteroCommands(p, storage());
    await expect(commands.createReceipts(USER, [item(), item({ receiptNumber: "T 5", vehiclePlate: "ZZZ-999" })])).rejects.toThrow(/Recibo 2.*placa ZZZ-999.*flota/);
    await expect(commands.createReceipts(USER, [item({ driverName: "Zoila" })])).rejects.toThrow(/conductor Zoila/);
    await expect(commands.createReceipts(USER, [item({ trailerPlate: "ABC-123" })])).rejects.toThrow(/trailer ABC-123/);
    expect(p.insertReceipts).not.toHaveBeenCalled();
  });

  it("does not auto-correct on the server: a near miss is refused", async () => {
    const p = ports();
    await expect(createCoteroCommands(p, storage()).createReceipts(USER, [item({ vehiclePlate: "ABC-12E" })])).rejects.toThrow(/ABC-12E.*flota/);
    expect(p.insertReceipts).not.toHaveBeenCalled();
  });

  it("flags an amount far from the expected one but still stores it", async () => {
    const p = ports();
    await createCoteroCommands(p, storage()).createReceipts(USER, [item({ amount: "$500.000" })]);
    expect(p.insertReceipts).toHaveBeenCalledWith(USER, [expect.objectContaining({ amount: 500000, amountMismatch: true })]);
  });

  it("names the receipt and the field that cannot be saved", async () => {
    const p = ports();
    const commands = createCoteroCommands(p, storage());
    await expect(commands.createReceipts(USER, [item(), item({ receiptNumber: "T 5", amount: "" })])).rejects.toThrow(/Recibo 2.*Liquidación/);
    expect(p.insertReceipts).not.toHaveBeenCalled();
  });

  it("refuses a number repeated in the batch", async () => {
    const p = ports();
    await expect(createCoteroCommands(p, storage()).createReceipts(USER, [item(), item()])).rejects.toThrow(/T-0248.*repetido/);
    expect(p.insertReceipts).not.toHaveBeenCalled();
  });

  it("refuses a number already stored", async () => {
    const p = ports({ findExistingNumbers: vi.fn(async () => ["T-0248"]) });
    await expect(createCoteroCommands(p, storage()).createReceipts(USER, [item()])).rejects.toThrow(/T-0248.*ya está registrado/);
    expect(p.insertReceipts).not.toHaveBeenCalled();
  });

  it("stores no tariff snapshot when none applies", async () => {
    const p = ports({ listTariffs: vi.fn(async () => []) });
    await createCoteroCommands(p, storage()).createReceipts(USER, [item()]);
    expect(p.insertReceipts).toHaveBeenCalledWith(USER, [expect.objectContaining({ tariffPerTon: null, expectedAmount: null, amountMismatch: false })]);
  });
});

describe("updateReceipt", () => {
  it("rewrites a pending receipt, ignoring its own number in the duplicate check", async () => {
    const p = ports();
    await createCoteroCommands(p, storage()).updateReceipt(5, item());
    expect(p.findExistingNumbers).toHaveBeenCalledWith(["T-0248"], 5);
    expect(p.updateReceipt).toHaveBeenCalledWith(5, expect.objectContaining({ receiptNumber: "T-0248", tariffPerTon: 9800, filePath: `recibos/2026/11/${UUID}.jpg`, pageNumber: 2 }));
  });

  it("refuses a plate or a driver that is not in the fleet, and keeps the fleet references of the others", async () => {
    const p = ports();
    await expect(createCoteroCommands(p, storage()).updateReceipt(5, item({ driverName: "Zoila" }))).rejects.toThrow(/conductor Zoila/);
    expect(p.updateReceipt).not.toHaveBeenCalled();
    await createCoteroCommands(p, storage()).updateReceipt(5, item());
    expect(p.updateReceipt).toHaveBeenCalledWith(5, expect.objectContaining({ vehicleId: 11, trailerId: null, driverId: 21 }));
  });

  it("refuses a receipt that is settled or paid", async () => {
    for (const status of ["settled", "paid"] as const) {
      const p = ports({ findReceipt: vi.fn(async () => ({ id: 5, status, filePath: null, pageNumber: null, settlementId: null })) });
      await expect(createCoteroCommands(p, storage()).updateReceipt(5, item())).rejects.toThrow(CoteroError);
      expect(p.updateReceipt).not.toHaveBeenCalled();
    }
  });

  it("refuses a number that belongs to another receipt", async () => {
    const p = ports({ findExistingNumbers: vi.fn(async () => ["T-0248"]) });
    await expect(createCoteroCommands(p, storage()).updateReceipt(5, item())).rejects.toThrow(/ya está registrado/);
  });

  it("refuses a receipt that does not exist", async () => {
    const p = ports({ findReceipt: vi.fn(async () => null) });
    await expect(createCoteroCommands(p, storage()).updateReceipt(5, item())).rejects.toThrow(/ya no existe/);
  });
});

describe("deleteReceipt", () => {
  it("deletes a pending receipt and its file when no other receipt uses it", async () => {
    const p = ports();
    const s = storage();
    await createCoteroCommands(p, s).deleteReceipt(5);
    expect(p.deleteReceipt).toHaveBeenCalledWith(5);
    expect(s.remove).toHaveBeenCalledWith([`recibos/2026/11/${UUID}.jpg`]);
  });

  it("keeps a file that another receipt of the same page still shows", async () => {
    const s = storage();
    await createCoteroCommands(ports({ countReceiptsWithFile: vi.fn(async () => 1) }), s).deleteReceipt(5);
    expect(s.remove).not.toHaveBeenCalled();
  });

  it("deletes a receipt that belongs to a settlement, whatever its status", async () => {
    for (const status of ["settled", "paid"] as const) {
      const p = ports({ findReceipt: vi.fn(async () => ({ id: 5, status, filePath: null, pageNumber: null, settlementId: 3 })) });
      await createCoteroCommands(p, storage()).deleteReceipt(5);
      expect(p.deleteReceipt).toHaveBeenCalledWith(5);
    }
  });

  it("removes the proof of the settlement that was deleted with its last receipt", async () => {
    const proof = `recibos/comprobantes/2026/11/${UUID}.jpg`;
    const s = storage();
    const p = ports({ deleteReceipt: vi.fn(async () => ({ removedProofPath: proof })) });
    await createCoteroCommands(p, s).deleteReceipt(5);
    expect(s.remove).toHaveBeenCalledWith([proof]);
  });

  it("keeps that proof while another settlement still points at it", async () => {
    const s = storage();
    const p = ports({ deleteReceipt: vi.fn(async () => ({ removedProofPath: "x.jpg" })), countSettlementsWithProof: vi.fn(async () => 1) });
    await createCoteroCommands(p, s).deleteReceipt(5);
    expect(s.remove).not.toHaveBeenCalledWith(["x.jpg"]);
  });

  it("refuses a receipt that does not exist or vanished meanwhile", async () => {
    await expect(createCoteroCommands(ports({ findReceipt: vi.fn(async () => null) }), storage()).deleteReceipt(5)).rejects.toThrow(/ya no existe/);
    const p = ports({ deleteReceipt: vi.fn(async () => null) });
    const s = storage();
    await expect(createCoteroCommands(p, s).deleteReceipt(5)).rejects.toThrow(CoteroError);
    expect(s.remove).not.toHaveBeenCalled();
  });
});

describe("deleteSettlement", () => {
  it("deletes a settlement in any status", async () => {
    for (const status of ["open", "paid", "annulled"] as const) {
      const p = ports({ findSettlement: vi.fn(async () => ({ id: 3, status })) });
      await createCoteroCommands(p, storage()).deleteSettlement(3);
      expect(p.deleteSettlement).toHaveBeenCalledWith(3);
    }
  });

  it("removes its proof file when nothing else points at it", async () => {
    const proof = `recibos/comprobantes/2026/11/${UUID}.jpg`;
    const s = storage();
    await createCoteroCommands(ports({ deleteSettlement: vi.fn(async () => ({ proofPath: proof })) }), s).deleteSettlement(3);
    expect(s.remove).toHaveBeenCalledWith([proof]);
  });

  it("keeps a proof file that is still referenced and does nothing when there is no proof", async () => {
    const s = storage();
    await createCoteroCommands(ports({ deleteSettlement: vi.fn(async () => ({ proofPath: "x.jpg" })), countSettlementsWithProof: vi.fn(async () => 1) }), s).deleteSettlement(3);
    await createCoteroCommands(ports(), s).deleteSettlement(3);
    expect(s.remove).not.toHaveBeenCalled();
  });

  it("reports a settlement that does not exist or was deleted meanwhile", async () => {
    await expect(createCoteroCommands(ports({ findSettlement: vi.fn(async () => null) }), storage()).deleteSettlement(3)).rejects.toThrow(/no existe/);
    const p = ports({ deleteSettlement: vi.fn(async () => null) });
    await expect(createCoteroCommands(p, storage()).deleteSettlement(3)).rejects.toThrow(CoteroError);
  });
});

describe("createTariff", () => {
  it("stores the tariff", async () => {
    const p = ports();
    await createCoteroCommands(p, storage()).createTariff(USER, { validFrom: "2026-07-01", pricePerTon: 10500 });
    expect(p.insertTariff).toHaveBeenCalledWith(USER, { validFrom: "2026-07-01", pricePerTon: 10500 });
  });
});

describe("createSettlement", () => {
  const input = {
    coteroKey: "doc:1056507092",
    receiptIds: [1, 2],
    document: "",
    paymentMethod: "nequi" as const,
    paymentAccount: "3001234567",
    paidAt: "2026-11-29",
    proofPath: null as string | null,
    today: "2026-11-30",
  };

  it("settles the pending receipts of one cotero for their written total and remembers the profile", async () => {
    const p = ports();
    const result = await createCoteroCommands(p, storage()).createSettlement(USER, input);
    expect(result).toEqual({ id: 70, number: 7 });
    expect(p.createSettlement).toHaveBeenCalledWith(
      USER,
      expect.objectContaining({
        date: "2026-11-30",
        coteroKey: "doc:1056507092",
        coteroName: "Juan Perez",
        coteroDocument: "1056507092",
        paymentMethod: "nequi",
        paymentAccount: "3001234567",
        paidAt: "2026-11-29",
        proofPath: null,
        total: 150000,
        receiptIds: [1, 2],
      }),
    );
    expect(p.upsertProfile).toHaveBeenCalledWith({
      key: "doc:1056507092",
      name: "Juan Perez",
      document: "1056507092",
      paymentMethod: "nequi",
      paymentAccount: "3001234567",
    });
  });

  it("stores the payment and its proof with the settlement, which is born paid", async () => {
    const p = ports();
    const proofPath = `recibos/comprobantes/2026/11/${UUID}.jpg`;
    await createCoteroCommands(p, storage()).createSettlement(USER, { ...input, proofPath });
    expect(p.createSettlement).toHaveBeenCalledWith(USER, expect.objectContaining({ paidAt: "2026-11-29", paymentMethod: "nequi", proofPath }));
  });

  it("uses the cédula typed in the form over the ones of the receipts", async () => {
    const p = ports({ findReceiptsForSettlement: vi.fn(async () => [candidate({ id: 1, coteroDocument: null, coteroKey: "name:juanperez" })]) });
    await createCoteroCommands(p, storage()).createSettlement(USER, { ...input, coteroKey: "name:juanperez", receiptIds: [1], document: "1.056.507.092" });
    expect(p.createSettlement).toHaveBeenCalledWith(USER, expect.objectContaining({ coteroDocument: "1056507092" }));
  });

  it("refuses a cédula that is not one", async () => {
    await expect(createCoteroCommands(ports(), storage()).createSettlement(USER, { ...input, document: "12" })).rejects.toThrow(/cédula/);
  });

  it("refuses receipts that are not pending", async () => {
    const p = ports({ findReceiptsForSettlement: vi.fn(async () => [candidate({ id: 1 }), candidate({ id: 2, status: "settled" })]) });
    await expect(createCoteroCommands(p, storage()).createSettlement(USER, input)).rejects.toThrow(CoteroError);
    expect(p.createSettlement).not.toHaveBeenCalled();
  });

  it("refuses receipts of different coteros", async () => {
    const p = ports({ findReceiptsForSettlement: vi.fn(async () => [candidate({ id: 1 }), candidate({ id: 2, coteroKey: "name:otro" })]) });
    await expect(createCoteroCommands(p, storage()).createSettlement(USER, input)).rejects.toThrow(/distintos coteros/);
  });

  it("refuses receipts that no longer exist", async () => {
    const p = ports({ findReceiptsForSettlement: vi.fn(async () => [candidate({ id: 1 })]) });
    await expect(createCoteroCommands(p, storage()).createSettlement(USER, input)).rejects.toThrow(/ya no existe/);
  });

  it("reports a race lost at the database", async () => {
    const p = ports({ createSettlement: vi.fn(async () => null) });
    await expect(createCoteroCommands(p, storage()).createSettlement(USER, input)).rejects.toThrow(/ya no está pendiente/);
  });
});

describe("annulSettlement", () => {
  it("annuls an open settlement", async () => {
    const p = ports();
    await createCoteroCommands(p, storage()).annulSettlement(3);
    expect(p.annulSettlement).toHaveBeenCalledWith(3);
  });

  it("annuls a paid settlement too", async () => {
    const p = ports({ findSettlement: vi.fn(async () => ({ id: 3, status: "paid" as const })) });
    await createCoteroCommands(p, storage()).annulSettlement(3);
    expect(p.annulSettlement).toHaveBeenCalledWith(3);
  });

  it("never annuls an annulled settlement", async () => {
    const p = ports({ findSettlement: vi.fn(async () => ({ id: 3, status: "annulled" as const })) });
    await expect(createCoteroCommands(p, storage()).annulSettlement(3)).rejects.toThrow(/anulada/);
    expect(p.annulSettlement).not.toHaveBeenCalled();
  });

  it("reports a settlement that was annulled meanwhile", async () => {
    const p = ports({ annulSettlement: vi.fn(async () => false) });
    await expect(createCoteroCommands(p, storage()).annulSettlement(3)).rejects.toThrow(CoteroError);
  });

  it("refuses a settlement that does not exist", async () => {
    const p = ports({ findSettlement: vi.fn(async () => null) });
    await expect(createCoteroCommands(p, storage()).annulSettlement(3)).rejects.toThrow(/no existe/);
  });
});

describe("paySettlement", () => {
  const pay = { paidAt: "2026-12-01", paymentMethod: "efectivo" as const, proofPath: null };

  it("records the payment of an open settlement", async () => {
    const p = ports();
    await createCoteroCommands(p, storage()).paySettlement(3, pay);
    expect(p.paySettlement).toHaveBeenCalledWith(3, pay);
  });

  it("refuses a settlement that is already paid or annulled", async () => {
    for (const status of ["paid", "annulled"] as const) {
      const p = ports({ findSettlement: vi.fn(async () => ({ id: 3, status })) });
      await expect(createCoteroCommands(p, storage()).paySettlement(3, pay)).rejects.toThrow(CoteroError);
      expect(p.paySettlement).not.toHaveBeenCalled();
    }
  });
});
