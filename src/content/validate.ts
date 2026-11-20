// Валидатор контента: чистая функция над данными бандла. Проверяет схему каждого
// типа (docs/CONTENT_SCHEMAS.md), дубликаты id и все перекрёстные ссылки. Возвращает
// список ошибок с путями; пустой список — контент корректен. Никаких исключений.
import type { ContentData } from "./types";

type Obj = Record<string, unknown>;

const STATS = ["medicine", "repair", "persuasion", "stealth"] as const;
const SLOTS = ["morning", "day", "evening"] as const;
const PHASES = [0, 1, 2, 3] as const;
const PHASE_KEYS: Record<string, true> = { "0": true, "1": true, "2": true, "3": true };
const LOCATIONS: Record<string, true> = {
  apartment: true,
  hospital: true,
  campus: true,
  pharmacy: true,
  square: true,
  workshop: true,
  "metro-station": true,
};
const BACKGROUND_IDS = ["intern", "student", "engineer"] as const;
const ITEM_CATEGORIES = ["consumable", "material", "tool"] as const;
const RECIPE_STATS = ["repair", "medicine"] as const;
const COND_TYPES = ["flag", "item", "stat", "quest", "worldPhase", "timeSlot", "day"] as const;
const COND_OPS = ["eq", "gte", "lte"] as const;
const QUEST_STATUSES = ["none", "active", "done", "failed"] as const;
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SLOT_INDEX: Record<string, number> = { morning: 0, day: 1, evening: 2 };

const DIALOG_FIELDS: Record<string, true> = {
  id: true,
  npc: true,
  text: true,
  choices: true,
  next: true,
};
const CHOICE_FIELDS: Record<string, true> = {
  text: true,
  conditions: true,
  effects: true,
  next: true,
};
const COND_FIELDS: Record<string, true> = { type: true, id: true, op: true, value: true };
const QUEST_FIELDS: Record<string, true> = {
  id: true,
  title: true,
  giver: true,
  targetLocation: true,
  worldPhases: true,
  stages: true,
  onCompleteEffects: true,
  onFailEffects: true,
};
const STAGE_FIELDS: Record<string, true> = {
  id: true,
  description: true,
  timeWindow: true,
  onEnterEffects: true,
};
const TIME_WINDOW_FIELDS: Record<string, true> = { from: true, to: true, days: true };
const ITEM_FIELDS: Record<string, true> = {
  id: true,
  name: true,
  category: true,
  stack: true,
  effects: true,
  recipe: true,
};
const RECIPE_FIELDS: Record<string, true> = { inputs: true, stat: true, dc: true };
const RECIPE_INPUT_FIELDS: Record<string, true> = { item: true, qty: true };
const ENEMY_FIELDS: Record<string, true> = {
  id: true,
  name: true,
  worldPhase: true,
  stats: true,
  actions: true,
  loot: true,
  xp: true,
};
const ENEMY_STATS_FIELDS: Record<string, true> = { hp: true, atk: true, def: true, spd: true };
const ENEMY_ACTION_FIELDS: Record<string, true> = {
  id: true,
  name: true,
  power: true,
  effects: true,
};
const LOOT_FIELDS: Record<string, true> = { item: true, chance: true };
const ENCOUNTER_FIELDS: Record<string, true> = {
  id: true,
  location: true,
  enemy: true,
  conditions: true,
  onWinEffects: true,
  onLoseEffects: true,
};
const CONTAINER_FIELDS: Record<string, true> = {
  id: true,
  name: true,
  location: true,
  at: true,
  phases: true,
  conditions: true,
  contents: true,
  onOpenEffects: true,
  locked: true,
};
const CONTAINER_AT_FIELDS: Record<string, true> = { x: true, z: true, r: true };
const CONTAINER_LOOT_FIELDS: Record<string, true> = { item: true, qty: true, chance: true };
const CONTAINER_LOCK_FIELDS: Record<string, true> = { skill: true, dc: true, tool: true };
const NPC_FIELDS: Record<string, true> = { id: true, name: true, home: true, phases: true };
const NPC_PHASE_FIELDS: Record<string, true> = { dialog: true, present: true };
const SKILL_FIELDS: Record<string, true> = { id: true, name: true, effect: true };
const BACKGROUND_FIELDS: Record<string, true> = {
  id: true,
  name: true,
  startLocation: true,
  startNpc: true,
  hp: true,
  resource: true,
  stats: true,
  skill: true,
};
const STATS_FIELDS: Record<string, true> = {
  medicine: true,
  repair: true,
  persuasion: true,
  stealth: true,
};

