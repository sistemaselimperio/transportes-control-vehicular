export const DELIVERY_TABS = ["por-entregar", "historial", "alertas", "resumen"] as const;
export type DeliveryTab = (typeof DELIVERY_TABS)[number];

export const DELIVERY_TAB_LABELS: Record<DeliveryTab, string> = {
  "por-entregar": "Por entregar",
  historial: "Historial",
  alertas: "Alertas",
  resumen: "Resumen",
};

/** The tab named by `?tab=`; the old "hoy" and anything unknown open "Por entregar". */
export const parseDeliveryTab = (value: unknown): DeliveryTab =>
  typeof value === "string" && (DELIVERY_TABS as readonly string[]).includes(value) ? (value as DeliveryTab) : "por-entregar";
