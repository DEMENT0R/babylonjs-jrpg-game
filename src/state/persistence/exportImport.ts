// Экспорт сейва в JSON-строку (скачивание) и импорт со строгой валидацией.
import type { SaveV1 } from "../../types";
import { stableStringify } from "./stableJson";
import { validateSaveV1 } from "./validateSave";

/** JSON-строка сейва для скачивания; стабильный порядок ключей. */
export function exportSave(save: SaveV1): string {
  return stableStringify(save);
}

/** Парсинг + строгая валидация схемы v1 (лишние поля запрещены); ошибки понятные. */
export function importSave(text: string): SaveV1 {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Импорт сейва: некорректный JSON: ${detail}`);
  }
  return validateSaveV1(raw);
}
