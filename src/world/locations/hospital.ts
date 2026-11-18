// Городская больница. Ф0 смены → Ф1 тревога/очереди → Ф2 переполнена и закрыта.
// Дверь: восток → campus (больница доступна только через campus).

import type { ExitDef, LocationDef, SolidBox, UpdateCtx } from "../../types";
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
  { x: -4, z: 6, w: 3, d: 1 }, // стойка регистрации
  { x: -7.5, z: 2, w: 2, d: 3 }, // больничные койки
  { x: -7.5, z: -3, w: 2, d: 3 },
  { x: 0, z: -8.8, w: 4, d: 1 }, // тележки/аппаратура у южной стены
];

const SOLIDS: readonly SolidBox[] = [...perimeterSolids(), ...FURNITURE];

export function solidsOf(): SolidBox[] {
  return SOLIDS.map((s) => ({ ...s }));
}

// Модульное состояние мерцания лампы (сбрасывается при пересборке сцены).
let lampTime = 0;

export const hospital: LocationDef = {
  id: "hospital",
  exits: [
    { to: "campus", at: doorTrigger("east"), spawn: entry("west"), label: "Обратно в универ" },
  ] satisfies ExitDef[],
  interacts: [],

  build(ctx) {
    registerSolids(ctx, SOLIDS);
    floorMesh(ctx, "hospital:floor");
    wallMeshes(ctx, "hospital");
    doorMesh(ctx, "hospital:door:campus", "east");

    boxMesh(ctx, "hospital:reception", "plastic", -4, 0.55, 6, 3, 1.1, 1);
    boxMesh(ctx, "hospital:bed:1", "fabric", -7.5, 0.4, 2, 2, 0.8, 3);
    boxMesh(ctx, "hospital:bed:2", "fabric", -7.5, 0.4, -3, 2, 0.8, 3);
    boxMesh(ctx, "hospital:equipment", "metal", 0, 0.7, -8.8, 4, 1.4, 1);
    boxMesh(ctx, "hospital:lamp", "glass", 0, 2.8, 0, 2.4, 0.2, 0.6);

    if (ctx.worldPhase >= 1) {
      boxMesh(ctx, "hospital:queue:chairs", "plastic", 4, 0.4, 7.5, 3, 0.8, 1);
      boxMesh(ctx, "hospital:masks:box", "plastic", -4, 1.2, 6.6, 1, 0.3, 0.5);
    }
    if (ctx.worldPhase >= 2) {
      // Переполнена: носилки в проходе, вход перекрыт лентой.
      boxMesh(ctx, "hospital:stretchers", "fabric", 3, 0.35, -1, 2.4, 0.7, 4.5);
      boxMesh(ctx, "hospital:closed:tape", "plastic", 8.7, 1.6, 2.6, 0.15, 0.3, 2.8);
    }
  },

  update(ctx: UpdateCtx) {
    // Мерцание лампы: дешёвая «живая» деталь интерьера.
    lampTime += ctx.dt;
    const lamp = ctx.scene.getMeshByName("hospital:lamp");
    if (lamp) lamp.visibility = 0.75 + 0.25 * Math.abs(Math.sin(lampTime * 6));
  },
};
