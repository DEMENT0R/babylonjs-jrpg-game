// Станция метро. Ф0–1 «закрыта на ремонт» (интерьер недоступен — вход блокирован
// со стороны square, см. LOCKED_EXITS в world/index.ts) → Ф2 бомбоубежище.
// Дверь: север → square.

import type { ExitDef, InteractDef, LocationDef, SolidBox, UpdateCtx } from "../../types";
import {
  boxMesh,
  cylinderMesh,
  doorMesh,
  doorTrigger,
  DOOR,
  entry,
  floorMesh,
  perimeterSolids,
  signMesh,
  wallMeshes,
} from "../layout";

const FURNITURE: readonly SolidBox[] = [
  { x: 0, z: 5, w: 4, d: 0.8 }, // турникеты
  { x: 0, z: -8.5, w: 14, d: 2.5 }, // путь у южной стены (ограждение)
  { x: -6, z: 0, w: 1, d: 1 }, // колонна
  { x: 6, z: 0, w: 1, d: 1 }, // колонна
];

const SOLIDS: readonly SolidBox[] = [...perimeterSolids(), ...FURNITURE];

export function solidsOf(): SolidBox[] {
  return SOLIDS.map((s) => ({ ...s }));
}

/** Табличка на станции («закрыто на ремонт» / «убежище») у северной двери. */
export const signAt = { x: DOOR.north.x + 1.5, z: DOOR.north.z - 0.6, r: 1.5 };

let lampTime = 0;

export const metroStation: LocationDef = {
  id: "metro-station",
  exits: [
    { to: "square", at: doorTrigger("north"), spawn: entry("south"), label: "Выход на площадь" },
  ] satisfies ExitDef[],
  interacts: [
    {
      // Табличка; onConfirm — заглушка без эффектов, диалоги подключит слайс 5.
      at: signAt,
      onConfirm() {},
    } satisfies InteractDef,
  ],

  build(ctx) {
    floorMesh(ctx, "metro:floor");
    wallMeshes(ctx, "metro");
    doorMesh(ctx, "metro:door:square", "north");

    boxMesh(ctx, "metro:turnstile", "metal", 0, 0.5, 5, 4, 1, 0.8);
    boxMesh(ctx, "metro:track", "dirt", 0, 0.2, -8.5, 14, 0.4, 2.5);
    boxMesh(ctx, "metro:platform:edge", "stone", 0, 0.15, -7, 14, 0.3, 0.4);
    cylinderMesh(ctx, "metro:pillar:1", "stone", -6, 1.5, 0, 1, 3);
    cylinderMesh(ctx, "metro:pillar:2", "stone", 6, 1.5, 0, 1, 3);
    boxMesh(ctx, "metro:lamp", "glass", 0, 2.8, 6, 3, 0.2, 0.5);
    signMesh(ctx, "metro:sign", signAt.x, signAt.z);

    if (ctx.worldPhase >= 2) {
      // Бомбоубежище: ряды коек у восточной стены, мешки у входа.
      boxMesh(ctx, "metro:bunk:1", "fabric", 8.2, 0.4, 4, 1.6, 0.8, 3);
      boxMesh(ctx, "metro:bunk:2", "fabric", 8.2, 0.4, -1, 1.6, 0.8, 3);
      boxMesh(ctx, "metro:sandbags", "dirt", -2.4, 0.3, 8.9, 2.4, 0.6, 1);
    }
  },

  update(ctx: UpdateCtx) {
    // Мерцание лампы на платформе.
    lampTime += ctx.dt;
    const lamp = ctx.scene.getMeshByName("metro:lamp");
    if (lamp) lamp.visibility = 0.7 + 0.3 * Math.abs(Math.sin(lampTime * 5));
  },
};
