import type { LoadSupplier } from "@/modules/loads/domain/load-rules";
import { matchesQuery } from "@/modules/shared/domain/search-key";

/** A product of the supplier catalog: its identity is the supplier plus the supplier's own code. */
export interface CatalogProduct {
  id: number;
  code: string;
  name: string;
  supplier: LoadSupplier;
}

/** "code · name"; a legacy product (typed inline, no code) shows its name alone. */
export const productLabel = (product: { code: string | null; name: string }): string =>
  product.code === null ? product.name : `${product.code} · ${product.name}`;

/** "supplier · code · name": the label where products of several suppliers are listed together. */
export const productLabelWithSupplier = (product: { code: string; name: string; supplier: LoadSupplier }): string =>
  `${product.supplier} · ${productLabel(product)}`;

/** The products a load of `supplier` can carry; none while no supplier is chosen. */
export function productsOfSupplier<T extends { supplier: LoadSupplier }>(products: readonly T[], supplier: LoadSupplier | null): T[] {
  return supplier === null ? [] : products.filter((p) => p.supplier === supplier);
}

/** Products whose code, name or supplier contain every word of `query`; a blank query lists them all. */
export function searchProducts<T extends { code: string; name: string; supplier: LoadSupplier }>(
  products: readonly T[],
  query: string,
  limit = Number.POSITIVE_INFINITY,
): T[] {
  return products.filter((p) => matchesQuery([p.code, p.name, p.supplier], query)).slice(0, limit);
}

/** Port: the catalog products among `ids`; legacy products (no code) and unknown ids are left out. */
export type FindCatalogProducts = (ids: number[]) => Promise<CatalogProduct[]>;
