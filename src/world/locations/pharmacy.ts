// Аптека. Ф0 очереди из-за слухов → Ф1 пустые полки, спекуляция → Ф2 разграблена.
// Дверь: юг → square.

import type { ExitDef, LocationDef, SolidBox } from "../../types";
import {
  boxMesh,
  doorMesh,
  doorTrigger,
  entry,
  floorMesh,
  perimeterSolids,
  registerSolids,
  wallMeshes,
} from "../layout";

const FURNITURE: readonly SolidBox[] = [
  { x: 0, z: 6, w: 6, d: 1 }, // прилавок
  { x: -6, z: 2, w: 1.2, d: 6 }, // стеллажи с лекарствами
  { x: 6, z: 2, w: 1.2, d: 6 },
  { x: 8.5, z: -8.5, w: 2, d: 2 }, // холодильник (юго-восточный угол)
];

const SOLIDS: readonly SolidBox[] = [...perimeterSolids(), ...FURNITURE];

export function solidsOf(): SolidBox[] {
  return SOLIDS.map((s) => ({ ...s }));
}

export const pharmacy: LocationDef = {
  id: "pharmacy",
  exits: [
    { to: "square", at: doorTrigger("south"), spawn: entry("north"), label: "Обратно на площадь" },
  ] satisfies ExitDef[],
  interacts: [],

  build(ctx) {
    registerSolids(ctx, SOLIDS);
    floorMesh(ctx, "pharmacy:floor");
    wallMeshes(ctx, "pharmacy");
    doorMesh(ctx, "pharmacy:door:square", "south");

    boxMesh(ctx, "pharmacy:counter", "plastic", 0, 0.55, 6, 6, 1.1, 1);
    boxMesh(ctx, "pharmacy:shelf:1", "wood", -6, 1, 2, 1.2, 2, 6);
    boxMesh(ctx, "pharmacy:shelf:2", "wood", 6, 1, 2, 1.2, 2, 6);
    boxMesh(ctx, "pharmacy:fridge", "metal", 8.5, 1, -8.5, 2, 2, 2);

    // Полки «товара»: Ф0 полные, Ф1 полупустые, Ф2 почти пустые.
    const stockH = ctx.worldPhase === 0 ? 1.7 : ctx.worldPhase === 1 ? 0.8 : 0.2;
    boxMesh(ctx, "pharmacy:stock:1", "plastic", -6, 1, 2, 0.4, stockH, 5.6);
    boxMesh(ctx, "pharmacy:stock:2", "plastic", 6, 1, 2, 0.4, stockH, 5.6);

    if (ctx.worldPhase >= 1) {
      boxMesh(ctx, "pharmacy:queue:tape", "plastic", -2.5, 0.9, -5, 4, 0.15, 0.3);
    }
    if (ctx.worldPhase >= 2) {
      // Разграблена: перевёрнутый стеллаж, мусор.
      boxMesh(ctx, "pharmacy:looted", "wood", 0, 0.3, -7.8, 4.5, 0.6, 1);
      boxMesh(ctx, "pharmacy:trash", "dirt", -8.8, 0.25, -5.5, 1.6, 0.5, 1.2);
    }
  },

  update() {},
};