const ITEM_EFFECT_FIELDS: Record<string, true> = { type: true, item: true, qty: true };
const QUEST_EFFECT_FIELDS: Record<string, true> = { type: true, quest: true, stage: true };
const EFFECT_FIELDS: Record<string, Readonly<Record<string, true>>> = {
  setFlag: { type: true, id: true, value: true },
  giveItem: ITEM_EFFECT_FIELDS,
  takeItem: ITEM_EFFECT_FIELDS,
  stat: { type: true, stat: true, delta: true },
  resource: { type: true, delta: true },
  hp: { type: true, delta: true },
  advanceTime: { type: true, slots: true },
  startQuest: QUEST_EFFECT_FIELDS,
  advanceQuest: QUEST_EFFECT_FIELDS,
  completeQuest: { type: true, quest: true },
  failQuest: { type: true, quest: true },
  setWorldPhase: { type: true, phase: true },
  joinParty: { type: true, npc: true },
  leaveParty: { type: true, npc: true },
};

interface Refs {
  dialogs: Set<string>;
  quests: Set<string>;
  items: Set<string>;
  enemies: Set<string>;
  encounters: Set<string>;
  containers: Set<string>;
  npcs: Set<string>;
  skills: Set<string>;
  backgrounds: Set<string>;
  questStages: Map<string, Set<string>>;
}

function isObject(value: unknown): value is Obj {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asArray(value: unknown, path: string, errors: string[]): unknown[] {
  if (!Array.isArray(value)) {
    errors.push(`${path}: ожидался массив`);
    return [];
  }
  return value;
}

function checkFields(
  obj: Obj,
  allowed: Readonly<Record<string, true>>,
  path: string,
  errors: string[],
): void {
  for (const key of Object.keys(obj)) {
    if (allowed[key] !== true) errors.push(`${path}.${key}: неизвестное поле`);
  }
}

function readString(obj: Obj, key: string, path: string, errors: string[]): string | undefined {
  const value = obj[key];
  if (value === undefined) {
    errors.push(`${path}.${key}: обязательное поле`);
    return undefined;
  }
  if (typeof value !== "string" || value.trim() === "") {
    errors.push(`${path}.${key}: ожидалась непустая строка`);
    return undefined;
  }
  return value;
}

function optionalString(obj: Obj, key: string, path: string, errors: string[]): string | undefined {
  const value = obj[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.trim() === "") {
    errors.push(`${path}.${key}: ожидалась непустая строка`);
    return undefined;
  }
  return value;
}

function readNumber(obj: Obj, key: string, path: string, errors: string[]): number | undefined {
  const value = obj[key];
  if (value === undefined) {
    errors.push(`${path}.${key}: обязательное поле`);
    return undefined;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    errors.push(`${path}.${key}: ожидалось число`);
    return undefined;
  }
  return value;
}

function optionalNumber(obj: Obj, key: string, path: string, errors: string[]): number | undefined {
  const value = obj[key];
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    errors.push(`${path}.${key}: ожидалось число`);
    return undefined;
  }
  return value;
}

function readInteger(obj: Obj, key: string, path: string, errors: string[]): number | undefined {
  const value = readNumber(obj, key, path, errors);
  if (value === undefined) return undefined;
  if (!Number.isInteger(value)) {
    errors.push(`${path}.${key}: ожидалось целое число`);
    return undefined;
  }
  return value;
}

function optionalInteger(
  obj: Obj,
  key: string,
  path: string,
  errors: string[],
): number | undefined {
  const value = optionalNumber(obj, key, path, errors);
  if (value === undefined) return undefined;
  if (!Number.isInteger(value)) {
    errors.push(`${path}.${key}: ожидалось целое число`);
    return undefined;
  }
  return value;
}

function readBoolean(obj: Obj, key: string, path: string, errors: string[]): boolean | undefined {
  const value = obj[key];
  if (value === undefined) {
    errors.push(`${path}.${key}: обязательное поле`);
    return undefined;
  }
  if (typeof value !== "boolean") {
    errors.push(`${path}.${key}: ожидалось true/false`);
    return undefined;
  }
  return value;
}

function readEnum<T extends string>(
  obj: Obj,
  key: string,
  allowed: readonly T[],
  path: string,
  errors: string[],
): T | undefined {
  const value = obj[key];
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) {
    errors.push(`${path}.${key}: ожидалось одно из значений: ${allowed.join(", ")}`);
    return undefined;
  }
  return value as T;
}

function readRef(
  obj: Obj,
  key: string,
  ids: Set<string>,
  kind: string,
  path: string,
  errors: string[],
): string | undefined {
  const id = readString(obj, key, path, errors);
  if (id === undefined) return undefined;
  if (!ids.has(id)) errors.push(`${path}.${key}: битая ссылка на ${kind} "${id}"`);
  return id;
}

