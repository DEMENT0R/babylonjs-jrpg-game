import type { SolidBox, SolidRegistry } from "../types";

export interface Movable {
  x: number;
  z: number;
}

/** SolidRegistry + запросы: реализует слайс 1, потребляют локации (слайс 4). */
export interface SolidField extends SolidRegistry {
  boxes(): readonly SolidBox[];
  /** Проекция движения с AABB-коллизиями: скользящие стены, «сквозь стены не пройти».
   *  Оси клампятся по перекрывающимся коробкам (swept), поэтому туннелирование
   *  сквозь тонкую стену одним шагом невозможно. */
  canMove(from: Movable, to: Movable, radius: number): Movable;
}

export function createSolidRegistry(): SolidField {
  const list: SolidBox[] = [];
  return {
    add(box) {
      list.push(box);
    },
    boxes: () => list,
    canMove(from, to, radius) {
      // ось x при стартовом z, затем ось z при уже клампнутом x (скольжение)
      const x = clampAxis(list, from.x, to.x, from.z, "x", radius);
      const z = clampAxis(list, from.z, to.z, x, "z", radius);
      if (blockedAt(list, x, z, radius)) {
        // диагональ в выпуклый угол: комбинация осей перекрывает коробку —
        // скользим по одной оси, вторая остаётся стартовой
        const slideX = { x, z: from.z };
        const slideZ = { x: from.x, z };
        const preferZ = Math.abs(to.z - from.z) > Math.abs(to.x - from.x);
        if (preferZ && !blockedAt(list, slideZ.x, slideZ.z, radius)) return slideZ;
        return slideX;
      }
      return { x, z };
    },
  };
}

/** Кламп движения вдоль оси move (start→goal) по коробкам, перекрывающим
 *  перпендикулярную полосу (fixed±radius). Кламп не двигает назад против хода. */
function clampAxis(
  boxes: readonly SolidBox[],
  start: number,
  goal: number,
  fixed: number,
  move: "x" | "z",
  radius: number,
): number {
  let result = goal;
  for (const b of boxes) {
    // перпендикулярная полоса: пересекается ли fixed±radius с коробкой
    const perpMin = move === "x" ? b.z - b.d / 2 : b.x - b.w / 2;
    const perpMax = move === "x" ? b.z + b.d / 2 : b.x + b.w / 2;
    if (fixed + radius <= perpMin || fixed - radius >= perpMax) continue;
    const center = move === "x" ? b.x : b.z;
    const half = (move === "x" ? b.w : b.d) / 2;
    if (goal > start) {
      result = Math.min(result, center - half - radius);
    } else if (goal < start) {
      result = Math.max(result, center + half + radius);
    }
  }
  // старт уже в контакте: кламп не должен тянуть назад против направления
  return Math.min(Math.max(result, Math.min(start, goal)), Math.max(start, goal));
}
function blockedAt(boxes: readonly SolidBox[], x: number, z: number, radius: number): boolean {
  // EPS: касание (а не проникновение) не считается блоком — на float-границе
  // (0.5 + 0.45) - 0.45 < 0.5 без него даёт ложное перекрытие
  const EPS = 1e-9;
  for (const b of boxes) {
    if (
      x + radius > b.x - b.w / 2 + EPS &&
      x - radius < b.x + b.w / 2 - EPS &&
      z + radius > b.z - b.d / 2 + EPS &&
      z - radius < b.z + b.d / 2 - EPS
    ) {
      return true;
    }
  }
  return false;
}
