import type { SaveV1 } from "../../types";

/** Краткая информация о слоте для меню сейвов (без выгрузки всего сейва). */
export interface SaveSlotInfo {
  id: string;
  savedAt: string; // ISO-время сохранения, в SaveV1 не входит
  heroName: string;
  day: number;
}

/**
 * Единственная точка доступа к хранилищу сейвов: сейчас localStorage,
 * потом HTTP-провайдер (JWT + POST /saves) — docs/ARCHITECTURE.md §2.
 * Асинхронный контракт зафиксирован сразу под HTTP-провайдер.
 */
export interface IStorageProvider {
  /** Все слоты хранилища, лексикографически по id. */
  listSlots(): Promise<SaveSlotInfo[]>;
  /** Сейв слота или null, если слота нет; битые данные слота — ошибка. */
  load(id: string): Promise<SaveV1 | null>;
  /** Перезаписывает слот, обновляя время сохранения. */
  save(id: string, data: SaveV1): Promise<void>;
  /** Удаляет слот; отсутствие слота — не ошибка. */
  remove(id: string): Promise<void>;
}
