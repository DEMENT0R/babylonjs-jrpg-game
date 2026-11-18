// Граф переходов между локациями: смежность по CONTRACTS.md, двусторонность,
// хаб, hospital только через campus, блокировка метро в фазах 0–1.

import { describe, expect, it } from "vitest";
import type { WorldPhase } from "../../src/types";
import { allLocations, getLocation, isExitOpen, LOCATION_IDS } from "../../src/world/index";
import { ENTRY } from "../../src/world/layout";
import { square } from "../../src/world/locations/square";
const EXPECTED_EDGES: readonly (readonly [string, string])[] = [
  ["apartment", "campus"],
  ["hospital", "campus"],
  ["campus", "square"],
  ["square", "pharmacy"],
  ["square", "workshop"],
  ["square", "metro-station"],
];

function neighborsOf(id: string): string[] {
  return getLocation(id)
    .exits.map((e) => e.to)
    .sort();
}

describe("топология района (docs/CONTRACTS.md)", () => {
  it("ровно 7 локаций с уникальными id", () => {
    expect(LOCATION_IDS).toHaveLength(7);
    expect(new Set(LOCATION_IDS).size).toBe(7);
  });

  it("набор локаций соответствует контракту", () => {
    expect([...LOCATION_IDS].sort()).toEqual(
      ["apartment", "campus", "hospital", "metro-station", "pharmacy", "square", "workshop"].sort(),
    );
  });

  it("exits ссылаются только на существующие локации", () => {
    for (const loc of allLocations) {
      for (const exit of loc.exits) {
        expect(LOCATION_IDS).toContain(exit.to);
      }
    }
  });

  it("смежность в точности равна графу из контракта", () => {
    const actual = new Set(
      allLocations.flatMap((l) => l.exits.map((e) => [l.id, e.to].sort().join("<>"))),
    );
    const expected = new Set(EXPECTED_EDGES.map(([a, b]) => [a, b].sort().join("<>")));
    expect(actual).toEqual(expected);
  });

  it("все выходы двусторонние: из A в B ⟺ из B в A", () => {
    for (const [a, b] of EXPECTED_EDGES) {
      expect(neighborsOf(a)).toContain(b);
      expect(neighborsOf(b)).toContain(a);
    }
  });

  it("square — хаб: campus/pharmacy/workshop/metro соседствуют только с ним", () => {
    expect(neighborsOf("pharmacy")).toEqual(["square"]);
    expect(neighborsOf("workshop")).toEqual(["square"]);
    expect(neighborsOf("metro-station")).toEqual(["square"]);
    expect(neighborsOf("apartment")).toEqual(["campus"]);
  });

  it("hospital доступен только через campus (единственный выход — в campus)", () => {
    expect(neighborsOf("hospital")).toEqual(["campus"]);
  });

  it("каждый выход имеет непустой label и положительный радиус", () => {
    for (const loc of allLocations) {
      for (const exit of loc.exits) {
        expect(exit.label.length).toBeGreaterThan(0);
        expect(exit.at.r).toBeGreaterThan(0);
      }
    }
  });

  it("возврат из любой локации — в точку входа у двери (одна из ENTRY-точек)", () => {
    const entryPoints = Object.values(ENTRY);
    for (const loc of allLocations) {
      for (const exit of loc.exits) {
        const isEntry = entryPoints.some((p) => p.x === exit.spawn.x && p.z === exit.spawn.z);
        expect(isEntry, `${loc.id} → ${exit.to}: спавн вне стандартной точки входа`).toBe(true);
      }
    }
  });
});

describe("блокировка метро по фазам", () => {
  it("square→metro-station закрыт в фазах 0 и 1", () => {
    expect(isExitOpen("square", "metro-station", 0)).toBe(false);
    expect(isExitOpen("square", "metro-station", 1)).toBe(false);
  });

  it("square→metro-station открыт с фазы 2 (бомбоубежище)", () => {
    expect(isExitOpen("square", "metro-station", 2)).toBe(true);
    expect(isExitOpen("square", "metro-station", 3)).toBe(true);
  });

  it("все остальные переходы открыты во всех фазах", () => {
    const phases: WorldPhase[] = [0, 1, 2, 3];
    for (const [a, b] of EXPECTED_EDGES) {
      if (a === "square" && b === "metro-station") continue;
      for (const p of phases) {
        expect(isExitOpen(a, b, p)).toBe(true);
        expect(isExitOpen(b, a, p)).toBe(true);
      }
    }
  });

  it("у двери метро в square стоит табличка-интеракт", () => {
    const signs = square.interacts.filter(
      (i) => Math.abs(i.at.x - 1.5) < 2 && Math.abs(i.at.z + 9) < 2,
    );
    expect(signs.length).toBeGreaterThan(0);
  });
});
