export const DELIVERY_TABS = ["hoy", "registrar", "historial", "alertas", "resumen"] as const;
export type DeliveryTab = (typeof DELIVERY_TABS)[number];

export const DELIVERY_TAB_LABELS: Record<DeliveryTab, string> = {
  hoy: "Hoy",
  registrar: "Registrar",
  historial: "Historial",
  alertas: "Alertas",
  resumen: "Resumen",
};

/** The tab named by `?tab=`; anything unknown opens "Hoy". */
export const parseDeliveryTab = (value: unknown): DeliveryTab =>
  typeof value === "string" && (DELIVERY_TABS as readonly string[]).includes(value) ? (value as DeliveryTab) : "hoy";
