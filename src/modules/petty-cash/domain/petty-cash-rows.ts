import type { IsoDate } from "@/modules/shared/domain/dates";
import type { ResponsibilityType } from "./expense";
import type { LedgerBalance } from "./ledger-balances";

export interface ExpenseRow {
  id: number;
  detail: string;
  invoiceNumber: string | null;
  /** Code or reference typed by hand. */
  efk: string | null;
  /** The issuing supplier's NIT, digits only; shown with `formatNit`. Null until an AI import is reviewed. */
  nit: string | null;
  /** Name of the issuing supplier. */
  supplierName: string | null;
  /** The party the invoice is billed to. */
  company: string | null;
  responsibilityType: ResponsibilityType | null;
  /** Set while the linked fleet vehicle exists. */
  vehicleId: number | null;
  vehicleLabel: string | null;
  /** Null counts as zero in the totals. */
  value: number | null;
  attachment: { name: string; mimeType: string } | null;
  needsReview: boolean;
  possibleDuplicate: boolean;
}

/** One ledger with its derived balances and expenses: what the sheet screen shows. */
export interface LedgerSheet {
  balance: LedgerBalance;
  expenses: ExpenseRow[];
  /** The earliest ledger: its opening balance is typed by hand, so its form shows the field. */
  isFirst: boolean;
  /** Every ledger of the user, to tell whether an edited date makes this one the first. */
  ledgerKeys: Array<{ id: number; date: IsoDate }>;
}

/** An issuing supplier known by its NIT. */
export interface SupplierRow {
  nit: string;
  supplierName: string | null;
  responsibilityType: ResponsibilityType | null;
}

/** A fleet vehicle the expense form suggests. */
export interface VehicleOption {
  plate: string;
  className: string;
}

/** An owner (company or person) an invoice can be billed to. */
export interface OwnerOption {
  id: number;
  name: string;
}

export interface LedgerFigures {
  initialBalance: number;
  ledgers: Array<{ id: number; number: number; date: IsoDate; compenseAmount: number; expensesTotal: number }>;
}
