// Строгая валидация сейва: все поля обязательны, лишние запрещены
// (docs/CONTENT_SCHEMAS.md, «Сейв v2»). Ошибки — с путём до поля.
// v1 оставлен только для чтения старых сейвов миграцией.
import type { SaveV1, SaveV2 } from "../../types";

// Статические таблицы допустимых значений: membership-проверки по ключу.
const BACKGROUND_IDS: Record<string, true> = { intern: true, student: true, engineer: true };
const TIME_SLOTS: Record<string, true> = { morning: true, day: true, evening: true };
const QUEST_STATUSES: Record<string, true> = { active: true, done: true, failed: true };
const WORLD_PHASES: Record<number, true> = { 0: true, 1: true, 2: true, 3: true };
const SKILL_IDS = ["medicine", "repair", "persuasion", "stealth"] as const;

const ROOT_KEYS = [
  "flags",
  "hero",
  "inventory",
  "location",
  "party",
  "pos",
  "questStates",
  "saveVersion",
  "time",
  "worldPhase",
] as const;
const HERO_KEYS_V1 = ["background", "hp", "name", "resource", "skills", "stats"] as const;
const HERO_KEYS_V2 = [
  "background",
  "hp",
  "level",
  "name",
  "resource",
  "skillPoints",
  "skills",
  "stats",
  "xp",
] as const;
const TIME_KEYS = ["day", "slot"] as const;
const INVENTORY_ITEM_KEYS = ["item", "qty"] as const;
const QUEST_STATE_KEYS_V1 = ["stage", "status"] as const;
const QUEST_STATE_KEYS_V2 = ["stage", "startedDay", "status"] as const;

function fail(path: string, detail: string): never {
  throw new Error(`Некорректный сейв — ${path}: ${detail}`);
}

function asObject(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail(path, "ожидался объект");
  }
  return value as Record<string, unknown>;
}

function checkExactKeys(obj: Record<string, unknown>, keys: readonly string[], path: string): void {
  const expected = new Set(keys);
  for (const key of Object.keys(obj)) {
    if (!expected.has(key)) fail(path, `лишнее поле "${key}"`);
  }
  for (const key of keys) {
    if (!(key in obj)) fail(path, `нет поля "${key}"`);
  }
}

function asString(value: unknown, path: string): string {
  if (typeof value !== "string") fail(path, "ожидалась строка");
  return value;
}

function asNumber(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) fail(path, "ожидалось число");
  return value;
}

function asStringArray(value: unknown, path: string): string[] {
  if (!Array.isArray(value)) fail(path, "ожидался массив");
  return value.map((item, index) => asString(item, `${path}[${index}]`));
}

function asEnum<T extends string | number>(
  value: unknown,
  allowed: Readonly<Record<T, true>>,
  path: string,
): T {
  if (typeof value === "string" || typeof value === "number") {
    if (allowed[value as T]) return value as T;
  }
  fail(path, `ожидалось одно из: ${Object.keys(allowed).join(" | ")}`);
}

/** Общая часть схем v1/v2: всё, кроме hero и квестов (они различаются). */
function validateCommon(root: Record<string, unknown>): void {
  asStringArray(root["party"], "$.party");
  asEnum(root["worldPhase"], WORLD_PHASES, "$.worldPhase");
  const time = asObject(root["time"], "$.time");
  checkExactKeys(time, TIME_KEYS, "$.time");
  asNumber(time["day"], "$.time.day");
  asEnum(time["slot"], TIME_SLOTS, "$.time.slot");
  asString(root["location"], "$.location");

  const pos = root["pos"];
  if (!Array.isArray(pos) || pos.length !== 2) fail("$.pos", "ожидался кортеж [x, z]");
  asNumber(pos[0], "$.pos[0]");
  asNumber(pos[1], "$.pos[1]");

  const inventory = root["inventory"];
  if (!Array.isArray(inventory)) fail("$.inventory", "ожидался массив");
  inventory.forEach((entry, index) => {
    const path = `$.inventory[${index}]`;
    const item = asObject(entry, path);
    checkExactKeys(item, INVENTORY_ITEM_KEYS, path);
    asString(item["item"], `${path}.item`);
    asNumber(item["qty"], `${path}.qty`);
  });

  const flags = asObject(root["flags"], "$.flags");
  for (const [flag, value] of Object.entries(flags)) {
    if (typeof value !== "boolean") fail(`$.flags.${flag}`, "ожидался boolean");
  }
}

function validateStats(hero: Record<string, unknown>): void {
  const stats = asObject(hero["stats"], "$.hero.stats");
  checkExactKeys(stats, SKILL_IDS, "$.hero.stats");
  for (const key of SKILL_IDS) asNumber(stats[key], `$.hero.stats.${key}`);
}

function validateBaseHero(hero: Record<string, unknown>): void {
  asEnum(hero["background"], BACKGROUND_IDS, "$.hero.background");
  asString(hero["name"], "$.hero.name");
  asNumber(hero["hp"], "$.hero.hp");
  asNumber(hero["resource"], "$.hero.resource");
  asStringArray(hero["skills"], "$.hero.skills");
  validateStats(hero);
}

function validateQuestStates(
  root: Record<string, unknown>,
  keys: readonly string[],
  beforeEntry: (path: string, quest: Record<string, unknown>) => void,
): void {
  const questStates = asObject(root["questStates"], "$.questStates");
  for (const [questId, entry] of Object.entries(questStates)) {
    const path = `$.questStates.${questId}`;
    const quest = asObject(entry, path);
    checkExactKeys(quest, keys, path);
    beforeEntry(path, quest);
    asString(quest["stage"], `${path}.stage`);
    asEnum(quest["status"], QUEST_STATUSES, `${path}.status`);
  }
}

/** Проверяет сырые данные на точное соответствие исторической схеме v1. */
export function validateSaveV1(raw: unknown): SaveV1 {
  const root = asObject(raw, "$");
  checkExactKeys(root, ROOT_KEYS, "$");
  if (root["saveVersion"] !== 1) {
    fail("$.saveVersion", `ожидалась 1, получено ${String(root["saveVersion"])}`);
  }
  const hero = asObject(root["hero"], "$.hero");
  checkExactKeys(hero, HERO_KEYS_V1, "$.hero");
  validateBaseHero(hero);
  validateCommon(root);
  validateQuestStates(root, QUEST_STATE_KEYS_V1, () => {});
  return raw as SaveV1;
}

/** Проверяет сырые данные на точное соответствие текущей схеме v2. */
export function validateSaveV2(raw: unknown): SaveV2 {
  const root = asObject(raw, "$");
  checkExactKeys(root, ROOT_KEYS, "$");
  if (root["saveVersion"] !== 2) {
    fail("$.saveVersion", `ожидалась 2, получено ${String(root["saveVersion"])}`);
  }
  const hero = asObject(root["hero"], "$.hero");
  checkExactKeys(hero, HERO_KEYS_V2, "$.hero");
  validateBaseHero(hero);
  asNumber(hero["level"], "$.hero.level");
  asNumber(hero["xp"], "$.hero.xp");
  asNumber(hero["skillPoints"], "$.hero.skillPoints");
  validateCommon(root);
  validateQuestStates(root, QUEST_STATE_KEYS_V2, (path, quest) => {
    asNumber(quest["startedDay"], `${path}.startedDay`);
  });
  return raw as SaveV2;
}
