// Детерминированные точки НПС по локациям (слайс 8): контент задаёт только home,
// координаты — здесь. Индексация — порядок npcsAt() (он стабилен: порядок data.npcs).
// Точки выбраны вне мебели и стен; контракт проверяется tests/world/npc-spots.test.ts.

export interface NpcSpot {
  x: number;
  z: number;
}

const SPOTS: Readonly<Record<string, readonly NpcSpot[]>> = {
  apartment: [
    { x: 2, z: 2 },
    { x: -2, z: 2 },
    { x: 2, z: -2 },
    { x: -3, z: -2 },
  ],
  campus: [
    { x: 2, z: 2 },
    { x: -2, z: 2 },
    { x: 0, z: 4 },
    { x: 4, z: -1 },
  ],
  hospital: [
    { x: 2, z: 2 },
    { x: 3, z: 4 },
    { x: -1, z: 0 },
    { x: 3, z: -2 },
  ],
  pharmacy: [
    { x: 0, z: 2 },
    { x: -2, z: -2 },
    { x: 2, z: -3 },
    { x: -2, z: 4 },
  ],
  square: [
    { x: 3, z: 3 },
    { x: -3, z: 3 },
    { x: -3, z: -3 },
    { x: 2, z: 6 },
  ],
  workshop: [
    { x: 1, z: 3 },
    { x: 3, z: -3 },
    { x: -4, z: 0 },
    { x: 0, z: -5 },
  ],
  "metro-station": [
    { x: 0, z: 2 },
    { x: 0, z: -2 },
    { x: -3, z: 0 },
    { x: 3, z: 0 },
  ],
  "demo-room": [
    { x: 2, z: 2 },
    { x: -2, z: 2 },
  ],
};

/** Точка i-го НПС локации; undefined — локация без площадок (ошибка контента). */
export function npcSpot(location: string, index: number): NpcSpot | undefined {
  const spots = SPOTS[location];
  if (!spots || spots.length === 0) return undefined;
  return spots[index % spots.length];
}
