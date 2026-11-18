import { describe, expect, it } from "vitest";
import { createContentProvider } from "../../src/content";
import type { ContentData } from "../../src/content/types";
import { newGame } from "../../src/state/gamestate";
import type { GameState } from "../../src/types";
import { resolveCond, resolveConds } from "../../src/systems/conditions";
import { chooseDialog, npcDialogId, openDialog, visibleChoices } from "../../src/systems/dialog";
import { applyEffects, advanceTime } from "../../src/systems/effects";
import { addItem, countItem, removeItem } from "../../src/systems/inventory";
import { awardXp, maxHp, spendSkillPoint, xpToNextLevel } from "../../src/systems/stats";

const data: ContentData = {
  dialogs: [
    { id: "root", npc: "luda", text: "Привет", choices: [
      { text: "Взять квест", effects: [{ type: "startQuest", quest: "q-window" }], next: "thanks" },
      { text: "Секрет", conditions: [{ type: "flag", id: "secret", op: "eq", value: true }] },
    ] },
    { id: "thanks", npc: "luda", text: "Спасибо" },
    { id: "auto-a", npc: "luda", text: "A", next: "auto-b" },
    { id: "auto-b", npc: "luda", text: "B" },
    { id: "loop-a", npc: "luda", text: "A", next: "loop-b" },
    { id: "loop-b", npc: "luda", text: "B", next: "loop-a" },
  ],
  quests: [
    {
      id: "q-window", title: "Окно", giver: "luda", worldPhases: [0, 1],
      stages: [
        { id: "take", description: "Взять", timeWindow: { from: "morning", to: "evening" } },
        { id: "give", description: "Отдать" },
      ],
      onFailEffects: [{ type: "setFlag", id: "q-window-failed" }],
    },
    {
      id: "q-days", title: "Дни", giver: "luda", worldPhases: [0],
      stages: [{ id: "wait", description: "Ждать", timeWindow: { from: "morning", to: "evening", days: 1 } }],
    },
    {
      id: "q-effects", title: "Эффекты", giver: "luda", worldPhases: [0],
      stages: [{ id: "one", description: "Раз", onEnterEffects: [{ type: "setFlag", id: "entered" }] }],
      onCompleteEffects: [{ type: "setFlag", id: "done" }],
      onFailEffects: [{ type: "setFlag", id: "failed" }],
    },
  ],
  items: [
    { id: "bandage", name: "Бинт", category: "consumable", stack: 2, effects: [] },
    { id: "pill", name: "Таблетка", category: "consumable", stack: 5, effects: [] },
  ],
  enemies: [],
  npcs: [
    { id: "luda", name: "Люда", home: "apartment", phases: {
      0: { dialog: "root", present: true },
      1: { dialog: "root", present: false },
    } },
  ],
  skills: [],
  backgrounds: [],
};

const content = createContentProvider(data);

function stateWith(fn?: (s: GameState) => void): GameState {
  const state = newGame("intern", "Тест");
  fn?.(state);
  return state;
}

describe("conditions", () => {
  it("flag: отсутствующий флаг — false", () => {
    const s = stateWith();
    expect(resolveCond({ type: "flag", id: "met", op: "eq", value: false }, s)).toBe(true);
    s.flags["met"] = true;
    expect(resolveCond({ type: "flag", id: "met", op: "eq", value: true }, s)).toBe(true);
  });

  it("item/stat/worldPhase — числовые сравнения", () => {
    const s = stateWith((draft) => {
      draft.inventory.push({ item: "bandage", qty: 2 });
      draft.hero.stats.medicine = 3;
      draft.worldPhase = 2;
    });
    expect(resolveCond({ type: "item", id: "bandage", op: "gte", value: 2 }, s)).toBe(true);
    expect(resolveCond({ type: "stat", id: "medicine", op: "lte", value: 2 }, s)).toBe(false);
    expect(resolveCond({ type: "worldPhase", op: "gte", value: 2 }, s)).toBe(true);
  });

  it("quest: нет записи — статус none", () => {
    const s = stateWith();
    expect(resolveCond({ type: "quest", id: "q", op: "eq", value: "none" }, s)).toBe(true);
    expect(resolveCond({ type: "quest", id: "q", op: "eq", value: "active" }, s)).toBe(false);
  });

  it("timeSlot: morning < day < evening для gte/lte", () => {
    const s = stateWith();
    expect(resolveCond({ type: "timeSlot", op: "gte", value: "morning" }, s)).toBe(true);
    expect(resolveCond({ type: "timeSlot", op: "lte", value: "morning" }, s)).toBe(true);
    s.time.slot = "evening";
    expect(resolveCond({ type: "timeSlot", op: "gte", value: "day" }, s)).toBe(true);
    expect(resolveCond({ type: "timeSlot", op: "eq", value: "day" }, s)).toBe(false);
  });

  it("пустой список условий — true; ошибки контента не глотаются", () => {
    const s = stateWith();
    expect(resolveConds(undefined, s)).toBe(true);
    expect(resolveConds([], s)).toBe(true);
    expect(() => resolveCond({ type: "stat", id: "nope", op: "eq", value: 1 }, s)).toThrow(/неизвестный стат/);
    expect(() => resolveCond({ type: "timeSlot", op: "gte", value: "night" }, s)).toThrow(/неизвестный слот/);
  });
});