function readOptionalRef(
  obj: Obj,
  key: string,
  ids: Set<string>,
  kind: string,
  path: string,
  errors: string[],
): string | undefined {
  const id = optionalString(obj, key, path, errors);
  if (id === undefined) return undefined;
  if (!ids.has(id)) errors.push(`${path}.${key}: битая ссылка на ${kind} "${id}"`);
  return id;
}

function checkArrayOfEffects(
  value: unknown,
  path: string,
  refs: Refs,
  errors: string[],
  required: boolean,
): void {
  if (value === undefined) {
    if (required) errors.push(`${path}: обязательное поле`);
    return;
  }
  const effects = asArray(value, path, errors);
  effects.forEach((effect, index) => validateEffect(effect, `${path}[${index}]`, refs, errors));
}

function checkOptionalPositiveInt(obj: Obj, key: string, path: string, errors: string[]): void {
  const value = optionalInteger(obj, key, path, errors);
  if (value !== undefined && value <= 0) {
    errors.push(`${path}.${key}: ожидалось целое число > 0`);
  }
}

function collectIds(entries: unknown[], path: string, errors: string[]): Set<string> {
  const ids = new Set<string>();
  entries.forEach((entry, index) => {
    const entryPath = `${path}[${index}]`;
    if (!isObject(entry)) {
      errors.push(`${entryPath}: ожидался объект`);
      return;
    }
    const id = readString(entry, "id", entryPath, errors);
    if (id === undefined) return;
    if (!ID_PATTERN.test(id)) {
      errors.push(`${entryPath}.id: ожидался kebab-case, получено "${id}"`);
    }
    if (ids.has(id)) errors.push(`${entryPath}.id: дубликат id "${id}"`);
    else ids.add(id);
  });
  return ids;
}

function collectQuestStages(quests: unknown[]): Map<string, Set<string>> {
  const stages = new Map<string, Set<string>>();
  for (const entry of quests) {
    if (!isObject(entry) || typeof entry.id !== "string") continue;
    const stageIds = new Set<string>();
    if (Array.isArray(entry.stages)) {
      for (const stage of entry.stages) {
        if (isObject(stage) && typeof stage.id === "string") stageIds.add(stage.id);
      }
    }
    stages.set(entry.id, stageIds);
  }
  return stages;
}

function validateCond(raw: unknown, path: string, refs: Refs, errors: string[]): void {
  if (!isObject(raw)) {
    errors.push(`${path}: ожидался объект условия`);
    return;
  }
  checkFields(raw, COND_FIELDS, path, errors);
  const type = readEnum(raw, "type", COND_TYPES, path, errors);
  readEnum(raw, "op", COND_OPS, path, errors);
  if (type === undefined) return;

  const value = raw.value;
  if (value === undefined) {
    errors.push(`${path}.value: обязательное поле`);
  } else if (typeof value !== "number" && typeof value !== "string" && typeof value !== "boolean") {
    errors.push(`${path}.value: ожидалось число, строка или boolean`);
  }

  if (type === "flag" || type === "item" || type === "stat" || type === "quest") {
    const id = readString(raw, "id", path, errors);
    if (id !== undefined) {
      if (type === "item" && !refs.items.has(id)) {
        errors.push(`${path}.id: битая ссылка на item "${id}"`);
      } else if (type === "stat" && !(STATS as readonly string[]).includes(id)) {
        errors.push(`${path}.id: неизвестный стат "${id}"`);
      } else if (type === "quest" && !refs.quests.has(id)) {
        errors.push(`${path}.id: битая ссылка на quest "${id}"`);
      }
    }
  } else if (raw.id !== undefined) {
    errors.push(`${path}.id: для условия ${type} id не используется`);
  }

  if (type === "worldPhase") {
    if (typeof value !== "number" || !Number.isInteger(value) || !PHASES.includes(value as 0)) {
      errors.push(`${path}.value: фаза мира должна быть 0..3`);
    }
  } else if (type === "timeSlot") {
    if (typeof value !== "string" || !(SLOTS as readonly string[]).includes(value)) {
      errors.push(`${path}.value: ожидался слот morning/day/evening`);
    }
  } else if (type === "quest") {
    if (typeof value !== "string" || !(QUEST_STATUSES as readonly string[]).includes(value)) {
      errors.push(`${path}.value: ожидался статус none/active/done/failed`);
    }
  } else if (type === "flag") {
    if (typeof value !== "boolean") errors.push(`${path}.value: для flag ожидался boolean`);
  } else if (type === "stat" || type === "item") {
    if (typeof value !== "number") errors.push(`${path}.value: ожидалось число`);
  } else if (type === "day") {
    if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
      errors.push(`${path}.value: номер дня должен быть целым >= 1`);
    }
  }
}

