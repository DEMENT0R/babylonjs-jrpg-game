// Общая геометрия локаций: единая сетка 20×20 м (координаты -10..10),
// стены по периметру, двери/спавны по сторонам света.
// Один источник правды для коллизий: perimeterSolids() используют и build(),
// и solidsOf() каждой локации. SolidBox — центр (x,z) + полные размеры.

import type { Material, Mesh } from "@babylonjs/core";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { BuildCtx, SolidBox } from "../types";

export const HALF = 10; // внутренние границы комнаты: -HALF..HALF
export const WALL_T = 0.5; // толщина стен
export const WALL_H = 3; // высота стен
export const CLEARANCE = 0.5; // минимальный запас спавна/триггера от стен (м)

export type DoorSide = "north" | "south" | "east" | "west";

/** Точки-триггеры выходов у середины каждой стены. */
export const DOOR: Record<DoorSide, { x: number; z: number }> = {
  north: { x: 0, z: HALF - 1 },
  south: { x: 0, z: -HALF + 1 },
  east: { x: HALF - 1, z: 0 },
  west: { x: -HALF + 1, z: 0 },
};

/** Точка появления в комнате, вошедшей через дверь со стороны side (лицом внутрь). */
export const ENTRY: Record<DoorSide, { x: number; z: number; yaw: number }> = {
  north: { x: 0, z: HALF - 1.8, yaw: Math.PI },
  south: { x: 0, z: -HALF + 1.8, yaw: 0 },
  east: { x: HALF - 1.8, z: 0, yaw: -Math.PI / 2 },
  west: { x: -HALF + 1.8, z: 0, yaw: Math.PI / 2 },
};

export function doorTrigger(side: DoorSide, r = 1): { x: number; z: number; r: number } {
  return { ...DOOR[side], r };
}

export function entry(side: DoorSide): { x: number; z: number; yaw: number } {
  return { ...ENTRY[side] };
}

/** Периметр: 4 AABB-стены, внутренняя грань ровно на ±HALF. */
export function perimeterSolids(): SolidBox[] {
  const span = 2 * HALF + WALL_T;
  return [
    { x: 0, z: HALF + WALL_T / 2, w: span, d: WALL_T },
    { x: 0, z: -HALF - WALL_T / 2, w: span, d: WALL_T },
    { x: -HALF - WALL_T / 2, z: 0, w: WALL_T, d: 2 * HALF },
    { x: HALF + WALL_T / 2, z: 0, w: WALL_T, d: 2 * HALF },
  ];
}

// ─── Меши-примитивы (только build-сторона; тесты геометрию не трогают) ─────────

function mat(ctx: BuildCtx, key: string): Material {
  return ctx.assets.material(key, ctx.worldPhase);
}

export function floorMesh(ctx: BuildCtx, name: string): Mesh {
  const m = MeshBuilder.CreateGround(name, { width: 2 * HALF, height: 2 * HALF }, ctx.scene);
  m.material = mat(ctx, "floor");
  return m;
}

/** Визуальные стены — ровно над боксами perimeterSolids(). */
export function wallMeshes(ctx: BuildCtx, prefix: string): void {
  const material = mat(ctx, "wall");
  for (const s of perimeterSolids()) {
    const m = MeshBuilder.CreateBox(
      `${prefix}:wall`,
      { width: s.w, depth: s.d, height: WALL_H },
      ctx.scene,
    );
    m.position.set(s.x, WALL_H / 2, s.z);
    m.material = material;
  }
}

export function boxMesh(
  ctx: BuildCtx,
  name: string,
  key: string,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
): Mesh {
  const m = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, ctx.scene);
  m.position.set(x, y, z);
  m.material = mat(ctx, key);
  return m;
}

export function cylinderMesh(
  ctx: BuildCtx,
  name: string,
  key: string,
  x: number,
  y: number,
  z: number,
  diameter: number,
  height: number,
): Mesh {
  const m = MeshBuilder.CreateCylinder(name, { diameter, height }, ctx.scene);
  m.position.set(x, y, z);
  m.material = mat(ctx, key);
  return m;
}

/** Дверь-наём: цветная панель в стене у точки выхода (не коллизия). */
export function doorMesh(ctx: BuildCtx, name: string, side: DoorSide): Mesh {
  const at = DOOR[side];
  const horiz = side === "north" || side === "south";
  const m = MeshBuilder.CreateBox(
    name,
    { width: horiz ? 2 : WALL_T, height: 2.2, depth: horiz ? WALL_T : 2 },
    ctx.scene,
  );
  m.position.set(at.x, 1.1, at.z + (side === "north" ? 0.9 : side === "south" ? -0.9 : 0));
  if (!horiz) m.position.x += side === "east" ? 0.9 : -0.9;
  m.material = mat(ctx, "door");
  return m;
}

/** Табличка (цилиндр-столбик + панель) рядом с дверью. */
export function signMesh(ctx: BuildCtx, name: string, x: number, z: number): Mesh {
  const post = cylinderMesh(ctx, `${name}:post`, "metal", x, 0.6, z, 0.12, 1.2);
  const board = boxMesh(ctx, `${name}:board`, "plastic", x, 1.45, z, 0.9, 0.5, 0.08);
  board.parent = post;
  return post;
}
