// Универ/общага. Ф0 пары и benches → Ф1 закрытие, объявления → Ф2 эвакуационный пункт.
// Двери: север → apartment, запад → hospital, восток → square.

import type { ExitDef, LocationDef, SolidBox } from "../../types";
import {
  boxMesh,
  cylinderMesh,
  doorMesh,
  doorTrigger,
  entry,
  floorMesh,
  perimeterSolids,
  registerSolids,
  wallMeshes,
} from "../layout";

const FURNITURE: readonly SolidBox[] = [
  { x: -5, z: -8.5, w: 3, d: 1 }, // скамьи вдоль южной стены
  { x: 5, z: -8.5, w: 3, d: 1 },
  { x: 0, z: -3, w: 4, d: 1.5 }, // лекции: длинные столы
  { x: -6, z: 6, w: 1, d: 1 }, // флагшток (основание)
  { x: 9.3, z: -6, w: 1.4, d: 2 }, // стенд у восточной стены, южнее двери
];

const SOLIDS: readonly SolidBox[] = [...perimeterSolids(), ...FURNITURE];

export function solidsOf(): SolidBox[] {
  return SOLIDS.map((s) => ({ ...s }));
}

export const campus: LocationDef = {
  id: "campus",
  firstVisitText:
    "Общага и университетский корпус — через двор от твоего дома. Студенты заперты на этажах.",
  exits: [
    {
      to: "apartment",
      at: doorTrigger("north"),
      spawn: entry("south"),
      label: "Домой, в квартиру",
    },
    { to: "hospital", at: doorTrigger("west"), spawn: entry("east"), label: "К больнице" },
    { to: "square", at: doorTrigger("east"), spawn: entry("west"), label: "На площадь района" },
  ] satisfies ExitDef[],
  interacts: [],

  build(ctx) {
    registerSolids(ctx, SOLIDS);
    floorMesh(ctx, "campus:floor");
    wallMeshes(ctx, "campus");
    doorMesh(ctx, "campus:door:apartment", "north");
    doorMesh(ctx, "campus:door:hospital", "west");
    doorMesh(ctx, "campus:door:square", "east");

    boxMesh(ctx, "campus:bench:1", "wood", -5, 0.45, -8.5, 3, 0.9, 1);
    boxMesh(ctx, "campus:bench:2", "wood", 5, 0.45, -8.5, 3, 0.9, 1);
    boxMesh(ctx, "campus:table", "wood", 0, 0.45, -3, 4, 0.9, 1.5);
    cylinderMesh(ctx, "campus:flagpole", "metal", -6, 3, 6, 0.2, 6);
    boxMesh(ctx, "campus:board", "plastic", 9.3, 1.2, -6, 1.4, 2.4, 0.2);

    if (ctx.worldPhase >= 1) {
      boxMesh(ctx, "campus:notices", "plastic", 9.1, 1.2, -4.5, 0.2, 1.4, 1);
      boxMesh(ctx, "campus:trash", "dirt", 3.5, 0.25, 8.6, 1.4, 0.5, 1);
    }
    if (ctx.worldPhase >= 2) {
      // Эвакуационный пункт: палатки и мешки с песбом у дверей.
      boxMesh(ctx, "campus:tent:1", "fabric", 4, 0.8, 5.5, 3, 1.6, 2.5);
      boxMesh(ctx, "campus:tent:2", "fabric", -4, 0.8, 5.5, 3, 1.6, 2.5);
      boxMesh(ctx, "campus:sandbags", "dirt", 0, 0.3, -8.9, 2.4, 0.6, 1);
    }
  },

  update() {},
};