function validateEffect(raw: unknown, path: string, refs: Refs, errors: string[]): void {
  if (!isObject(raw)) {
    errors.push(`${path}: ожидался объект эффекта`);
    return;
  }
  const type = readString(raw, "type", path, errors);
  if (type === undefined) return;
  const fields = EFFECT_FIELDS[type];
  if (fields === undefined) {
    errors.push(`${path}.type: неизвестный эффект "${type}"`);
    return;
  }
  checkFields(raw, fields, path, errors);

  switch (type) {
    case "setFlag": {
      readString(raw, "id", path, errors);
      if (raw.value !== undefined && typeof raw.value !== "boolean") {
        errors.push(`${path}.value: ожидался boolean`);
      }
      return;
    }
    case "giveItem":
    case "takeItem": {
      readRef(raw, "item", refs.items, "item", path, errors);
      checkOptionalPositiveInt(raw, "qty", path, errors);
      return;
    }
    case "stat": {
      readEnum(raw, "stat", STATS, path, errors);
      readNumber(raw, "delta", path, errors);
      return;
    }
    case "resource":
    case "hp": {
      readNumber(raw, "delta", path, errors);
      return;
    }
    case "advanceTime": {
      const slots = readInteger(raw, "slots", path, errors);
      if (slots !== undefined && slots <= 0) {
        errors.push(`${path}.slots: ожидалось целое число > 0`);
      }
      return;
    }
    case "startQuest":
    case "advanceQuest": {
      const quest = readRef(raw, "quest", refs.quests, "quest", path, errors);
      const stage = optionalString(raw, "stage", path, errors);
      if (quest !== undefined && stage !== undefined) {
        const stages = refs.questStages.get(quest);
        if (stages !== undefined && !stages.has(stage)) {
          errors.push(`${path}.stage: у квеста "${quest}" нет стадии "${stage}"`);
        }
      }
      return;
    }
    case "completeQuest":
    case "failQuest": {
      readRef(raw, "quest", refs.quests, "quest", path, errors);
      return;
    }
    case "setWorldPhase": {
      const phase = readInteger(raw, "phase", path, errors);
      if (phase !== undefined && !PHASES.includes(phase as 0)) {
        errors.push(`${path}.phase: фаза мира должна быть 0..3`);
      }
      return;
    }
    case "joinParty":
    case "leaveParty": {
      readRef(raw, "npc", refs.npcs, "NPC", path, errors);
      return;
    }
  }
}

function validateTimeWindow(raw: unknown, path: string, errors: string[]): void {
  if (!isObject(raw)) {
    errors.push(`${path}: ожидался объект timeWindow`);
    return;
  }
  checkFields(raw, TIME_WINDOW_FIELDS, path, errors);
  const from = readEnum(raw, "from", SLOTS, path, errors);
  const to = readEnum(raw, "to", SLOTS, path, errors);
  const days = optionalInteger(raw, "days", path, errors);
  if (days !== undefined && days < 0) {
    errors.push(`${path}.days: ожидалось целое число >= 0`);
  }
  if (from !== undefined && to !== undefined && SLOT_INDEX[from]! > SLOT_INDEX[to]!) {
    errors.push(`${path}: from "${from}" позже to "${to}"`);
  }
}

function validateDialog(raw: unknown, path: string, refs: Refs, errors: string[]): void {
  if (!isObject(raw)) {
    errors.push(`${path}: ожидался объект диалога`);
    return;
  }
  checkFields(raw, DIALOG_FIELDS, path, errors);
  readRef(raw, "npc", refs.npcs, "NPC", path, errors);
  readString(raw, "text", path, errors);
  readOptionalRef(raw, "next", refs.dialogs, "диалог", path, errors);

  if (raw.choices !== undefined) {
    const choices = asArray(raw.choices, `${path}.choices`, errors);
    if (choices.length === 0) {
      errors.push(`${path}.choices: пустой массив выборов (уберите поле или добавьте выбор)`);
    }
    choices.forEach((choice, index) => {
      const choicePath = `${path}.choices[${index}]`;
      if (!isObject(choice)) {
        errors.push(`${choicePath}: ожидался объект выбора`);
        return;
      }
      checkFields(choice, CHOICE_FIELDS, choicePath, errors);
      readString(choice, "text", choicePath, errors);
      readOptionalRef(choice, "next", refs.dialogs, "диалог", choicePath, errors);
      if (choice.conditions !== undefined) {
        const conditions = asArray(choice.conditions, `${choicePath}.conditions`, errors);
        conditions.forEach((cond, condIndex) =>
          validateCond(cond, `${choicePath}.conditions[${condIndex}]`, refs, errors),
        );
      }
      checkArrayOfEffects(choice.effects, `${choicePath}.effects`, refs, errors, false);
    });
  }
}

