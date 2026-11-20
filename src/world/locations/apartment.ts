// Квартира героя. Ф0 быт → Ф1 мусор/скупка → Ф2 укрытие и запасы (нарративная библия).
// Дверь: юг → campus (общага/универ рядом с домом).

import type { ExitDef, LocationDef, SolidBox } from "../../types";
import { slotsToEvening, slotsToMorning } from "../../core/time";
import { advanceTime } from "../../systems/effects";
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

// Мебель: центр + полные размеры (AABB-коллизии); высоты — только в build().
const FURNITURE: readonly SolidBox[] = [
  { x: -7.5, z: -6.5, w: 2, d: 3.2 }, // кровать (юго-запад)
  { x: 5, z: 4, w: 2, d: 2 }, // обеденный стол
  { x: 6.5, z: -8.9, w: 5, d: 1 }, // кухонный гарнитур вдоль южной стены (восточнее двери)
  { x: -9.2, z: 4, w: 1.4, d: 3 }, // стеллаж с книгами у западной стены
];

const SOLIDS: readonly SolidBox[] = [...perimeterSolids(), ...FURNITURE];

/** Декларативная геометрия коллизий для тестов; build() регистрирует те же боксы. */
export function solidsOf(): SolidBox[] {
  return SOLIDS.map((s) => ({ ...s }));
}

export const apartment: LocationDef = {
  id: "apartment",
  exits: [
    {
      to: "campus",
      at: doorTrigger("south"),
      spawn: entry("north"),
      label: "Выход во двор — к общаге",
    },
  ] satisfies ExitDef[],
  interacts: [
    {
      // Кровать: сон до следующего утра (день 1 → день 2 → день 3).
      at: { x: -7.5, z: -4.1, r: 1.5 },
      label: "Твоя кровать — поспать до утра",
      onConfirm: (ctx) => {
        ctx.store.update((draft) =>
          advanceTime(draft, ctx.content, slotsToMorning(draft.time.slot)),
        );
      },
    },
    {
      // Стол: переждать до вечера, не тратя ночь.
      at: { x: 5, z: 2.3, r: 1.5 },
      label: "Твой стол — переждать до вечера",
      onConfirm: (ctx) => {
        ctx.store.update((draft) => {
          const slots = slotsToEvening(draft.time.slot);
          if (slots > 0) advanceTime(draft, ctx.content, slots);
        });
      },
    },
  ],

  build(ctx) {
    registerSolids(ctx, SOLIDS);
    floorMesh(ctx, "apartment:floor");
    wallMeshes(ctx, "apartment");
    doorMesh(ctx, "apartment:door", "south");

    // Кровать, стол, стеллаж — меши ровно над своими SolidBox.
    boxMesh(ctx, "apartment:bed", "fabric", -7.5, 0.3, -6.5, 2, 0.6, 3.2);
    boxMesh(ctx, "apartment:bed: pillow", "fabric", -7.5, 0.65, -7.7, 1.6, 0.2, 0.6);
    boxMesh(ctx, "apartment:table", "wood", 5, 0.45, 4, 2, 0.9, 2);
    boxMesh(ctx, "apartment:counter", "wood", 6.5, 0.5, -8.9, 5, 1, 1);
    boxMesh(ctx, "apartment:shelf", "wood", -9.2, 1, 4, 1.4, 2, 3);
    boxMesh(ctx, "apartment:tv", "plastic", 9.5, 0.8, 4, 0.4, 0.6, 1.4);

    // Фазозависимые пропсы (не коллизии, только вид).
    if (ctx.worldPhase >= 1) {
      boxMesh(ctx, "apartment:trash", "dirt", 3, 0.25, -8.6, 1.4, 0.5, 1);
      boxMesh(ctx, "apartment:boxes", "wood", -4.5, 0.4, -9, 1.2, 0.8, 1);
    }
    if (ctx.worldPhase >= 2) {
      // Запасы/укрытие: заклеенное окно, ящики у двери, матрас-баррикада.
      boxMesh(ctx, "apartment:supplies", "wood", 2.2, 0.5, 9.2, 2.4, 1, 1.2);
      boxMesh(ctx, "apartment:barricade", "fabric", 1.6, 0.3, -8.8, 1.2, 0.6, 1.4);
    }
  },

  update() {},
};
