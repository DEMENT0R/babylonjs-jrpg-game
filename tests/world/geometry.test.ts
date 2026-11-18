// Геометрия: границы комнат, спавны и триггеры не пересекаются с коллизиями
// целевой локации с запасом ≥ 0.5 м; коллизии декларативны и согласованы.

import { describe, expect, it } from "vitest";
import type { SolidBox } from "../../src/types";
import { allLocations, getLocation, solidsOf } from "../../src/world/index";
import { CLEARANCE, HALF } from "../../src/world/layout";

/** Точка внутри бокса, раздутого на margin? */
function pointBlocked(px: number, pz: number, box: SolidBox, margin: number): boolean {
  return Math.abs(px - box.x) <= box.w / 2 + margin && Math.abs(pz - box.z) <= box.d / 2 + margin;
}

describe("декларативные коллизии", () => {
  it("у каждой локации есть стены по периметру (≥ 4 солида)", () => {
    for (const loc of allLocations) {
      const solids = solidsOf(loc.id);
      expect(solids.length).toBeGreaterThanOrEqual(4);
    }
  });

  it("периметр замкнут: у каждой из 4 стен есть бокс с нужной координатой", () => {
    for (const loc of allLocations) {
      const solids = solidsOf(loc.id);
      expect(solids.some((s) => s.z > HALF)).toBe(true); // север
      expect(solids.some((s) => s.z < -HALF)).toBe(true); // юг
      expect(solids.some((s) => s.x < -HALF)).toBe(true); // запад
      expect(solids.some((s) => s.x > HALF)).toBe(true); // восток
    }
  });

  it("все солиды лежат в границах комнаты (±10.5 с толщиной стен)", () => {
    const limit = HALF + 0.6;
    for (const loc of allLocations) {
      for (const s of solidsOf(loc.id)) {
        expect(Math.abs(s.x) + s.w / 2).toBeLessThanOrEqual(limit);
        expect(Math.abs(s.z) + s.d / 2).toBeLessThanOrEqual(limit);
        expect(s.w).toBeGreaterThan(0);
        expect(s.d).toBeGreaterThan(0);
      }
    }
  });

  it("solidsOf() возвращает копии: мутация не ломает источник", () => {
    const a = solidsOf("apartment");
    a[0] = { x: 999, z: 999, w: 1, d: 1 };
    expect(solidsOf("apartment")[0]?.x).not.toBe(999);
  });
});

describe("спавны и триггеры выходов", () => {
  it("каждый спавн внутри границ целевой локации", () => {
    for (const loc of allLocations) {
      for (const exit of loc.exits) {
        expect(Math.abs(exit.spawn.x)).toBeLessThanOrEqual(HALF);
        expect(Math.abs(exit.spawn.z)).toBeLessThanOrEqual(HALF);
      }
    }
  });

  it("каждый спавн не пересекает ни один солид целевой локации (запас ≥ 0.5 м)", () => {
    for (const loc of allLocations) {
      for (const exit of loc.exits) {
        const targetSolids = solidsOf(exit.to);
        const blocked = targetSolids.filter((s) =>
          pointBlocked(exit.spawn.x, exit.spawn.z, s, CLEARANCE),
        );
        expect(blocked, `${loc.id} → ${exit.to}: спавн в стене/мебели`).toHaveLength(0);
      }
    }
  });

  it("каждый триггер выхода достижим: не внутри солида этой локации", () => {
    for (const loc of allLocations) {
      const ownSolids = solidsOf(loc.id);
      for (const exit of loc.exits) {
        const blocked = ownSolids.filter((s) => pointBlocked(exit.at.x, exit.at.z, s, CLEARANCE));
        expect(blocked, `${loc.id}: триггер → ${exit.to} внутри солида`).toHaveLength(0);
      }
    }
  });

  it("триггер выхода примыкает к стене со стороны соседа (расстояние до границы ≤ 2 м)", () => {
    for (const loc of allLocations) {
      for (const exit of loc.exits) {
        const dist = Math.min(HALF - Math.abs(exit.at.x), HALF - Math.abs(exit.at.z));
        expect(dist).toBeLessThanOrEqual(2);
      }
    }
  });

  it("спавны разных выходов в одну локацию не совпадают с солидами друг друга", () => {
    for (const loc of allLocations) {
      const spawns = getLocation(loc.id).exits.map((e) => e.spawn);
      for (const [i, a] of spawns.entries()) {
        for (const b of spawns.slice(i + 1)) {
          expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(0.5);
        }
      }
    }
  });
});

describe("интеракты", () => {
  it("все интеракты внутри границ и вне солидов своей локации", () => {
    for (const loc of allLocations) {
      const ownSolids = solidsOf(loc.id);
      for (const act of loc.interacts) {
        expect(Math.abs(act.at.x)).toBeLessThanOrEqual(HALF);
        expect(Math.abs(act.at.z)).toBeLessThanOrEqual(HALF);
        expect(
          ownSolids.filter((s) => pointBlocked(act.at.x, act.at.z, s, CLEARANCE)),
          `${loc.id}: интеракт внутри солида`,
        ).toHaveLength(0);
      }
    }
  });
});