function validateQuest(raw: unknown, path: string, refs: Refs, errors: string[]): void {
  if (!isObject(raw)) {
    errors.push(`${path}: ожидался объект квеста`);
    return;
  }
  checkFields(raw, QUEST_FIELDS, path, errors);
  readString(raw, "title", path, errors);
  readRef(raw, "giver", refs.npcs, "NPC", path, errors);

  const worldPhases = asArray(raw.worldPhases, `${path}.worldPhases`, errors);
  const targetLocation = readString(raw, "targetLocation", path, errors);
  if (targetLocation !== undefined && LOCATIONS[targetLocation] !== true) {
    errors.push(`${path}.targetLocation: неизвестная локация "${targetLocation}"`);
  }
  const seenPhases = new Set<number>();
  worldPhases.forEach((phase, index) => {
    const phasePath = `${path}.worldPhases[${index}]`;
    if (typeof phase !== "number" || !Number.isInteger(phase) || !PHASES.includes(phase as 0)) {
      errors.push(`${phasePath}: фаза мира должна быть 0..3`);
      return;
    }
    if (seenPhases.has(phase)) errors.push(`${phasePath}: дубликат фазы ${phase}`);
    seenPhases.add(phase);
  });

  const stages = asArray(raw.stages, `${path}.stages`, errors);
  if (stages.length === 0) errors.push(`${path}.stages: пустой массив стадий`);
  const seenStages = new Set<string>();
  stages.forEach((stage, index) => {
    const stagePath = `${path}.stages[${index}]`;
    if (!isObject(stage)) {
      errors.push(`${stagePath}: ожидался объект стадии`);
      return;
    }
    checkFields(stage, STAGE_FIELDS, stagePath, errors);
    const stageId = readString(stage, "id", stagePath, errors);
    readString(stage, "description", stagePath, errors);
    if (stageId !== undefined) {
      if (seenStages.has(stageId)) {
        errors.push(`${stagePath}.id: дубликат стадии "${stageId}"`);
      }
      seenStages.add(stageId);
    }
    if (stage.timeWindow !== undefined) {
      validateTimeWindow(stage.timeWindow, `${stagePath}.timeWindow`, errors);
    }
    checkArrayOfEffects(stage.onEnterEffects, `${stagePath}.onEnterEffects`, refs, errors, false);
  });

  checkArrayOfEffects(raw.onCompleteEffects, `${path}.onCompleteEffects`, refs, errors, false);
  checkArrayOfEffects(raw.onFailEffects, `${path}.onFailEffects`, refs, errors, false);
}

function validateItem(raw: unknown, path: string, refs: Refs, errors: string[]): void {
  if (!isObject(raw)) {
    errors.push(`${path}: ожидался объект предмета`);
    return;
  }
  checkFields(raw, ITEM_FIELDS, path, errors);
  readString(raw, "name", path, errors);
  readEnum(raw, "category", ITEM_CATEGORIES, path, errors);
  const stack = readInteger(raw, "stack", path, errors);
  if (stack !== undefined && stack <= 0) errors.push(`${path}.stack: ожидалось целое число > 0`);
  checkArrayOfEffects(raw.effects, `${path}.effects`, refs, errors, true);

  if (raw.recipe !== undefined) {
    const recipePath = `${path}.recipe`;
    if (!isObject(raw.recipe)) {
      errors.push(`${recipePath}: ожидался объект рецепта`);
      return;
    }
    checkFields(raw.recipe, RECIPE_FIELDS, recipePath, errors);
    readEnum(raw.recipe, "stat", RECIPE_STATS, recipePath, errors);
    const dc = readNumber(raw.recipe, "dc", recipePath, errors);
    if (dc !== undefined && dc <= 0) errors.push(`${recipePath}.dc: ожидалось число > 0`);

    const inputs = asArray(raw.recipe.inputs, `${recipePath}.inputs`, errors);
    if (inputs.length === 0) errors.push(`${recipePath}.inputs: пустой массив ингредиентов`);
    inputs.forEach((input, index) => {
      const inputPath = `${recipePath}.inputs[${index}]`;
      if (!isObject(input)) {
        errors.push(`${inputPath}: ожидался объект ингредиента`);
        return;
      }
      checkFields(input, RECIPE_INPUT_FIELDS, inputPath, errors);
      readRef(input, "item", refs.items, "item", inputPath, errors);
      checkOptionalPositiveInt(input, "qty", inputPath, errors);
    });
  }
}

