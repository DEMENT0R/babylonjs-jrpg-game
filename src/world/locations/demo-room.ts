import type { BuildCtx, LocationDef } from "../../types";
import { buildBox, buildSolidBox } from "../../core/phasedAssets";

/** Референс-имплементация LocationDef для DoD-1 (ходьба/коллизии/слот времени).
 *  Сетка как у локаций слайса 4: 20×20 (−10..10), стены-периметр 0.5,
 *  спавн-запас ≥ 0.5 от стен. Настоящая «apartment» живёт в слайсе 4. */
export const DEMO_SPAWN = { x: 0, z: 6 };

const WALL = 0.5;
const H = 3;

export const demoRoom: LocationDef = {
  id: "demo-room",
  exits: [
    // Демо-выход «в себя же»: доказывает срабатывание триггера и пересборку сцены.
    { to: "demo-room", at: { x: 0, z: -9.2, r: 1 }, spawn: DEMO_SPAWN, label: "Дверь (демо)" },
  ],
  interacts: [
    {
      at: { x: -6, z: -6, r: 1.4 },
      onConfirm: () => {
        console.info("Кровать. Поспать пока нельзя — это демо-комната.");
      },
    },
  ],
  build(ctx: BuildCtx): void {
    const { scene, worldPhase, assets, solids } = ctx;
    buildBox(
      scene,
      "floor",
      { x: 0, y: -0.05, z: 0, w: 20, h: 0.1, d: 20 },
      assets.material("floor", worldPhase),
    );
    const wallMat = assets.material("wall", worldPhase);
    buildSolidBox(scene, "wallN", { x: 0, z: -10, w: 20, d: WALL, h: H }, wallMat, solids);
    buildSolidBox(scene, "wallS", { x: 0, z: 10, w: 20, d: WALL, h: H }, wallMat, solids);
    buildSolidBox(scene, "wallW", { x: -10, z: 0, w: WALL, d: 20, h: H }, wallMat, solids);
    buildSolidBox(scene, "wallE", { x: 10, z: 0, w: WALL, d: 20, h: H }, wallMat, solids);
    // дверь-визуал на северной стене — маркер демо-выхода
    buildBox(
      scene,
      "door",
      { x: 0, y: 1.1, z: -9.7, w: 1.2, h: 2.2, d: 0.1 },
      assets.material("door", worldPhase),
    );
    // мебель: кровать (каркас + матрас), стол, шкаф
    buildSolidBox(
      scene,
      "bedFrame",
      { x: -6, z: -6, w: 2.4, d: 1.2, h: 0.5 },
      assets.material("wood", worldPhase),
      solids,
    );
    buildBox(
      scene,
      "bedMattress",
      { x: -6, y: 0.6, z: -6, w: 2.2, h: 0.25, d: 1 },
      assets.material("fabric", worldPhase),
    );
    buildSolidBox(
      scene,
      "table",
      { x: 5, z: -5, w: 1.8, d: 1, h: 0.8 },
      assets.material("plastic", worldPhase),
      solids,
    );
    buildSolidBox(
      scene,
      "wardrobe",
      { x: 6, z: 6, w: 1.4, d: 0.8, h: 2.1 },
      assets.material("wood", worldPhase),
      solids,
    );
  },
  update(): void {
    // статичная комната: движение/выходы/интеракции ведёт SceneManager
  },
};
