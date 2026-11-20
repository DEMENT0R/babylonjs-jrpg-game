// Типы JSON-контента — зеркало docs/CONTENT_SCHEMAS.md. Единственный источник правды
// для контента и валидатора; системы импортируют типы отсюда.
import type { BackgroundId, SkillId, TimeSlot, WorldPhase } from "../types";

export const CONTENT_VERSION = 1;

/** Обёртка каждого файла: { contentVersion, locale, data }. */
export interface ContentFile<T> {
  contentVersion: number;
  locale: string;
  data: T[];
}

/** Условие показа/доступности. `id` обязателен для flag/item/stat/quest. */
export interface Cond {
  type: "flag" | "item" | "stat" | "quest" | "worldPhase" | "timeSlot" | "day";
  id?: string;
  op: "eq" | "gte" | "lte";
  value: number | string | boolean;
}

export type Effect =
  | { type: "setFlag"; id: string; value?: boolean }
  | { type: "giveItem" | "takeItem"; item: string; qty?: number }
  | { type: "stat"; stat: SkillId; delta: number }
  | { type: "resource"; delta: number }
  | { type: "hp"; delta: number }
  | { type: "advanceTime"; slots: number }
  | { type: "startQuest"; quest: string; stage?: string }
  | { type: "advanceQuest"; quest: string; stage?: string }
  | { type: "completeQuest"; quest: string }
  | { type: "failQuest"; quest: string }
  | { type: "setWorldPhase"; phase: WorldPhase }
  | { type: "joinParty" | "leaveParty"; npc: string };

export interface DialogChoice {
  text: string;
  conditions?: Cond[];
  effects?: Effect[];
  next?: string;
}

export interface DialogNode {
  id: string;
  npc: string;
  text: string;
  choices?: DialogChoice[];
  next?: string;
}

/** Окно времени: `{from,to}` — день взятия, `{days,from,to}` — со сдвигом. */
export interface TimeWindow {
  from: TimeSlot;
  to: TimeSlot;
  days?: number;
}

export interface QuestStage {
  id: string;
  description: string;
  timeWindow?: TimeWindow;
  onEnterEffects?: Effect[];
}

export interface Quest {
  id: string;
  title: string;
  giver: string;
  /** Локация цели: маркер «квест» на карте района в меню паузы. */
  targetLocation?: string;
  worldPhases: WorldPhase[];
  stages: QuestStage[];
  onCompleteEffects?: Effect[];
  onFailEffects?: Effect[];
}

export interface Recipe {
  inputs: { item: string; qty: number }[];
  stat: "repair" | "medicine";
  dc: number;
}

export interface Item {
  id: string;
  name: string;
  category: "consumable" | "material" | "tool";
  stack: number;
  effects: Effect[];
  recipe?: Recipe;
}

export interface EnemyAction {
  id: string;
  name: string;
  power: number;
  effects?: Effect[];
}

export interface Enemy {
  id: string;
  name: string;
  worldPhase: WorldPhase;
  stats: { hp: number; atk: number; def: number; spd: number };
  actions: EnemyAction[];
  loot: { item: string; chance: number }[];
  xp: number;
}

/** Стычка в локации: враг из контента, условия появления и эффекты исхода.
 *  Одноразовый: победа помечает `encounter:<id>:done`, поражение/побег — нет
 *  (можно вернуться и попробовать снова). */
export interface Encounter {
  id: string;
  location: string;
  enemy: string;
  conditions?: Cond[];
  onWinEffects?: Effect[];
  onLoseEffects?: Effect[];
}
/** Дроп контейнера: тот же словарь, что `Enemy.loot`; `qty` по умолчанию 1,
 *  `chance` по умолчанию 1 (всегда). */
export interface ContainerLoot {
  item: string;
  qty?: number;
  chance?: number;
}

/** Замок: открывается при навыке `skill` >= `dc` и предмете `tool` (если задан). */
export interface ContainerLock {
  skill: SkillId;
  dc: number;
  tool?: string;
}

/** Контейнер в локации (аптечка/ящик/тележка): осматривается один раз, лут
 *  роллится по шансу; открытие помечает флагом `container:<id>:opened`
 *  (сейв-модель не меняется). */
export interface Container {
  id: string;
  name: string;
  location: string;
  at: { x: number; z: number; r: number };
  /** Фазы мира, где контейнер существует; без поля — все фазы. */
  phases?: WorldPhase[];
  conditions?: Cond[];
  contents: ContainerLoot[];
  onOpenEffects?: Effect[];
  locked?: ContainerLock;
}

export interface NpcPhase {
  dialog: string;
  present: boolean;
}

export interface Npc {
  id: string;
  name: string;
  home: string;
  phases: Record<number, NpcPhase>;
}

export interface SkillDef {
  id: string;
  name: string;
  effect: Effect;
}

export interface BackgroundDef {
  id: BackgroundId;
  name: string;
  startLocation: string;
  startNpc: string;
  hp: number;
  resource: number;
  stats: Record<SkillId, number>;
  skill: string;
}

/** Наборы контента, из которых собирается провайдер (каждый — data-массив файла). */
export interface ContentData {
  dialogs: DialogNode[];
  quests: Quest[];
  items: Item[];
  enemies: Enemy[];
  encounters: Encounter[];
  npcs: Npc[];
  skills: SkillDef[];
  backgrounds: BackgroundDef[];
  containers: Container[];
}
