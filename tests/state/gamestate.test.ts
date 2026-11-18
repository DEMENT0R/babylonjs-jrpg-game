import { describe, expect, it } from "vitest";
import { newGame, SAVE_VERSION } from "../../src/state/gamestate";

describe("newGame", () => {
  it("SAVE_VERSION — текущая версия сейва", () => {
    expect(SAVE_VERSION).toBe(1);
  });

  it("полный shape SaveV1 без лишних полей", () => {
    const save = newGame("intern", "Аня Соколова");
    expect(save).toEqual({
      saveVersion: 1,
      hero: {
        background: "intern",
        name: "Аня Соколова",
        hp: 20,
        resource: 10,
        stats: { medicine: 1, repair: 1, persuasion: 1, stealth: 1 },
        skills: ["field-medicine"],
      },
      party: [],
      worldPhase: 0,
      time: { day: 1, slot: "morning" },
      location: "apartment",
      pos: [0, 0],
      inventory: [],
      questStates: {},
      flags: {},
    });
  });

  it("эталон ключей: верхний уровень, hero и stats", () => {
    const save = newGame("engineer", "Виктор");
    expect(Object.keys(save).sort()).toEqual([
      "flags",
      "hero",
      "inventory",
      "location",
      "party",
      "pos",
      "questStates",
      "saveVersion",
      "time",
      "worldPhase",
    ]);
    expect(Object.keys(save.hero).sort()).toEqual([
      "background",
      "hp",
      "name",
      "resource",
      "skills",
      "stats",
    ]);
    expect(Object.keys(save.hero.stats).sort()).toEqual([
      "medicine",
      "persuasion",
      "repair",
      "stealth",
    ]);
  });

  it("уникальный навык зависит от бэкграунда", () => {
    expect(newGame("intern", "Аня").hero.skills).toEqual(["field-medicine"]);
    expect(newGame("student", "Марк").hero.skills).toEqual(["fast-learning"]);
    expect(newGame("engineer", "Виктор").hero.skills).toEqual(["craft-without-bench"]);
  });

  it("каждый запуск даёт независимые вложенные структуры", () => {
    const first = newGame("intern", "Аня");
    const second = newGame("intern", "Аня");
    first.hero.stats.medicine = 9;
    first.inventory.push({ item: "bandage", qty: 2 });
    first.questStates["q-x"] = { stage: "take", status: "active" };
    expect(second.hero.stats.medicine).toBe(1);
    expect(second.inventory).toEqual([]);
    expect(second.questStates).toEqual({});
  });
});
