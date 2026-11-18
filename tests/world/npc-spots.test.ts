import { describe, expect, it } from "vitest";
import { solidsOf } from "../../src/world";
import { npcSpot } from "../../src/world/npcs";

const LOCATIONS = [
  "apartment",
  "campus",
  "hospital",
  "pharmacy",
  "square",
  "workshop",
  "metro-station",
];

/** Расстояние от точки до AABB (0 — внутри). */
function distanceToBox(x: number, z: number, box: { x: number; z: number; w: number; d: number }) {
  const dx = Math.max(Math.abs(x - box.x) - box.w / 2, 0);
  const dz = Math.max(Math.abs(z - box.z) - box.d / 2, 0);
  return Math.hypot(dx, dz);
}

describe("npcSpot", () => {
  it("у каждой локации — 4 валидные площадки внутри периметра и вне коллизий", () => {
    for (const location of LOCATIONS) {
      for (let i = 0; i < 4; i++) {
        const spot = npcSpot(location, i);
        expect(spot, `${location}#${i}`).toBeDefined();
        expect(Math.abs(spot!.x)).toBeLessThanOrEqual(9);
        expect(Math.abs(spot!.z)).toBeLessThanOrEqual(9);
        for (const box of solidsOf(location)) {
          expect(
            distanceToBox(spot!.x, spot!.z, box),
            `${location}#${i} пересекает коллизию`,
          ).toBeGreaterThan(0.5);
        }
      }
    }
  });

  it("индекс заворачивается, неизвестная локация — undefined", () => {
    expect(npcSpot("apartment", 4)).toEqual(npcSpot("apartment", 0));
    expect(npcSpot("atlantis", 0)).toBeUndefined();
  });
});