describe("effects", () => {
  it("setFlag/stat/resource/hp с клампами", () => {
    const s = stateWith();
    applyEffects(
      [
        { type: "setFlag", id: "a" },
        { type: "setFlag", id: "b", value: false },
        { type: "stat", stat: "medicine", delta: 2 },
        { type: "stat", stat: "stealth", delta: -5 },
        { type: "resource", delta: -99 },
        { type: "hp", delta: -99 },
      ],
      s,
      content,
    );
    expect(s.flags).toEqual({ a: true, b: false });
    expect(s.hero.stats.medicine).toBe(3);
    expect(s.hero.stats.stealth).toBe(0);
    expect(s.hero.resource).toBe(0);
    expect(s.hero.hp).toBe(0);
    applyEffects([{ type: "hp", delta: 99 }], s, content);
    expect(s.hero.hp).toBe(maxHp(s));
  });

  it("giveItem соблюдает стек, takeItem отсутствующего — no-op", () => {
    const s = stateWith();
    applyEffects([{ type: "giveItem", item: "bandage", qty: 1 }], s, content);
    applyEffects([{ type: "giveItem", item: "bandage", qty: 5 }], s, content);
    expect(s.inventory).toEqual([{ item: "bandage", qty: 2 }]);
    applyEffects([{ type: "takeItem", item: "pill", qty: 1 }], s, content);
    expect(s.inventory).toHaveLength(1);
    applyEffects([{ type: "takeItem", item: "bandage", qty: 2 }], s, content);
    expect(s.inventory).toEqual([]);
  });

  it("startQuest/advanceQuest/completeQuest и их эффекты", () => {
    const s = stateWith();
    applyEffects([{ type: "startQuest", quest: "q-effects" }], s, content);
    expect(s.questStates["q-effects"]).toEqual({ stage: "one", status: "active", startedDay: 1 });
    expect(s.flags["entered"]).toBe(true);
    applyEffects([{ type: "advanceQuest", quest: "q-effects" }], s, content);
    expect(s.questStates["q-effects"]!.stage).toBe("one"); // дальше стадий нет
    applyEffects([{ type: "completeQuest", quest: "q-effects" }], s, content);
    expect(s.questStates["q-effects"]!.status).toBe("done");
    expect(s.flags["done"]).toBe(true);
    // повторное завершение не перезапускает onCompleteEffects
    s.flags["done"] = false;
    applyEffects([{ type: "completeQuest", quest: "q-effects" }], s, content);
    expect(s.flags["done"]).toBe(false);
  });

  it("failQuest применяет onFailEffects; setWorldPhase и партия", () => {
    const s = stateWith();
    applyEffects(
      [
        { type: "startQuest", quest: "q-effects" },
        { type: "failQuest", quest: "q-effects" },
        { type: "setWorldPhase", phase: 2 },
        { type: "joinParty", npc: "luda" },
        { type: "joinParty", npc: "luda" },
        { type: "leaveParty", npc: "luda" },
      ],
      s,
      content,
    );
    expect(s.questStates["q-effects"]!.status).toBe("failed");
    expect(s.flags["failed"]).toBe(true);
    expect(s.worldPhase).toBe(2);
    expect(s.party).toEqual([]);
  });

  it("advanceTime двигает слоты и проваливает окно того же дня", () => {
    const s = stateWith();
    applyEffects([{ type: "startQuest", quest: "q-window" }], s, content);
    advanceTime(s, content, 1); // day
    expect(s.questStates["q-window"]!.status).toBe("active");
    advanceTime(s, content, 1); // evening — ровно дедлайн
    expect(s.questStates["q-window"]!.status).toBe("active");
    advanceTime(s, content, 1); // day 2 morning — за окном
    expect(s.questStates["q-window"]!.status).toBe("failed");
    expect(s.flags["q-window-failed"]).toBe(true);
    expect(s.time).toEqual({ day: 2, slot: "morning" });
  });

  it("окно со сдвигом days: дедлайн — startedDay + days", () => {
    const s = stateWith();
    applyEffects([{ type: "startQuest", quest: "q-days" }], s, content);
    advanceTime(s, content, 6); // day 3 morning
    expect(s.questStates["q-days"]!.status).toBe("failed");
  });

  it("невалидное число слотов — ошибка", () => {
    const s = stateWith();
    expect(() => advanceTime(s, content, 0)).toThrow(/слотов/);
    expect(() => advanceTime(s, content, 1.5)).toThrow(/слотов/);
  });
});

