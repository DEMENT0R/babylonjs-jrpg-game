// IContentProvider — единственная точка доступа систем к контенту
// (docs/ARCHITECTURE.md §2): сейчас бандл-JSON, потом сервер без правки систем.
import type { BackgroundId } from "../types";
import type {
  BackgroundDef,
  ContentData,
  ContentFile,
  DialogNode,
  Enemy,
  Item,
  Npc,
  Quest,
  SkillDef,
} from "./types";
import { CONTENT_VERSION } from "./types";

export interface IContentProvider {
  getDialog(id: string): DialogNode;
  getQuest(id: string): Quest;
  getItem(id: string): Item;
  getEnemy(id: string): Enemy;
  getNpc(id: string): Npc;
  getSkill(id: string): SkillDef;
  getBackground(id: BackgroundId): BackgroundDef;
  /** НПС, присутствующие в локации в данной фазе мира (для расстановки/интеракций). */
  npcsAt(location: string, phase: number): Npc[];
}

export type { ContentData } from "./types";

function indexById<T extends { id: string }>(kind: string, items: readonly T[]): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of items) {
    if (map.has(item.id)) throw new Error(`Контент: дубликат ${kind} "${item.id}"`);
    map.set(item.id, item);
  }
  return map;
}

function require_<T>(kind: string, map: Map<string, T>, id: string): T {
  const value = map.get(id);
  if (!value) throw new Error(`Контент: неизвестный ${kind} "${id}"`);
  return value;
}

/** Провайдер поверх уже распакованных data-массивов (тесты и бандл). */
export function createContentProvider(data: ContentData): IContentProvider {
  const dialogs = indexById("dialog", data.dialogs);
  const quests = indexById("quest", data.quests);
  const items = indexById("item", data.items);
  const enemies = indexById("enemy", data.enemies);
  const npcs = indexById("npc", data.npcs);
  const skills = indexById("skill", data.skills);
  const backgrounds = indexById("background", data.backgrounds);

  return {
    getDialog: (id) => require_("dialog", dialogs, id),
    getQuest: (id) => require_("quest", quests, id),
    getItem: (id) => require_("item", items, id),
    getEnemy: (id) => require_("enemy", enemies, id),
    getNpc: (id) => require_("npc", npcs, id),
    getSkill: (id) => require_("skill", skills, id),
    getBackground: (id) => require_("background", backgrounds, id),
    npcsAt: (location, phase) =>
      data.npcs.filter((npc) => {
        const p = npc.phases[phase];
        return npc.home === location && p !== undefined && p.present;
      }),
  };
}

export function unwrapContent<T>(file: ContentFile<T>, name: string): T[] {
  if (file.contentVersion !== CONTENT_VERSION) {
    throw new Error(
      `Контент ${name}: contentVersion ${file.contentVersion}, ожидалась ${CONTENT_VERSION}`,
    );
  }
  if (typeof file.locale !== "string" || file.locale === "") {
    throw new Error(`Контент ${name}: не задан locale`);
  }
  if (!Array.isArray(file.data)) throw new Error(`Контент ${name}: data — не массив`);
  return file.data;
}
