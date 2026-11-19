// Межслайсовые контракты. Единственный источник — docs/CONTRACTS.md и
// docs/CONTENT_SCHEMAS.md; при расхождении приоритет у этих типов, доку обновлять
// тем же коммитом. Менять сигнатуры — только отдельным коммитом с правкой доков.

import type { Material, Scene } from "@babylonjs/core";
import type { IContentProvider } from "./content";

// ─── Store (state/store.ts, слайс 2; потребители 3, 5, 6) ─────────────────────

export interface Store<S> {
  get(): S;
  update(fn: (draft: S) => void): void;
  subscribe(fn: (s: S) => void): () => void;
}

// ─── Input (core/input.ts, слайс 1; потребители 4, 5) ──────────────────────────

export type InputAction = "up" | "down" | "left" | "right" | "confirm" | "cancel" | "menu" | "run";

export interface Input {
  axis(): { x: number; y: number };
  pressed(a: InputAction): boolean;
  held(a: InputAction): boolean;
}

// ─── Сейв (state/gamestate.ts, слайс 2; зеркало docs/CONTENT_SCHEMAS.md) ──────

export type SkillId = "medicine" | "repair" | "persuasion" | "stealth";
export type BackgroundId = "intern" | "student" | "engineer";
export type TimeSlot = "morning" | "day" | "evening";
export type WorldPhase = 0 | 1 | 2 | 3;
export type QuestStatus = "active" | "done" | "failed";

/** Сейв v1 — историческая модель; читается только миграцией (persistence/migrations.ts). */
export interface SaveV1 {
  saveVersion: 1;
  hero: {
    background: BackgroundId;
    name: string;
    hp: number;
    resource: number;
    stats: Record<SkillId, number>;
    skills: string[];
  };
  party: string[];
  worldPhase: WorldPhase;
  time: { day: number; slot: TimeSlot };
  location: string;
  pos: [number, number];
  inventory: { item: string; qty: number }[];
  questStates: Record<string, { stage: string; status: QuestStatus }>;
  flags: Record<string, boolean>;
}

/**
 * Сейв v2 (текущий). Отличия от v1: XP/уровень/очки навыков у героя и `startedDay`
 * у квеста — окно `timeWindow` отсчитывается от дня взятия (docs/CONTENT_SCHEMAS.md).
 */
export interface SaveV2 {
  saveVersion: 2;
  hero: {
    background: BackgroundId;
    name: string;
    hp: number;
    resource: number;
    level: number;
    xp: number;
    skillPoints: number;
    stats: Record<SkillId, number>;
    skills: string[];
  };
  party: string[];
  worldPhase: WorldPhase;
  time: { day: number; slot: TimeSlot };
  location: string;
  pos: [number, number];
  inventory: { item: string; qty: number }[];
  questStates: Record<string, { stage: string; status: QuestStatus; startedDay: number }>;
  flags: Record<string, boolean>;
}

/** Игровое состояние = текущая сейв-модель, без адаптеров. */
export type GameState = SaveV2;

// ─── Мир (core/, слайс 1; world/locations/* — слайс 4) ─────────────────────────

/** AABB-препятствие: центр (x, z) + полные ширина/глубина. */
export interface SolidBox {
  x: number;
  z: number;
  w: number;
  d: number;
}

/** Регистрация стен/препятствований для локации; реализует слайс 1 в core/. */
export interface SolidRegistry {
  add(box: SolidBox): void;
}

/** Одна геометрия → материал по ключу и фазе мира; реализует слайс 1 в core/. */
export interface PhasedAssets {
  material(key: string, phase: WorldPhase): Material;
}

export interface ExitDef {
  to: string;
  at: { x: number; z: number; r: number };
  spawn: { x: number; z: number; yaw?: number };
  label: string;
}

export interface InteractDef {
  at: { x: number; z: number; r: number };
  /** Подпись объекта для подсказки в фокусе (ui/interactHint.ts); без label — без подсказки. */
  label?: string;
  onConfirm(ctx: UpdateCtx): void;
}

export interface BuildCtx {
  scene: Scene;
  worldPhase: WorldPhase;
  assets: PhasedAssets;
  solids: SolidRegistry;
}

export interface UpdateCtx {
  scene: Scene;
  dt: number;
  input: Input;
  store: Store<GameState>;
  /** Контент для интеракций локаций (например, провал окон квестов при отдыхе). */
  content: IContentProvider;
}

export interface LocationDef {
  id: string;
  build(ctx: BuildCtx): void;
  update(ctx: UpdateCtx): void;
  exits: ExitDef[];
  interacts: InteractDef[];
}
