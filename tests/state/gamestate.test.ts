import { describe, expect, it } from "vitest";
import { newGame, SAVE_VERSION } from "../../src/state/gamestate";

describe("newGame", () => {
  it("SAVE_VERSION — текущая версия сейва", () => {
    expect(SAVE_VERSION).toBe(2);
  });

  it("полный shape SaveV2 без лишних полей", () => {
    const save = newGame("intern", "Аня Соколова");
    expect(save).toEqual({
      saveVersion: 2,
      hero: {
        background: "intern",
        name: "Аня Соколова",
        hp: 20,
        resource: 10,
        level: 1,
        xp: 0,
        skillPoints: 0,
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
      "level",
      "name",
      "resource",
      "skillPoints",
      "skills",
      "stats",
      "xp",
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
    first.questStates["q-x"] = { stage: "take", status: "active", startedDay: 1 };
    expect(second.hero.stats.medicine).toBe(1);
    expect(second.inventory).toEqual([]);
    expect(second.questStates).toEqual({});
  });
});
