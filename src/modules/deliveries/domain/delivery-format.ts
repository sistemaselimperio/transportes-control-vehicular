import { formatDecimal } from "@/modules/shared/domain/decimal";
import { tonsFromKg } from "./delivery-rules";

/** Kilograms as typed: "1.250,5". */
export const formatKg = (kg: number): string => formatDecimal(kg, 2);

/** Tons derived from the kilograms (never stored): 2000 kg is "2". */
export const formatTons = (kg: number): string => formatDecimal(tonsFromKg(kg), 3);

/** Bags (bultos) as a whole number: "1.200". */
export const formatBags = (quantity: number): string => formatDecimal(quantity, 0);
