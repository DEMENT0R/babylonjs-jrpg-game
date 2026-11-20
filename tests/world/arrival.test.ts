// Точки прибытия быстрого перемещения (карта в меню): у стены, вне мебели и стен.
// Контракт ARRIVAL в src/world/index.ts; геометрия — solidsOf каждой локации.
import { describe, expect, it } from "vitest";
import { HALF } from "../../src/world/layout";
import { ARRIVAL, LOCATION_IDS, solidsOf } from "../../src/world";

const PLAYER_RADIUS = 0.35; // радиус коллизии игрока (app/main.ts)

function arrivalOf(id: string) {
  const arrival = ARRIVAL[id];
  if (!arrival) throw new Error(`нет точки прибытия для "${id}"`);
  return arrival;
}

describe("точки прибытия (world/ARRIVAL)", () => {
  it("определены для каждой локации и внутри комнаты", () => {
    for (const id of LOCATION_IDS) {
      const arrival = arrivalOf(id);
      expect(Math.abs(arrival.x)).toBeLessThanOrEqual(HALF);
      expect(Math.abs(arrival.z)).toBeLessThanOrEqual(HALF);
    }
  });

  it("каждая точка — вне коллизий локации (радиус игрока)", () => {
    for (const id of LOCATION_IDS) {
      const arrival = arrivalOf(id);
      for (const solid of solidsOf(id)) {
        const dx = Math.max(Math.abs(arrival.x - solid.x) - solid.w / 2, 0);
        const dz = Math.max(Math.abs(arrival.z - solid.z) - solid.d / 2, 0);
        const distance = Math.hypot(dx, dz);
        expect(distance, `${id}: точка прибытия задевает ${JSON.stringify(solid)}`).toBeGreaterThan(
          PLAYER_RADIUS,
        );
      }
    }
  });
});