function validateEnemy(raw: unknown, path: string, refs: Refs, errors: string[]): void {
  if (!isObject(raw)) {
    errors.push(`${path}: ожидался объект врага`);
    return;
  }
  checkFields(raw, ENEMY_FIELDS, path, errors);
  readString(raw, "name", path, errors);
  const worldPhase = readInteger(raw, "worldPhase", path, errors);
  if (worldPhase !== undefined && !PHASES.includes(worldPhase as 0)) {
    errors.push(`${path}.worldPhase: фаза мира должна быть 0..3`);
  }

  if (!isObject(raw.stats)) {
    errors.push(`${path}.stats: ожидался объект характеристик`);
  } else {
    checkFields(raw.stats, ENEMY_STATS_FIELDS, `${path}.stats`, errors);
    for (const key of ["hp", "atk", "def", "spd"] as const) {
      const value = readNumber(raw.stats, key, `${path}.stats`, errors);
      if (value !== undefined && value < 0) {
        errors.push(`${path}.stats.${key}: ожидалось число >= 0`);
      }
    }
    const hp = raw.stats.hp;
    if (typeof hp === "number" && hp <= 0) {
      errors.push(`${path}.stats.hp: ожидалось число > 0`);
    }
  }

  const actions = asArray(raw.actions, `${path}.actions`, errors);
  if (actions.length === 0) errors.push(`${path}.actions: пустой массив действий`);
  const seenActions = new Set<string>();
  actions.forEach((action, index) => {
    const actionPath = `${path}.actions[${index}]`;
    if (!isObject(action)) {
      errors.push(`${actionPath}: ожидался объект действия`);
      return;
    }
    checkFields(action, ENEMY_ACTION_FIELDS, actionPath, errors);
    const actionId = readString(action, "id", actionPath, errors);
    readString(action, "name", actionPath, errors);
    const power = readNumber(action, "power", actionPath, errors);
    if (power !== undefined && power < 0) {
      errors.push(`${actionPath}.power: ожидалось число >= 0`);
    }
    if (actionId !== undefined) {
      if (seenActions.has(actionId)) {
        errors.push(`${actionPath}.id: дубликат действия "${actionId}"`);
      }
      seenActions.add(actionId);
    }
    checkArrayOfEffects(action.effects, `${actionPath}.effects`, refs, errors, false);
  });

  const loot = asArray(raw.loot, `${path}.loot`, errors);
  loot.forEach((entry, index) => {
    const lootPath = `${path}.loot[${index}]`;
    if (!isObject(entry)) {
      errors.push(`${lootPath}: ожидался объект добычи`);
      return;
    }
    checkFields(entry, LOOT_FIELDS, lootPath, errors);
    readRef(entry, "item", refs.items, "item", lootPath, errors);
    const chance = readNumber(entry, "chance", lootPath, errors);
    if (chance !== undefined && (chance < 0 || chance > 1)) {
      errors.push(`${lootPath}.chance: ожидалось число 0..1`);
    }
  });

  const xp = readNumber(raw, "xp", path, errors);
  if (xp !== undefined && xp < 0) errors.push(`${path}.xp: ожидалось число >= 0`);
}

function validateEncounter(raw: unknown, path: string, refs: Refs, errors: string[]): void {
  if (!isObject(raw)) {
    errors.push(`${path}: ожидался объект стычки`);
    return;
  }
  checkFields(raw, ENCOUNTER_FIELDS, path, errors);
  const location = readString(raw, "location", path, errors);
  if (location !== undefined && LOCATIONS[location] !== true) {
    errors.push(`${path}.location: неизвестная локация "${location}"`);
  }
  readRef(raw, "enemy", refs.enemies, "враг", path, errors);

  if (raw.conditions !== undefined) {
    const conditions = asArray(raw.conditions, `${path}.conditions`, errors);
    conditions.forEach((cond, index) =>
      validateCond(cond, `${path}.conditions[${index}]`, refs, errors),
    );
  }
  checkArrayOfEffects(raw.onWinEffects, `${path}.onWinEffects`, refs, errors, false);
  checkArrayOfEffects(raw.onLoseEffects, `${path}.onLoseEffects`, refs, errors, false);
}

