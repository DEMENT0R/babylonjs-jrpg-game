// Реестр: доступ по id, полнота набора, контракт LocationDef как тип.

import { describe, expect, it } from "vitest";
import type { LocationDef } from "../../src/types";
import { allLocations, getLocation, LOCATION_IDS, solidsOf } from "../../src/world/index";

describe("реестр локаций", () => {
  it("allLocations — валидные LocationDef (id/build/update/exits/interacts)", () => {
    for (const loc of allLocations as LocationDef[]) {
      expect(typeof loc.id).toBe("string");
      expect(typeof loc.build).toBe("function");
      expect(typeof loc.update).toBe("function");
      expect(Array.isArray(loc.exits)).toBe(true);
      expect(Array.isArray(loc.interacts)).toBe(true);
    }
  });

  it("getLocation находит каждую локацию набора", () => {
    for (const id of LOCATION_IDS) {
      expect(getLocation(id).id).toBe(id);
    }
  });

  it("getLocation бросает ошибку на неизвестный id", () => {
    expect(() => getLocation("nowhere")).toThrow(/Unknown location/);
    expect(() => solidsOf("nowhere")).toThrow(/Unknown location/);
  });

  it("solidsOf работает для всех локаций без исключений", () => {
    for (const id of LOCATION_IDS) {
      expect(solidsOf(id).length).toBeGreaterThan(0);
    }
  });

  it("у metro-station есть табличка-интеракт (по брифу слайса)", () => {
    expect(getLocation("metro-station").interacts.length).toBeGreaterThan(0);
  });
});
