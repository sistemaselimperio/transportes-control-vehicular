const PESOS = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

/** "$ 325.498". */
export const formatCop = (value: number): string => PESOS.format(value);
