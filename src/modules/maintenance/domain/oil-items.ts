/** One supply used in an oil change, e.g. 48 × "CUARTOS DELO 15W40". */
export interface OilItem {
  quantity: number;
  detail: string;
}

/** The editable data of a registered oil change (what its edit form prefills). */
export interface OilChangeValues {
  id: number;
  date: string;
  km: number | null;
  intervalMonths: number | null;
  intervalKm: number | null;
  price: number | null;
  notes: string | null;
  items: OilItem[];
}
