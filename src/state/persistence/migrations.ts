// Механизм миграций версий сейва (docs/CONTENT_SCHEMAS.md, «Сейв v1»):
// несоответствие saveVersion → цепочка шагов migrations; шаг — чистая функция
// SaveN → SaveN+1. Сейчас v1 — текущая и единственная, реестр пуст.
import type { SaveV1 } from "../../types";
import { validateSaveV1 } from "./validateSave";

/** Шаг миграции: сейв версии n → сейв версии n + 1. Чистая функция. */
export type Migration = (save: Record<string, unknown>) => Record<string, unknown>;

/** Реестр реальных шагов: ключ n мигрирует saveVersion n → n + 1. */
export const migrations: Record<number, Migration> = {};

/** Текущая версия сейва (зеркало SAVE_VERSION из state/gamestate.ts). */
export const CURRENT_SAVE_VERSION = 1;

/**
 * Валидирует сырой сейв и доводит его до текущей версии:
 * - текущая версия — валидация как есть;
 * - более старая — цепочка шагов реестра, каждый шаг обязан существовать;
 * - неизвестная (0 или новее текущей) — понятная ошибка.
 * Реестр можно передать явно — это позволяет тестам доказывать цепочку,
 * не засоряя боевой реестр ненастоящими шагами.
 */
export function migrate(raw: unknown, registry: Record<number, Migration> = migrations): SaveV1 {
  const version = readVersion(raw);
  if (version === CURRENT_SAVE_VERSION) return validateSaveV1(raw);

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
  return validateSaveV1(current);
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
