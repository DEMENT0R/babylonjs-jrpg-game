import { describe, expect, it } from "vitest";
import { newGame } from "../../src/state/gamestate";
import {
  CURRENT_SAVE_VERSION,
  migrate,
  migrations,
  type Migration,
} from "../../src/state/persistence/migrations";

/** Сейв «версии 0»: модель до введения поля v1 (saveVersion принудительно 0). */
function legacySave(): Record<string, unknown> {
  return { ...newGame("intern", "Аня Соколова"), saveVersion: 0 };
}

describe("migrate", () => {
  it("реестр миграций пуст: v1 — текущая и единственная версия", () => {
    expect(migrations).toEqual({});
    expect(CURRENT_SAVE_VERSION).toBe(1);
  });

  it("принимает валидный сейв v1 как есть (побитово)", () => {
    const save = newGame("engineer", "Виктор Громов");
    expect(migrate(JSON.parse(JSON.stringify(save)))).toEqual(save);
  });

  it("отвергает версию новее текущей", () => {
    const future = { ...newGame("intern", "Аня"), saveVersion: 2 };
    expect(() => migrate(future)).toThrow(/новее поддерживаемой/);
  });

  it("отвергает версию 0: в боевом реестре нет шага миграции", () => {
    expect(() => migrate(legacySave())).toThrow(/Нет миграции с версии 0/);
  });

  it("отвергает не-объект и сейв без saveVersion", () => {
    expect(() => migrate(null)).toThrow(/ожидался объект/);
    expect(() => migrate("save")).toThrow(/ожидался объект/);
    expect(() => migrate({ hero: {} })).toThrow(/некорректная версия/);
  });

  it("механизм доказан: цепочка шагов доводит старый сейв до текущей версии", () => {
    // Тестовый реестр с ненастоящим шагом 0 → 1; боевой реестр не трогаем.
    const toV1: Migration = (save) => ({ ...save, saveVersion: 1 });
    const migrated = migrate(legacySave(), { 0: toV1 });
    expect(migrated).toEqual(newGame("intern", "Аня Соколова"));
    expect(migrate(migrated)).toEqual(migrated); // результат уже текущей версии
  });

  it("шаг, не поднявший версию, отвергается итоговой валидацией", () => {
    const fakeSteps: Record<number, Migration> = { 0: (save) => save };
    expect(() => migrate(legacySave(), fakeSteps)).toThrow(/\$\.saveVersion/);
  });

  it("результат миграции обязан пройти валидацию схемы", () => {
    const brokenV1: Migration = (save) => ({ ...save, saveVersion: 1, cheat: true });
    expect(() => migrate(legacySave(), { 0: brokenV1 })).toThrow(/лишнее поле "cheat"/);
  });
});
