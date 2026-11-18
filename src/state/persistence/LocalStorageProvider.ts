// localStorage-провайдер (GitHub Pages). Ключи — `jrpg:save:<id>`; сейв хранится
// в обёртке { savedAt, data }: время сохранения — служебное поле, в сейв не входит.
// Старые сейвы v1 поднимаются миграцией при чтении.
import type { SaveV2 } from "../../types";
import type { IStorageProvider, SaveSlotInfo } from "./IStorageProvider";
import { stableStringify } from "./stableJson";
import { migrate } from "./migrations";

const KEY_PREFIX = "jrpg:save:";

interface SlotEnvelope {
  savedAt: string;
  data: SaveV2;
}

export class LocalStorageProvider implements IStorageProvider {
  private readonly storage: Storage;

  constructor(storage: Storage = globalThis.localStorage) {
    this.storage = storage;
  }

  async listSlots(): Promise<SaveSlotInfo[]> {
    const slots: SaveSlotInfo[] = [];
    for (let i = 0; i < this.storage.length; i++) {
      const key = this.storage.key(i);
      if (key === null || !key.startsWith(KEY_PREFIX)) continue;
      const envelope = this.parseEnvelope(this.read(key), key);
      slots.push({
        id: key.slice(KEY_PREFIX.length),
        savedAt: envelope.savedAt,
        heroName: envelope.data.hero.name,
        day: envelope.data.time.day,
      });
    }
    return slots.sort((a, b) => a.id.localeCompare(b.id));
  }

  async load(id: string): Promise<SaveV2 | null> {
    const key = this.key(id);
    const text = this.storage.getItem(key);
    if (text === null) return null;
    return this.parseEnvelope(text, key).data;
  }

  async save(id: string, data: SaveV2): Promise<void> {
    const envelope: SlotEnvelope = { savedAt: new Date().toISOString(), data };
    this.storage.setItem(this.key(id), stableStringify(envelope));
  }

  async remove(id: string): Promise<void> {
    this.storage.removeItem(this.key(id));
  }

  private key(id: string): string {
    return `${KEY_PREFIX}${id}`;
  }

  private read(key: string): string {
    const text = this.storage.getItem(key);
    if (text === null) throw new Error(`Слот ${key} не найден`);
    return text;
  }

  private parseEnvelope(text: string, key: string): SlotEnvelope {
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`Слот ${key}: некорректный JSON: ${detail}`);
    }
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
      throw new Error(`Слот ${key}: ожидалась обёртка {savedAt, data}`);
    }
    const record = raw as Record<string, unknown>;
    for (const field of Object.keys(record)) {
      if (field !== "savedAt" && field !== "data") {
        throw new Error(`Слот ${key}: неизвестное поле "${field}"`);
      }
    }
    if (typeof record["savedAt"] !== "string" || !("data" in record)) {
      throw new Error(`Слот ${key}: ожидалась обёртка {savedAt, data}`);
    }
    return { savedAt: record["savedAt"], data: migrate(record["data"]) };
  }
}