function validateContainer(raw: unknown, path: string, refs: Refs, errors: string[]): void {
  if (!isObject(raw)) {
    errors.push(`${path}: ожидался объект контейнера`);
    return;
  }
  checkFields(raw, CONTAINER_FIELDS, path, errors);
  readString(raw, "name", path, errors);
  const location = readString(raw, "location", path, errors);
  if (location !== undefined && LOCATIONS[location] !== true) {
    errors.push(`${path}.location: неизвестная локация "${location}"`);
  }

  if (!isObject(raw.at)) {
    errors.push(`${path}.at: ожидался объект { x, z, r }`);
  } else {
    checkFields(raw.at, CONTAINER_AT_FIELDS, `${path}.at`, errors);
    readNumber(raw.at, "x", `${path}.at`, errors);
    readNumber(raw.at, "z", `${path}.at`, errors);
    const radius = readNumber(raw.at, "r", `${path}.at`, errors);
    if (radius !== undefined && radius <= 0) {
      errors.push(`${path}.at.r: ожидалось число > 0`);
    }
  }

  if (raw.phases !== undefined) {
    const phases = asArray(raw.phases, `${path}.phases`, errors);
    const seen = new Set<number>();
    phases.forEach((phase, index) => {
      const phasePath = `${path}.phases[${index}]`;
      if (typeof phase !== "number" || !Number.isInteger(phase)) {
        errors.push(`${phasePath}: ожидалась целая фаза 0..3`);
        return;
      }
      if (!PHASES.includes(phase as 0)) {
        errors.push(`${phasePath}: фаза мира должна быть 0..3`);
      }
      if (seen.has(phase)) errors.push(`${phasePath}: дубликат фазы ${phase}`);
      seen.add(phase);
    });
  }

  if (raw.conditions !== undefined) {
    const conditions = asArray(raw.conditions, `${path}.conditions`, errors);
    conditions.forEach((cond, index) =>
      validateCond(cond, `${path}.conditions[${index}]`, refs, errors),
    );
  }

  const contents = asArray(raw.contents, `${path}.contents`, errors);
  contents.forEach((entry, index) => {
    const lootPath = `${path}.contents[${index}]`;
    if (!isObject(entry)) {
      errors.push(`${lootPath}: ожидался объект добычи`);
      return;
    }
    checkFields(entry, CONTAINER_LOOT_FIELDS, lootPath, errors);
    readRef(entry, "item", refs.items, "item", lootPath, errors);
    checkOptionalPositiveInt(entry, "qty", lootPath, errors);
    const chance = optionalNumber(entry, "chance", lootPath, errors);
    if (chance !== undefined && (chance < 0 || chance > 1)) {
      errors.push(`${lootPath}.chance: ожидалось число 0..1`);
    }
  });

  checkArrayOfEffects(raw.onOpenEffects, `${path}.onOpenEffects`, refs, errors, false);

  if (raw.locked !== undefined) {
    if (!isObject(raw.locked)) {
      errors.push(`${path}.locked: ожидался объект замка`);
      return;
    }
    checkFields(raw.locked, CONTAINER_LOCK_FIELDS, `${path}.locked`, errors);
    readEnum(raw.locked, "skill", STATS, `${path}.locked`, errors);
    const dc = readInteger(raw.locked, "dc", `${path}.locked`, errors);
    if (dc !== undefined && dc <= 0) {
      errors.push(`${path}.locked.dc: ожидалось целое число > 0`);
    }
    readOptionalRef(raw.locked, "tool", refs.items, "item", `${path}.locked`, errors);
  }
}

function validateNpc(raw: unknown, path: string, refs: Refs, errors: string[]): void {
  if (!isObject(raw)) {
    errors.push(`${path}: ожидался объект NPC`);
    return;
  }
  checkFields(raw, NPC_FIELDS, path, errors);
  readString(raw, "name", path, errors);
  const home = readString(raw, "home", path, errors);
  if (home !== undefined && LOCATIONS[home] !== true) {
    errors.push(`${path}.home: неизвестная локация "${home}"`);
  }

  if (!isObject(raw.phases)) {
    errors.push(`${path}.phases: ожидался объект фаз`);
    return;
  }
  const phaseKeys = Object.keys(raw.phases);
  if (phaseKeys.length === 0) errors.push(`${path}.phases: пустой объект фаз`);
  for (const key of phaseKeys) {
    const phasePath = `${path}.phases.${key}`;
    if (PHASE_KEYS[key] !== true) {
      errors.push(`${phasePath}: фаза должна быть 0..3`);
      continue;
    }
    const phase = raw.phases[key];
    if (!isObject(phase)) {
      errors.push(`${phasePath}: ожидался объект фазы`);
      continue;
    }
    checkFields(phase, NPC_PHASE_FIELDS, phasePath, errors);
    readBoolean(phase, "present", phasePath, errors);
    readRef(phase, "dialog", refs.dialogs, "диалог", phasePath, errors);
  }
}

