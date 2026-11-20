// Реестр локаций: только данные, никакого Babylon-бутстрапа.
// Менеджер сцен (core/, слайс 1) берёт отсюда LocationDef по id.

import type { SolidBox, WorldPhase } from "../types";
import { entry } from "./layout";
import { apartment, solidsOf as apartmentSolids } from "./locations/apartment";
import { campus, solidsOf as campusSolids } from "./locations/campus";
import { hospital, solidsOf as hospitalSolids } from "./locations/hospital";
import { metroStation, solidsOf as metroSolids } from "./locations/metro-station";
import { pharmacy, solidsOf as pharmacySolids } from "./locations/pharmacy";
import { square, solidsOf as squareSolids } from "./locations/square";
import { workshop, solidsOf as workshopSolids } from "./locations/workshop";

/** Русские названия локаций для меню/карты; id — ключи LOCATION_IDS. */
export const LOCATION_TITLES: Readonly<Record<string, string>> = {
  apartment: "Твоя квартира",
  campus: "Универ и общага",
  square: "Площадь района",
  hospital: "Больница",
  pharmacy: "Аптека",
  workshop: "Мастерская",
  "metro-station": "Метро",
};

export const allLocations = [apartment, campus, square, hospital, pharmacy, workshop, metroStation];

export const LOCATION_IDS = allLocations.map((l) => l.id) as string[];

export function getLocation(id: string) {
  const loc = allLocations.find((l) => l.id === id);
  if (!loc) throw new Error(`Unknown location id: ${id}`);
  return loc;
}

/** Декларативные коллизии локации (те же боксы, что build() отдаёт в SolidRegistry). */
export function solidsOf(id: string): SolidBox[] {
  const byId: Record<string, () => SolidBox[]> = {
    apartment: apartmentSolids,
    campus: campusSolids,
    square: squareSolids,
    hospital: hospitalSolids,
    pharmacy: pharmacySolids,
    workshop: workshopSolids,
    "metro-station": metroSolids,
  };
  const fn = byId[id];
  if (!fn) throw new Error(`Unknown location id: ${id}`);
  return fn();
}

/**
 * Выходы, заблокированные по worldPhase: "from->to" → фазы, в которых переход
 * невозможен. Метро в фазах 0–1 закрыто «на ремонт» (CONTRACTS.md, NARRATIVE_BIBLE.md);
 * у двери в square стоит табличка-интеракт. Менеджер переходов обязан проверять
 * isExitOpen() перед сменой локации.
 */
export const LOCKED_EXITS: Readonly<Record<string, readonly WorldPhase[]>> = {
  "square->metro-station": [0, 1],
};

export function isExitOpen(from: string, to: string, phase: WorldPhase): boolean {
  return !(LOCKED_EXITS[`${from}->${to}`] ?? []).includes(phase);
}

/**
 * Точка прибытия быстрого перемещения (карта в меню паузы): вход у стены,
 * гарантированно вне мебели и стен (tests/world/arrival.test.ts). Южный вход
 * занят стойкой регистратуры в больнице и платформой метро — там восточный.
 */
export const ARRIVAL: Readonly<Record<string, { x: number; z: number; yaw: number }>> = {
  apartment: entry("south"),
  campus: entry("south"),
  square: entry("south"),
  hospital: entry("east"),
  pharmacy: entry("south"),
  workshop: entry("south"),
  "metro-station": entry("east"),
};