describe("inventory", () => {
  it("addItem возвращает overflow, removeItem не трогает стейт при нехватке", () => {
    const s = stateWith();
    expect(addItem(s, content, "pill", 7)).toBe(2);
    expect(countItem(s, "pill")).toBe(5);
    expect(removeItem(s, content, "pill", 6)).toBe(false);
    expect(countItem(s, "pill")).toBe(5);
    expect(removeItem(s, content, "pill", 5)).toBe(true);
    expect(countItem(s, "pill")).toBe(0);
  });
});

describe("stats", () => {
  it("порог XP и левел-ап: +2 HP, +1 очко, перенос остатка", () => {
    const s = stateWith();
    expect(xpToNextLevel(1)).toBe(8);
    s.hero.xp = 7;
    s.hero.hp = 18;
    expect(awardXp(s, 2)).toBe(1);
    expect(s.hero.level).toBe(2);
    expect(s.hero.xp).toBe(1);
    expect(s.hero.hp).toBe(20);
    expect(s.hero.skillPoints).toBe(1);
    expect(maxHp(s)).toBe(22);
  });

  it("spendSkillPoint тратит очко или возвращает false", () => {
    const s = stateWith();
    expect(spendSkillPoint(s, "repair")).toBe(false);
    s.hero.skillPoints = 1;
    expect(spendSkillPoint(s, "repair")).toBe(true);
    expect(s.hero.stats.repair).toBe(2);
    expect(s.hero.skillPoints).toBe(0);
  });
});

describe("dialog", () => {
  it("visibleChoices фильтрует по условиям, сохраняя индексы", () => {
    const s = stateWith();
    const node = content.getDialog("root");
    expect(visibleChoices(node, s)).toEqual([{ index: 0, text: "Взять квест" }]);
    s.flags["secret"] = true;
    expect(visibleChoices(node, s).map((c) => c.index)).toEqual([0, 1]);
  });

  it("openDialog разворачивает автопереходы и ловит цикл", () => {
    const s = stateWith();
    expect(openDialog(content, s, "auto-a").node.id).toBe("auto-b");
    expect(openDialog(content, s, "root").choices).toHaveLength(1);
    expect(() => openDialog(content, s, "loop-a")).toThrow(/цикл/);
  });

  it("chooseDialog применяет эффекты и отдаёт следующий узел", () => {
    const s = stateWith();
    const next = chooseDialog(content, content.getDialog("root"), 0, s);
    expect(next).toBe("thanks");
    expect(s.questStates["q-window"]!.status).toBe("active");
    expect(() => chooseDialog(content, content.getDialog("root"), 1, s)).toThrow(/недоступен/);
  });

  it("npcDialogId учитывает present по фазе", () => {
    expect(npcDialogId(content, "luda", 0)).toBe("root");
    expect(npcDialogId(content, "luda", 1)).toBeUndefined();
  });
});

describe("effects: защита от циклов", () => {
  it("самозапускающийся квест упирается в лимит глубины", () => {
    const loop = createContentProvider({
      ...data,
      quests: [
        {
          id: "q-loop", title: "Цикл", giver: "luda", worldPhases: [0],
          stages: [
            { id: "one", description: "Раз", onEnterEffects: [{ type: "startQuest", quest: "q-loop" }] },
          ],
        },
      ],
    });
    expect(() => applyEffects([{ type: "startQuest", quest: "q-loop" }], stateWith(), loop)).toThrow(
      /глубина/,
    );
  });
});

describe("character", () => {
  it("стартовые HP/статы/навык/локация берутся из background", async () => {
    const { newGameForBackground } = await import("../../src/systems/character");
    const full = createContentProvider({
      ...data,
      backgrounds: [
        {
          id: "engineer",
          name: "Виктор Громов",
          startLocation: "workshop",
          startNpc: "luda",
          hp: 24,
          resource: 8,
          stats: { medicine: 1, repair: 3, persuasion: 1, stealth: 1 },
          skill: "craft-without-bench",
        },
      ],
    });
    const save = newGameForBackground(full, "engineer");
    expect(save.location).toBe("workshop");
    expect(save.hero).toMatchObject({
      name: "Виктор Громов",
      hp: 24,
      resource: 8,
      skills: ["craft-without-bench"],
    });
    expect(save.hero.stats.repair).toBe(3);
    expect(newGameForBackground(full, "engineer", "Свой").hero.name).toBe("Свой");
  });
});