function validateSkill(raw: unknown, path: string, refs: Refs, errors: string[]): void {
  if (!isObject(raw)) {
    errors.push(`${path}: ожидался объект навыка`);
    return;
  }
  checkFields(raw, SKILL_FIELDS, path, errors);
  readString(raw, "name", path, errors);
  if (raw.effect === undefined) errors.push(`${path}.effect: обязательное поле`);
  else validateEffect(raw.effect, `${path}.effect`, refs, errors);
}

function validateBackground(raw: unknown, path: string, refs: Refs, errors: string[]): void {
  if (!isObject(raw)) {
    errors.push(`${path}: ожидался объект бэкграунда`);
    return;
  }
  checkFields(raw, BACKGROUND_FIELDS, path, errors);
  readEnum(raw, "id", BACKGROUND_IDS, path, errors);
  readString(raw, "name", path, errors);
  const startLocation = readString(raw, "startLocation", path, errors);
  if (startLocation !== undefined && LOCATIONS[startLocation] !== true) {
    errors.push(`${path}.startLocation: неизвестная локация "${startLocation}"`);
  }
  readRef(raw, "startNpc", refs.npcs, "NPC", path, errors);
  const hp = readInteger(raw, "hp", path, errors);
  if (hp !== undefined && hp <= 0) errors.push(`${path}.hp: ожидалось целое число > 0`);
  const resource = readInteger(raw, "resource", path, errors);
  if (resource !== undefined && resource <= 0) {
    errors.push(`${path}.resource: ожидалось целое число > 0`);
  }
  readRef(raw, "skill", refs.skills, "навык", path, errors);

  if (!isObject(raw.stats)) {
    errors.push(`${path}.stats: ожидался объект статов`);
  } else {
    checkFields(raw.stats, STATS_FIELDS, `${path}.stats`, errors);
    for (const stat of STATS) {
      const value = readNumber(raw.stats, stat, `${path}.stats`, errors);
      if (value !== undefined && value < 0) {
        errors.push(`${path}.stats.${stat}: ожидалось число >= 0`);
      }
    }
  }
}

/** Проверяет весь контент; возвращает ошибки с путями, пустой массив — всё валидно. */
export function validateContent(data: ContentData): string[] {
  const errors: string[] = [];
  const rawData = data as unknown as Obj;
  if (!isObject(data)) return ["data: ожидался объект ContentData"];

  const dialogs = asArray(rawData.dialogs, "dialogs", errors);
  const quests = asArray(rawData.quests, "quests", errors);
  const enemies = asArray(rawData.enemies, "enemies", errors);
  const items = asArray(rawData.items, "items", errors);
  const encounters = asArray(rawData.encounters, "encounters", errors);
  const containers = asArray(rawData.containers, "containers", errors);
  const npcs = asArray(rawData.npcs, "npcs", errors);
  const skills = asArray(rawData.skills, "skills", errors);
  const backgrounds = asArray(rawData.backgrounds, "backgrounds", errors);

  const refs: Refs = {
    dialogs: collectIds(dialogs, "dialogs", errors),
    quests: collectIds(quests, "quests", errors),
    items: collectIds(items, "items", errors),
    enemies: collectIds(enemies, "enemies", errors),
    encounters: collectIds(encounters, "encounters", errors),
    containers: collectIds(containers, "containers", errors),
    npcs: collectIds(npcs, "npcs", errors),
    skills: collectIds(skills, "skills", errors),
    backgrounds: collectIds(backgrounds, "backgrounds", errors),
    questStages: collectQuestStages(quests),
  };

  dialogs.forEach((entry, index) => validateDialog(entry, `dialogs[${index}]`, refs, errors));
  quests.forEach((entry, index) => validateQuest(entry, `quests[${index}]`, refs, errors));
  items.forEach((entry, index) => validateItem(entry, `items[${index}]`, refs, errors));
  enemies.forEach((entry, index) => validateEnemy(entry, `enemies[${index}]`, refs, errors));
  encounters.forEach((entry, index) =>
    validateEncounter(entry, `encounters[${index}]`, refs, errors),
  );
  containers.forEach((entry, index) =>
    validateContainer(entry, `containers[${index}]`, refs, errors),
  );
  npcs.forEach((entry, index) => validateNpc(entry, `npcs[${index}]`, refs, errors));
  skills.forEach((entry, index) => validateSkill(entry, `skills[${index}]`, refs, errors));
  backgrounds.forEach((entry, index) =>
    validateBackground(entry, `backgrounds[${index}]`, refs, errors),
  );

  return errors;
}
