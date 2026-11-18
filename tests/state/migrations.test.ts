import { describe, expect, it } from "vitest";
import type { SaveV1 } from "../../src/types";
import { newGame } from "../../src/state/gamestate";
import {
  CURRENT_SAVE_VERSION,
  migrate,
  migrations,
  type Migration,
} from "../../src/state/persistence/migrations";

/** Сейв «версии 0»: историческая v1-модель с принудительным saveVersion 0. */
function legacySave(): Record<string, unknown> {
  return { ...saveV1(), saveVersion: 0 };
}

/** Исторический сейв v1: без level/xp/skillPoints и без startedDay. */
function saveV1(): SaveV1 {
  return {
    saveVersion: 1,
    hero: {
      background: "intern",
      name: "Аня Соколова",
      hp: 14,
      resource: 7,
      stats: { medicine: 2, repair: 1, persuasion: 1, stealth: 1 },
      skills: ["field-medicine"],
    },
    party: ["boris"],
    worldPhase: 1,
    time: { day: 4, slot: "evening" },
    location: "pharmacy",
    pos: [1, 2],
    inventory: [{ item: "bandage", qty: 2 }],
    questStates: { "q-luda-meds": { stage: "give", status: "active" } },
    flags: { metBoris: true },
  };
}

describe("migrate", () => {
  it("текущая версия — 2, реестр содержит переход 1→2", () => {
    expect(CURRENT_SAVE_VERSION).toBe(2);
    expect(Object.keys(migrations)).toEqual(["1"]);
  });

  it("принимает валидный сейв v2 как есть (побитово)", () => {
    const save = newGame("engineer", "Виктор Громов");
    expect(migrate(JSON.parse(JSON.stringify(save)))).toEqual(save);
  });

  it("поднимает v1 до v2: level/xp/skillPoints и startedDay", () => {
    const migrated = migrate(saveV1());
    expect(migrated.saveVersion).toBe(2);
    expect(migrated.hero).toMatchObject({ level: 1, xp: 0, skillPoints: 0, hp: 14 });
    expect(migrated.questStates["q-luda-meds"]).toEqual({
      stage: "give",
      status: "active",
      startedDay: 4, // день сейва — единственная доступная опора
    });
  });

  it("отвергает версию новее текущей", () => {
    const future = { ...newGame("intern", "Аня"), saveVersion: 3 };
    expect(() => migrate(future)).toThrow(/новее поддерживаемой/);
  });

  it("отвергает версию 0: в боевом реестре нет шага 0→1", () => {
    expect(() => migrate(legacySave())).toThrow(/Нет миграции с версии 0/);
  });

  it("отвергает не-объект и сейв без saveVersion", () => {
    expect(() => migrate(null)).toThrow(/ожидался объект/);
    expect(() => migrate("save")).toThrow(/ожидался объект/);
    expect(() => migrate({ hero: {} })).toThrow(/некорректная версия/);
  });

  it("механизм доказан: цепочка шагов доводит старый сейв до текущей версии", () => {
    // Тестовый реестр с шагами 0→1 и 1→2; вторая миграция переиспользует боевую.
    const toV1: Migration = (save) => ({ ...save, saveVersion: 1 });
    const migrated = migrate(legacySave(), { 0: toV1, 1: migrations[1]! });
    expect(migrated.saveVersion).toBe(2);
    expect(migrated.hero.level).toBe(1);
  });

  it("шаг, не поднявший версию, отвергается итоговой валидацией", () => {
    const fakeSteps: Record<number, Migration> = { 1: (save) => save };
    expect(() => migrate(saveV1(), fakeSteps)).toThrow(/\$\.saveVersion/);
  });

  it("результат миграции обязан пройти валидацию схемы", () => {
    const cheatV2: Migration = (save) => ({ ...save, saveVersion: 2, cheat: true });
    expect(() => migrate(saveV1(), { 1: cheatV2 })).toThrow(/лишнее поле "cheat"/);
  });
});
