// Экспорт сейва в JSON-строку (скачивание) и импорт со строгой валидацией.
import type { SaveV2 } from "../../types";
import { stableStringify } from "./stableJson";
import { migrate } from "./migrations";

/** JSON-строка сейва для скачивания; стабильный порядок ключей. */
export function exportSave(save: SaveV2): string {
  return stableStringify(save);
}

/** Парсинг + миграция до текущей версии + строгая валидация; ошибки понятные. */
export function importSave(text: string): SaveV2 {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Импорт сейва: некорректный JSON: ${detail}`);
  }
  return migrate(raw);
}
