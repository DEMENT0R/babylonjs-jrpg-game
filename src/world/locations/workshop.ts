// Подвал-мастерская. Крафт-хаб, слабо меняется по фазам (библия).
// Дверь: запад → square.

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
  { x: 5.5, z: 0, w: 2.5, d: 1.5 }, // верстак
  { x: 9.2, z: 5, w: 1.5, d: 4 }, // стеллаж инструментов у восточной стены
  { x: 9, z: -6, w: 2, d: 2 }, // ящики с материалами
  { x: 0, z: 9.3, w: 4, d: 1 }, // стойка с трубами у северной стены
];

const SOLIDS: readonly SolidBox[] = [...perimeterSolids(), ...FURNITURE];

export function solidsOf(): SolidBox[] {
  return SOLIDS.map((s) => ({ ...s }));
}

export const workshop: LocationDef = {
  id: "workshop",
  firstVisitText: "Мастерская Тараса: инструменты, хлам и подвал с текущей трубой.",
  exits: [
    { to: "square", at: doorTrigger("west"), spawn: entry("east"), label: "Наверх, на площадь" },
  ] satisfies ExitDef[],
  interacts: [],

  build(ctx) {
    registerSolids(ctx, SOLIDS);
    floorMesh(ctx, "workshop:floor");
    wallMeshes(ctx, "workshop");
    doorMesh(ctx, "workshop:door:square", "west");

    boxMesh(ctx, "workshop:workbench", "wood", 5.5, 0.5, 0, 2.5, 1, 1.5);
    boxMesh(ctx, "workshop:bench:tools", "metal", 5.5, 1.05, 0, 2.2, 0.15, 1.2);
    boxMesh(ctx, "workshop:shelf", "metal", 9.2, 1, 5, 1.5, 2, 4);
    boxMesh(ctx, "workshop:crates", "wood", 9, 0.5, -6, 2, 1, 2);
    boxMesh(ctx, "workshop:pipes", "metal", 0, 0.6, 9.3, 4, 1.2, 1);
    if (ctx.worldPhase >= 1) {
      boxMesh(ctx, "workshop:scrap", "dirt", -6.5, 0.3, 8.2, 2, 0.6, 1.5);
    }
    if (ctx.worldPhase >= 2) {
      boxMesh(ctx, "workshop:generator", "metal", -8.7, 0.6, -8.5, 2, 1.2, 2);
    }
  },

  update() {},
};
