import { beforeEach, describe, expect, it } from "vitest";
import { newGame } from "../../src/state/gamestate";
import { exportSave, importSave } from "../../src/state/persistence/exportImport";
import { LocalStorageProvider } from "../../src/state/persistence/LocalStorageProvider";

/** In-memory дубль DOM Storage (index-сигнатура — требование интерфейса). */
class MemoryStorage implements Storage {
  [key: string]: unknown;
  private readonly entries = new Map<string, string>();

  get length(): number {
    return this.entries.size;
  }
  clear(): void {
    this.entries.clear();
  }
  getItem(key: string): string | null {
    const value = this.entries.get(key);
    return value === undefined ? null : value;
  }
  key(index: number): string | null {
    return [...this.entries.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.entries.delete(key);
  }
  setItem(key: string, value: string): void {
    this.entries.set(key, value);
  }
}

const storage = new MemoryStorage();
const provider = new LocalStorageProvider(storage);

beforeEach(() => {
  storage.clear();
});

/** Сейв с прогрессом: все ветки модели заполнены нетривиальными значениями. */
function saveWithProgress() {
  const save = newGame("intern", "Аня Соколова");
  save.time.day = 3;
  save.hero.hp = 14;
  save.inventory.push({ item: "bandage", qty: 2 });
  save.questStates["q-luda-meds"] = { stage: "give", status: "active" };
  save.flags["metBoris"] = true;
  save.party.push("boris");
  return save;
}

describe("LocalStorageProvider", () => {
  it("save → load: побитово идентичный round-trip", async () => {
    const save = saveWithProgress();
    await provider.save("slot1", save);
    const loaded = await provider.load("slot1");
    expect(loaded).not.toBeNull();
    expect(loaded && exportSave(loaded)).toBe(exportSave(save));
    expect(loaded).toEqual(save);
  });

  it("несколько слотов независимы", async () => {
    const intern = saveWithProgress();
    const engineer = newGame("engineer", "Виктор Громов");
    await provider.save("intern", intern);
    await provider.save("engineer", engineer);
    const first = await provider.load("intern");
    const second = await provider.load("engineer");
    expect(first && first.hero.background).toBe("intern");
    expect(first && first.time.day).toBe(3);
    expect(second && second.hero.background).toBe("engineer");
  });

  it("load несуществующего слота → null", async () => {
    expect(await provider.load("nope")).toBeNull();
  });

  it("listSlots: информация о слотах, отсортировано по id", async () => {
    const save = newGame("student", "Марк Ли");
    await provider.save("beta", save);
    await provider.save("alpha", save);
    const slots = await provider.listSlots();
    expect(slots.map((slot) => slot.id)).toEqual(["alpha", "beta"]);
    const [alpha] = slots;
    if (!alpha) throw new Error("слот alpha не найден");
    expect(alpha.heroName).toBe("Марк Ли");
    expect(alpha.day).toBe(1);
    expect(new Date(alpha.savedAt).toISOString()).toBe(alpha.savedAt);
  });

  it("remove удаляет слот", async () => {
    await provider.save("x", saveWithProgress());
    await provider.remove("x");
    expect(await provider.load("x")).toBeNull();
    expect(await provider.listSlots()).toEqual([]);
  });

  it("remove несуществующего слота — не ошибка", async () => {
    await expect(provider.remove("ghost")).resolves.toBeUndefined();
  });

  it("ключи хранилища — jrpg:save:<id>, чужие ключи не трогаются", async () => {
    storage.setItem("jrpg:settings", "{}");
    await provider.save("slot9", saveWithProgress());
    expect(storage.getItem("jrpg:save:slot9")).not.toBeNull();
    expect(storage.length).toBe(2);
    expect((await provider.listSlots()).map((slot) => slot.id)).toEqual(["slot9"]);
  });

  it("битые данные слота — ошибка при load", async () => {
    storage.setItem("jrpg:save:bad", "{not json");
    await expect(provider.load("bad")).rejects.toThrow(/некорректный JSON/);
  });

  it("сейв с лишним полем в слоте — ошибка при load", async () => {
    const corrupted = { ...saveWithProgress(), cheat: true };
    storage.setItem("jrpg:save:hack", JSON.stringify({ savedAt: "x", data: corrupted }));
    await expect(provider.load("hack")).rejects.toThrow(/лишнее поле "cheat"/);
  });
});

describe("export/import", () => {
  it("export → import → export идентичен побитово", () => {
    const text = exportSave(saveWithProgress());
    expect(exportSave(importSave(text))).toBe(text);
  });

  it("import не зависит от порядка ключей (стабильная сериализация)", () => {
    const text = exportSave(saveWithProgress());
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const { location, ...rest } = parsed;
    expect(exportSave(importSave(JSON.stringify({ ...rest, location })))).toBe(text);
  });

  it("import: битый JSON — понятная ошибка", () => {
    expect(() => importSave("{oops")).toThrow(/некорректный JSON/);
  });

  it("import: лишнее поле — ошибка", () => {
    const extra = { ...saveWithProgress(), cheat: true };
    expect(() => importSave(JSON.stringify(extra))).toThrow(/лишнее поле "cheat"/);
  });

  it("import: неверный saveVersion — ошибка", () => {
    const future = { ...saveWithProgress(), saveVersion: 2 };
    expect(() => importSave(JSON.stringify(future))).toThrow(/\$\.saveVersion/);
  });

  it("import: неверный тип поля — ошибка с путём", () => {
    const source = saveWithProgress();
    const typed = { ...source, hero: { ...source.hero, hp: "20" } };
    expect(() => importSave(JSON.stringify(typed))).toThrow(/\$\.hero\.hp/);
  });

  it("import: отсутствующее поле — ошибка", () => {
    const incomplete = { ...saveWithProgress() } as Record<string, unknown>;
    delete incomplete.flags;
    expect(() => importSave(JSON.stringify(incomplete))).toThrow(/нет поля "flags"/);
  });

  it("import: неверное значение enum — ошибка", () => {
    const typed = { ...saveWithProgress(), time: { day: 1, slot: "night" } };
    expect(() => importSave(JSON.stringify(typed))).toThrow(/\$\.time\.slot/);
  });
});
