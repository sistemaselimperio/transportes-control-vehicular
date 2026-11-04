/**
 * The daily pre-operational checklist of form FO-PESV-016, defined once. Item ids are stable: they
 * are the keys stored in the `answers` of every saved inspection, so never rename or reuse one.
 */
export type ChecklistItem = {
  id: string;
  label: string;
  /** Punto crítico (★): a MAL here means the vehicle does not leave. */
  critical: boolean;
};

export type ChecklistSection = {
  id: string;
  title: string;
  /** Extra line under the title, e.g. what the items refer to. */
  hint?: string;
  /** Only applies to a tractor-trailer (mula); the form can mark it "no aplica". */
  muleOnly?: boolean;
  items: readonly ChecklistItem[];
};

const critical = (id: string, label: string): ChecklistItem => ({ id, label, critical: true });
const regular = (id: string, label: string): ChecklistItem => ({ id, label, critical: false });

export const FORM_CODE = "FO-PESV-016";
export const FORM_VERSION = "01";
export const FORM_ISSUED = "29/10/2026";

export const PREOPERATIONAL_CHECKLIST: readonly ChecklistSection[] = [
  {
    id: "documents",
    title: "Documentos",
    hint: "Vigentes y en el vehículo",
    items: [
      critical("documents.driver-license", "Licencia de conducción"),
      critical("documents.vehicle-license", "Licencia de tránsito"),
      critical("documents.soat", "SOAT"),
      critical("documents.technical-review", "Revisión técnico-mecánica"),
      critical("documents.liability-policy", "Póliza de responsabilidad civil"),
    ],
  },
  {
    id: "driver",
    title: "Conductor",
    items: [
      critical("driver.rested", "Descansé y me siento bien para manejar"),
      critical("driver.no-substances", "No he consumido alcohol ni sustancias"),
    ],
  },
  {
    id: "brakes",
    title: "Frenos",
    items: [
      critical("brakes.pedal", "Freno de pedal"),
      critical("brakes.parking", "Freno de parqueo / emergencia"),
      critical("brakes.air-leaks", "Sin fugas de aire (no se oye escape)"),
    ],
  },
  {
    id: "tires",
    title: "Llantas",
    items: [
      critical("tires.front", "Llantas delanteras sin cortes ni bombas"),
      critical("tires.rear", "Llantas traseras sin cortes ni bombas"),
      critical("tires.tread-pressure", "Labrado visible y presión correcta"),
      regular("tires.spare", "Llanta de repuesto en buen estado"),
    ],
  },
  {
    id: "steering",
    title: "Dirección",
    items: [critical("steering.play", "Sin juego ni ruidos al girar")],
  },
  {
    id: "lights",
    title: "Luces",
    items: [
      critical("lights.high-low", "Luces altas y bajas"),
      critical("lights.brake", "Stop"),
      critical("lights.turn-signals", "Direccionales delanteras y traseras"),
      regular("lights.hazard", "Luces de parqueo / estacionarias"),
      regular("lights.reverse", "Luz y alarma de reversa"),
    ],
  },
  {
    id: "visibility",
    title: "Visibilidad",
    items: [
      critical("visibility.mirrors", "Espejos laterales"),
      regular("visibility.windshield", "Parabrisas sin fisuras"),
      regular("visibility.wipers", "Limpiabrisas"),
    ],
  },
  {
    id: "engine",
    title: "Motor y líquidos",
    items: [
      regular("engine.oil-level", "Nivel de aceite"),
      regular("engine.coolant-level", "Nivel de refrigerante"),
      regular("engine.brake-fluid-level", "Nivel de líquido de frenos"),
      critical("engine.no-leaks", "Sin fugas de aceite ni combustible"),
      regular("engine.belts-hoses", "Correas y mangueras sin daños"),
      critical("engine.warning-lights", "Testigos del tablero apagados"),
    ],
  },
  {
    id: "cabin",
    title: "Cabina",
    items: [
      critical("cabin.seat-belt", "Cinturón de seguridad"),
      regular("cabin.horn", "Pito"),
      regular("cabin.doors-seat", "Puertas y asiento asegurados"),
    ],
  },
  {
    id: "mule",
    title: "Solo mula",
    muleOnly: true,
    items: [
      critical("mule.fifth-wheel", "Quinta rueda y pin asegurados"),
      critical("mule.trailer-connections", "Conexiones de aire y luz del remolque"),
      regular("mule.landing-gear", "Patas de aterrizaje recogidas"),
      regular("mule.cargo-secured", "Carga amarrada y carpada"),
    ],
  },
  {
    id: "road-kit",
    title: "Equipo de carretera",
    items: [
      regular("road-kit.jack", "Gato"),
      regular("road-kit.wheel-wrench", "Cruceta"),
      regular("road-kit.triangles", "Dos señales reflectivas (triángulos)"),
      regular("road-kit.first-aid", "Botiquín"),
      regular("road-kit.extinguisher", "Extintor cargado y vigente"),
      regular("road-kit.chocks", "Dos tacos (calzas)"),
      regular("road-kit.toolbox", "Caja de herramientas básicas"),
      regular("road-kit.flashlight", "Linterna"),
    ],
  },
  {
    id: "ppe",
    title: "Elementos de protección personal",
    items: [
      regular("ppe.helmet", "Casco"),
      regular("ppe.glasses", "Gafas"),
      regular("ppe.boots", "Botas de seguridad"),
      regular("ppe.vest", "Chaleco reflectivo"),
      regular("ppe.gloves", "Guantes"),
    ],
  },
  {
    id: "prohibited",
    title: "Elementos no permitidos",
    items: [critical("prohibited.illegal-items", "Sin elementos ilegales a bordo")],
  },
];

/** Every item of every section, in form order. */
export const ALL_CHECKLIST_ITEMS: readonly ChecklistItem[] = PREOPERATIONAL_CHECKLIST.flatMap((s) => s.items);

const ITEM_BY_ID = new Map(ALL_CHECKLIST_ITEMS.map((item) => [item.id, item]));

export function findChecklistItem(id: string): ChecklistItem | undefined {
  return ITEM_BY_ID.get(id);
}

/** "3" for the third section, "3.2" for its second item: how the form and the printout number them. */
export function sectionNumber(sectionIndex: number): string {
  return String(sectionIndex + 1);
}

export function itemNumber(sectionIndex: number, itemIndex: number): string {
  return `${sectionIndex + 1}.${itemIndex + 1}`;
}
