// Регрессия интеграции: build() локации обязан регистрировать в ctx.solids те же
// боксы, что декларирует solidsOf() (меши-хелперы layout коллизии не добавляют).
// Поймано при интеграции слайсов 1+4: локации строили меши, но не коллизии —
// игрок проходил сквозь стены (apartment, main.ts).

import { describe, expect, it } from "vitest";
import { NullEngine, Scene, StandardMaterial } from "@babylonjs/core";
import type { BuildCtx, PhasedAssets, SolidBox, SolidRegistry } from "../../src/types";
import { allLocations, solidsOf } from "../../src/world";

function fakeBuildCtx(scene: Scene): { ctx: BuildCtx; boxes: SolidBox[] } {
  const boxes: SolidBox[] = [];
  const solids: SolidRegistry = { add: (b) => boxes.push({ ...b }) };
  const assets = {
    material: (key: string) => new StandardMaterial(key, scene),
  } as unknown as PhasedAssets;
  return { ctx: { scene, worldPhase: 0, assets, solids }, boxes };
}

describe("build() регистрирует коллизии", () => {
  const engine = new NullEngine();
  const scene = new Scene(engine);

  for (const loc of allLocations) {
    it(`${loc.id}: build() добавляет в solids те же боксы, что solidsOf()`, () => {
      const { ctx, boxes } = fakeBuildCtx(scene);
      loc.build(ctx);
      expect(boxes).toEqual(solidsOf(loc.id));
    });
  }
});
