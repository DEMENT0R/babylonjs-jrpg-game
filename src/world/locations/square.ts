// Двор/площадь района — хаб. Ф0 фонтан и дети → Ф1 мусор → Ф2 баррикады.
// Двери: запад → campus, север → pharmacy, восток → workshop, юг → metro-station
// (в фазах 0–1 вход в метро блокирован — см. LOCKED_EXITS в world/index.ts).

import type { ExitDef, InteractDef, LocationDef, SolidBox } from "../../types";
import {
  boxMesh,
  cylinderMesh,
  doorMesh,
  doorTrigger,
  DOOR,
  entry,
  floorMesh,
  perimeterSolids,
  registerSolids,
  signMesh,
  wallMeshes,
} from "../layout";

const FURNITURE: readonly SolidBox[] = [
  { x: 0, z: 0, w: 3, d: 3 }, // фонтан в центре
  { x: -7.5, z: 7.5, w: 1, d: 1 }, // деревья по углам
  { x: 7.5, z: 7.5, w: 1, d: 1 },
  { x: -7.5, z: -7.5, w: 1, d: 1 },
  { x: 7.5, z: -7.5, w: 1, d: 1 },
  { x: -5, z: -5, w: 2, d: 0.8 }, // скамьи
  { x: 5, z: -5, w: 2, d: 0.8 },
  { x: 5.5, z: 8.6, w: 3, d: 2 }, // киоск у северной стены, восточнее двери
];

const SOLIDS: readonly SolidBox[] = [...perimeterSolids(), ...FURNITURE];

export function solidsOf(): SolidBox[] {
  return SOLIDS.map((s) => ({ ...s }));
}

/** Точка таблички «закрыто на ремонт» у входа в метро (юг). */
export const metroSignAt = { x: DOOR.south.x + 1.5, z: DOOR.south.z + 0.6, r: 1.5 };

export const square: LocationDef = {
  id: "square",
  exits: [
    { to: "campus", at: doorTrigger("west"), spawn: entry("east"), label: "К универу" },
    { to: "pharmacy", at: doorTrigger("north"), spawn: entry("south"), label: "В аптеку" },
    { to: "workshop", at: doorTrigger("east"), spawn: entry("west"), label: "В мастерскую" },
    { to: "metro-station", at: doorTrigger("south"), spawn: entry("north"), label: "К метро" },
  ] satisfies ExitDef[],
  interacts: [
    {
      // Табличка у метро: в фазах 0–1 «закрыто на ремонт», с фазы 2 — убежище.
      // onConfirm — заглушка без эффектов: диалоги подключит слайс 5.
      at: metroSignAt,
      onConfirm() {},
    } satisfies InteractDef,
  ],

  build(ctx) {
    registerSolids(ctx, SOLIDS);
    floorMesh(ctx, "square:floor");
    wallMeshes(ctx, "square");
    doorMesh(ctx, "square:door:campus", "west");
    doorMesh(ctx, "square:door:pharmacy", "north");
    doorMesh(ctx, "square:door:workshop", "east");
    doorMesh(ctx, "square:door:metro", "south");

    cylinderMesh(ctx, "square:fountain", "stone", 0, 0.5, 0, 3, 1);
    cylinderMesh(ctx, "square:fountain:water", "glass", 0, 1.05, 0, 2.4, 0.1);
    const TREES: readonly [number, number][] = [
      [-7.5, 7.5],
      [7.5, 7.5],
      [-7.5, -7.5],
      [7.5, -7.5],
    ];
    for (const [i, [tx, tz]] of TREES.entries()) {
      cylinderMesh(ctx, `square:tree:${i}`, "wood", tx, 1.5, tz, 0.3, 3);
      cylinderMesh(ctx, `square:tree:crown:${i}`, "foliage", tx, 3.2, tz, 1.8, 1.2);
    }
    boxMesh(ctx, "square:bench:1", "wood", -5, 0.45, -5, 2, 0.9, 0.8);
    boxMesh(ctx, "square:bench:2", "wood", 5, 0.45, -5, 2, 0.9, 0.8);
    boxMesh(ctx, "square:kiosk", "plastic", 5.5, 1.1, 8.6, 3, 2.2, 2);
    signMesh(ctx, "square:metro-sign", metroSignAt.x, metroSignAt.z);

    if (ctx.worldPhase >= 1) {
      boxMesh(ctx, "square:trash:1", "dirt", -3, 0.25, 7, 1.4, 0.5, 1);
      boxMesh(ctx, "square:trash:2", "dirt", 2.5, 0.25, -7.5, 1.2, 0.5, 0.9);
    }
    if (ctx.worldPhase >= 2) {
      // Баррикады у выходов (визуально; проход — триггеры выходов).
      boxMesh(ctx, "square:barricade:n", "wood", -2.5, 0.5, 9.2, 3, 1, 1);
      boxMesh(ctx, "square:barricade:e", "wood", 9.2, 0.5, 2.5, 1, 1, 3);
      boxMesh(ctx, "square:barricade:w", "wood", -9.2, 0.5, -2.5, 1, 1, 3);
      boxMesh(ctx, "square:checkpoint", "fabric", 1.8, 0.6, 9, 2, 1.2, 1.4);
    }
  },

  update() {},
};

// Точка входа хаба (возврат из любой локации) — у западной двери, из campus.
export const HUB_ENTRY = entry("east");
