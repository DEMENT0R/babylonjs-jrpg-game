// Механизм миграций версий сейва (docs/CONTENT_SCHEMAS.md, «Сейв»):
// несоответствие saveVersion → цепочка шагов migrations; шаг — чистая функция
// SaveN → SaveN+1. Текущая версия — 2.
import type { SaveV2 } from "../../types";
import { validateSaveV1, validateSaveV2 } from "./validateSave";

/** Шаг миграции: сейв версии n → сейв версии n + 1. Чистая функция. */
export type Migration = (save: Record<string, unknown>) => Record<string, unknown>;

/**
 * v1 → v2: у героя появляются `level`/`xp`/`skillPoints`, у квеста — `startedDay`
 * (окно `timeWindow` считается от дня взятия). Для старых активных квестов днём
 * взятия считается текущий день сейва — единственная доступная опора.
 */
export const v1ToV2: Migration = (save) => {
  const v1 = validateSaveV1(save);
  const time = v1.time;
  const questStates: Record<string, { stage: string; status: string; startedDay: number }> = {};
  for (const [id, state] of Object.entries(v1.questStates)) {
    questStates[id] = { ...state, startedDay: time.day };
  }
  return {
    ...v1,
    saveVersion: 2,
    hero: { ...v1.hero, level: 1, xp: 0, skillPoints: 0 },
    questStates,
  };
};

/** Реестр реальных шагов: ключ n мигрирует saveVersion n → n + 1. */
export const migrations: Record<number, Migration> = { 1: v1ToV2 };

/** Текущая версия сейва (зеркало SAVE_VERSION из state/gamestate.ts). */
export const CURRENT_SAVE_VERSION = 2;

/** Валидирует сейв текущей версии как есть. */
export function validateSave(raw: unknown): SaveV2 {
  return validateSaveV2(raw);
}

/**
 * Валидирует сырой сейв и доводит его до текущей версии:
 * - текущая версия — валидация как есть;
 * - более старая — цепочка шагов реестра, каждый шаг обязан существовать;
 * - неизвестная (0 или новее текущей) — понятная ошибка.
 * Реестр можно передать явно — это позволяет тестам доказывать цепочку,
 * не засоряя боевой реестр ненастоящими шагами.
 */
export function migrate(raw: unknown, registry: Record<number, Migration> = migrations): SaveV2 {
  const version = readVersion(raw);
  if (version === CURRENT_SAVE_VERSION) return validateSaveV2(raw);

  if (version > CURRENT_SAVE_VERSION) {
    throw new Error(
      `Сейв версии ${version} новее поддерживаемой (${CURRENT_SAVE_VERSION}) — обновите игру`,
    );
  }

  let current = raw as Record<string, unknown>;
  for (let step = version; step < CURRENT_SAVE_VERSION; step++) {
    const migration = registry[step];
    if (!migration) {
      throw new Error(`Нет миграции с версии ${step} (сейв версии ${version})`);
    }
    current = migration(current);
  }
  return validateSaveV2(current);
}

function readVersion(raw: unknown): number {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Сейв: ожидался объект с полем saveVersion");
  }
  const version = (raw as Record<string, unknown>)["saveVersion"];
  if (typeof version !== "number" || !Number.isInteger(version) || version < 0) {
    throw new Error(`Сейв: некорректная версия: ${String(version)}`);
  }
  return version;
}
