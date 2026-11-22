import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import type { Material } from "@babylonjs/core/Materials/material";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { Scene } from "@babylonjs/core/scene";
import type { PhasedAssets, SolidRegistry, TimeSlot, WorldPhase } from "../types";

/** Палитры по фазам мира: 0 — норма, 1 — тревога, 2 — упадок, 3 — катастрофа.
 *  Ключи = материалы локаций слайса 4; с ростом фазы серее/мрачнее. */
const PALETTES: Record<WorldPhase, Record<string, string>> = {
  0: {
    floor: "#b8a888",
    wall: "#cfd4d8",
    door: "#8a6f52",
    wood: "#9c7a56",
    metal: "#a8b0b8",
    plastic: "#d8d0c0",
    fabric: "#c96f4a",
    stone: "#b0aca4",
    glass: "#bcd8e0",
    foliage: "#6f9a58",
    dirt: "#8a7a5c",
  },
  1: {
    floor: "#a89a85",
    wall: "#b9bdc0",
    door: "#7d6850",
    wood: "#8d7050",
    metal: "#98a0a6",
    plastic: "#c2bcac",
    fabric: "#b86848",
    stone: "#a09c96",
    glass: "#adc4cc",
    foliage: "#618251",
    dirt: "#7d6f56",
  },
  2: {
    floor: "#8d8578",
    wall: "#9aa0a4",
    door: "#6a5a48",
    wood: "#75604a",
    metal: "#82888c",
    plastic: "#a49e92",
    fabric: "#96604a",
    stone: "#87837e",
    glass: "#8fa4ab",
    foliage: "#4f6a44",
    dirt: "#6a5e4a",
  },
  3: {
    floor: "#6a655e",
    wall: "#75797c",
    door: "#4d443a",
    wood: "#574a3c",
    metal: "#616568",
    plastic: "#7c776e",
    fabric: "#6e4536",
    stone: "#64615d",
    glass: "#69767a",
    foliage: "#3d5236",
    dirt: "#514737",
  },
};

/** Внешний вид сцены по слоту времени (до HUD-слайса переключается клавишей T). */
const SLOT_LOOK: Record<TimeSlot, { ambient: number; sun: number; tint: string; sky: string }> = {
  morning: { ambient: 0.9, sun: 0.4, tint: "#fff2d8", sky: "#a8c4dc" },
  day: { ambient: 0.75, sun: 0.6, tint: "#ffffff", sky: "#8fb6d8" },
  evening: { ambient: 0.5, sun: 0.12, tint: "#ffb48a", sky: "#3d3a52" },
};

export interface PhasedAssetsImpl extends PhasedAssets {
  /** Видимый слот времени: свет и фон сцены. Расширение контракта, не ломает PhasedAssets. */
  setSlot(slot: TimeSlot): void;
}

/** Кэш Material по ключу+фазе + свет сцены; геометрия одна, перекраска по фазе. */
export function createPhasedAssets(scene: Scene): PhasedAssetsImpl {
  const cache = new Map<string, StandardMaterial>();
  const ambient = new HemisphericLight("ambientLight", new Vector3(0.2, 1, 0.1), scene);
  const sun = new DirectionalLight("sunLight", new Vector3(-0.4, -1, -0.3), scene);
  return {
    material(key: string, phase: WorldPhase): Material {
      const id = `${key}#${phase}`;
      let mat = cache.get(id);
      if (!mat) {
        const palette = PALETTES[phase];
        const hex = palette[key] ?? palette["floor"] ?? "#8a8a8a";
        mat = new StandardMaterial(id, scene);
        mat.diffuseColor = Color3.FromHexString(hex);
        mat.specularColor = new Color3(0.05, 0.05, 0.05); // матовый low-poly
        cache.set(id, mat);
      }
      return mat;
    },
    setSlot(slot: TimeSlot): void {
      const look = SLOT_LOOK[slot];
      ambient.intensity = look.ambient;
      ambient.diffuse = Color3.FromHexString(look.tint);
      sun.intensity = look.sun;
      scene.clearColor = Color4.FromHexString(`${look.sky}ff`);
    },
  };
}

export interface BoxGeometry {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
}

/** Низкополигональный бокс (flat shading): фундамент полов/стен/мебели локаций. */
export function buildBox(scene: Scene, name: string, g: BoxGeometry, material?: Material): Mesh {
  const mesh = CreateBox(name, { width: g.w, height: g.h, depth: g.d }, scene);
  mesh.position.set(g.x, g.y, g.z);
  mesh.convertToFlatShadedMesh();
  if (material) mesh.material = material;
  return mesh;
}

/** Бокс-препятствие от пола: меш + регистрация AABB в SolidRegistry. */
export function buildSolidBox(
  scene: Scene,
  name: string,
  g: { x: number; z: number; w: number; d: number; h: number },
  material: Material,
  solids: SolidRegistry,
): Mesh {
  const mesh = buildBox(scene, name, { ...g, y: g.h / 2 }, material);
  solids.add({ x: g.x, z: g.z, w: g.w, d: g.d });
  return mesh;
}
