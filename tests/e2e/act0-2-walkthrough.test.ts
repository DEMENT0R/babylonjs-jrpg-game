// Сквозной прогон v2: день 1 → финал «День четырнадцатый» (acts 0–2, docs/CONTENT_PLAN_V2.md).
// Повторяет act0-walkthrough и продолжает: сайды акта 1 → карантин → Клещ → эпилог.
// Время двигается только advanceTime (сон/стол), лут — открытие контейнеров с rng=0,
// XP — awardXp (эквивалент побед в стычках, разобранных в combat.test.ts).
import { describe, expect, it } from "vitest";
import { loadBundledContent } from "../../src/content/bundled";
import { slotsToMorning, slotsToEvening } from "../../src/core/time";
import type { DialogView } from "../../src/systems/dialog";
import { chooseDialog, npcDialogId, openDialog } from "../../src/systems/dialog";
import { selectEncounter, settleEncounter } from "../../src/systems/encounters";
import { openContainer } from "../../src/systems/containers";
import { advanceTime } from "../../src/systems/effects";
import { countItem } from "../../src/systems/inventory";
import { awardXp, spendSkillPoint } from "../../src/systems/stats";
import { newGameForBackground } from "../../src/systems/character";
import type { GameState } from "../../src/types";

const content = loadBundledContent();

function talk(state: GameState, npc: string): DialogView {
  const nodeId = npcDialogId(content, npc, state.worldPhase);
  if (!nodeId) throw new Error(`NPC "${npc}" отсутствует в фазе ${state.worldPhase}`);
  return openDialog(content, state, nodeId);
}

/** Выбирает реплику по тексту и открывает следующий узел (null — конец диалога). */
function pick(state: GameState, view: DialogView, text: string): DialogView | null {
  const choice = view.choices.find((c) => c.text === text);
  if (!choice) {
    throw new Error(
      `В "${view.node.id}" нет выбора "${text}"; доступно: ${view.choices.map((c) => c.text).join(" | ")}`,
    );
  }
  const next = chooseDialog(content, view.node, choice.index, state);
  return next === null ? null : openDialog(content, state, next);
}

describe("сквозной прогон v2: день 1 → день 14, финал", () => {
  it("акт 0 → сайды акта 1 → карантин → Клещ → эпилог по флагам", () => {
    const state = newGameForBackground(content, "intern");

    // ── День 1: лояльность Димы, таблетки Люды ──────────────────────────────
    state.location = "apartment";
    pick(state, talk(state, "luda"), "Я схожу в аптеку.");
    expect(state.questStates["q-luda-meds"]?.status).toBe("active");

    state.location = "campus";
    pick(state, talk(state, "dima"), "Держись рядом.");
    expect(state.flags["dima-loyal"]).toBe(true);

    state.location = "pharmacy";
    pick(state, talk(state, "zina"), "Мне таблетки для Люды.");
    state.location = "apartment";
    pick(state, talk(state, "luda"), "Вот ваши таблетки.");
    expect(state.questStates["q-luda-meds"]?.status).toBe("done");
    expect(state.flags["luda-meds-done"]).toBe(true);

    // ── День 3: ужин → фаза 1 ──────────────────────────────────────────────
    advanceTime(state, content, slotsToMorning(state.time.slot));
    advanceTime(state, content, slotsToMorning(state.time.slot));
    advanceTime(state, content, slotsToEvening(state.time.slot));
    expect(state.time).toEqual({ day: 3, slot: "evening" });
    pick(state, talk(state, "luda"), "Давайте соберёмся в день третий.");
    const dinner = pick(state, talk(state, "luda"), "Я за стол.");
    pick(state, dinner!, "Включить новости.");
    expect(state.worldPhase).toBe(1);
    advanceTime(state, content, slotsToMorning(state.time.slot)); // → день 4, утро

    // ── Акт 1, день 4: вода для Люды, паника Димы, склад, дело Зины ────────
    pick(state, talk(state, "luda"), "Вам нужна вода?"); // q-water-reserve
    state.location = "campus";
    pick(state, talk(state, "dima"), "Что с тобой происходит?"); // q-dima-panic
    expect(state.questStates["q-dima-panic"]?.status).toBe("active");

    state.location = "hospital";
    pick(state, talk(state, "boris"), "Чем помочь, Борис?"); // q-hospital-panic

    state.location = "pharmacy";
    const crate = selectEncounter(content, state);
    expect(crate?.id).toBe("warehouse-guards");
    settleEncounter(content, crate!, "win", state);
    expect(countItem(state, "meds-crate")).toBe(1);
    expect(state.questStates["q-hospital-panic"]?.stage).toBe("deliver");

    pick(state, talk(state, "zina"), "Я сообщу Сергею.");
    expect(state.flags["zina-reported"]).toBe(true);
    pick(state, talk(state, "zina"), "Мы с Димой — за водой.");
    expect(state.questStates["q-dima-panic"]?.stage).toBe("resolve");
    pick(state, talk(state, "zina"), "Две бутылки воды, всё что есть.");
    expect(countItem(state, "water-bottle")).toBe(3);
    expect(state.questStates["q-water-reserve"]?.stage).toBe("deliver");

    state.location = "campus";
    pick(state, talk(state, "dima"), "Держись рядом.");
    expect(state.party).toEqual(["dima"]);
    expect(state.questStates["q-dima-panic"]?.status).toBe("done");

    state.location = "workshop";
    const genInspect = pick(state, talk(state, "taras"), "Помочь с генератором?");
    expect(state.questStates["q-taras-generator"]?.stage).toBe("inspect");
    pick(state, genInspect!, "Начать.");
    // Лут ящиков мастерской: лом + изолента (rng=0 → все шансы проходят).
    const crates = content.containersAt("workshop").find((c) => c.id === "workshop-crates");
    openContainer(content, crates!, state, () => 0);
    expect(countItem(state, "duct-tape")).toBeGreaterThanOrEqual(1);
    // Выборы узла фиксируются при открытии — после лута открываем заново.
    const genFix2 = openDialog(content, state, "taras-generator-fix");
    const genReport = pick(state, genFix2, "Закрепить хомут.");
    pick(state, genReport!, "Готово.");
    expect(state.questStates["q-taras-generator"]?.status).toBe("done");
    expect(state.hero.stats.repair).toBe(2); // 1 (интерн) + 1 за квест
    expect(countItem(state, "multimeter")).toBe(1);

    state.location = "square";
    const zinaCase = pick(state, talk(state, "sergey"), "Зина спекулирует.");
    pick(state, zinaCase!, "Напишу заявление.");
    expect(state.flags["zina-case-opened"]).toBe(true);
    expect(state.questStates["q-zina-case"]?.stage).toBe("close");

    state.location = "apartment";
    pick(state, talk(state, "luda"), "Вот ваша вода.");
    expect(state.questStates["q-water-reserve"]?.status).toBe("done");
    expect(state.flags["luda-water-done"]).toBe(true);

    // ── День 5, вечер: обход с Сергеем, закрытие дела Зины, переход в Ф2 ───
    advanceTime(state, content, slotsToMorning(state.time.slot)); // день 5, утро
    advanceTime(state, content, slotsToEvening(state.time.slot));
    state.location = "square";
    const patrol = pick(state, talk(state, "sergey"), "Пойти с вами в обход."); // q-patrol-route
    pick(state, patrol!, "Я готов.");
    expect(state.questStates["q-patrol-route"]?.stage).toBe("check-basement");
    state.location = "workshop";
    pick(state, talk(state, "taras"), "Сергей просил посмотреть подвал.");
    state.location = "square";
    pick(state, talk(state, "sergey"), "Обход прошёл.");
    expect(state.questStates["q-patrol-route"]?.status).toBe("done");

    state.location = "pharmacy";
    pick(state, talk(state, "zina"), "Это проверка, Зина.");
    expect(state.questStates["q-zina-case"]?.status).toBe("done");

    state.location = "hospital";
    const deliver = pick(state, talk(state, "boris"), "Ящик уже у меня.");
    const triage = pick(state, deliver!, "Передать ящик.");
    pick(state, triage!, "Остаться и помочь.");
    expect(state.worldPhase).toBe(2);
    expect(state.questStates["q-hospital-panic"]?.status).toBe("done");

    // ── Карантин, день 5 вечер: Борис, убежище, список, рецепты ─────────────
    pick(state, talk(state, "boris"), "Остаться с вами.");
    expect(state.flags["boris-stay"]).toBe(true);

    state.location = "square";
    pick(state, talk(state, "sergey"), "Как там метро?"); // q-shelter-metro
    state.location = "metro-station";
    const shelterBox = content
      .containersAt("metro-station")
      .find((c) => c.id === "metro-shelter-box");
    openContainer(content, shelterBox!, state, () => 0);
    expect(state.questStates["q-shelter-metro"]?.stage).toBe("report");
    state.location = "square";
    pick(state, talk(state, "sergey"), "Убежище проверено.");
    expect(state.questStates["q-shelter-metro"]?.status).toBe("done");

    state.location = "campus";
    pick(state, talk(state, "dima"), "Кто в списке?"); // q-evac-list
    const help = pick(state, talk(state, "dima"), "Ты в деле?");
    pick(state, help!, "Впиши Люду.");
    expect(state.flags["luda-evac-listed"]).toBe(true);
    expect(state.questStates["q-evac-list"]?.stage).toBe("close");
    state.location = "workshop";
    pick(state, talk(state, "taras"), "Вписать Тараса в список");
    expect(state.flags["taras-evac-listed"]).toBe(true);
    state.location = "campus";
    pick(state, talk(state, "dima"), "Список готов.");
    expect(state.questStates["q-evac-list"]?.status).toBe("done");

    state.location = "apartment";
    const recipe = pick(state, talk(state, "luda"), "Научите делать бинты."); // q-luda-bandages
    pick(state, recipe!, "Учусь.");
    expect(state.questStates["q-luda-bandages"]?.status).toBe("done");
    expect(countItem(state, "antiseptic")).toBeGreaterThanOrEqual(2);
    pick(state, talk(state, "luda"), "Пойдёмте с нами.");
    expect(state.party).toEqual(["dima", "luda"]);

    // ── День 9: ночная смена Бориса ───────────────────────────────────────
    advanceTime(state, content, 10); // день 5 вечер → день 9 утро (1 слот до утра + 3 дня по 3)
    expect(state.time).toEqual({ day: 9, slot: "morning" });
    state.location = "hospital";
    const triageStart = pick(state, talk(state, "boris"), "Остаться на смену?"); // q-boris-triage
    pick(state, triageStart!, "Принять поток.");
    expect(state.questStates["q-boris-triage"]?.stage).toBe("supplies");
    pick(state, talk(state, "boris"), "У меня антисептик и бинты.");
    expect(state.questStates["q-boris-triage"]?.stage).toBe("shift");
    advanceTime(state, content, slotsToEvening(state.time.slot));
    pick(state, talk(state, "boris"), "Дежурить до утра.");
    expect(state.questStates["q-boris-triage"]?.status).toBe("done");
    expect(state.flags["boris-shift-done"]).toBe(true);
    expect(state.time).toEqual({ day: 10, slot: "morning" });

    // ── День 10: щиток (уровень за XP → очко навыка в ремонт) ──────────────
    awardXp(state, 8); // эквивалент побед в стычках Ф1
    expect(spendSkillPoint(state, "repair")).toBe(true);
    expect(state.hero.stats.repair).toBe(3);
    state.location = "workshop";
    const panel = pick(state, talk(state, "taras"), "Что со светом?"); // q-blackout
    const fixPanel = pick(state, panel!, "Осмотреть щиток.");
    const restore = pick(state, fixPanel!, "Починить щиток.");
    pick(state, restore!, "Проверить свет.");
    expect(state.questStates["q-blackout"]?.status).toBe("done");
    expect(state.flags["power-restored"]).toBe(true);

    // ── Клещ: выследить → бой у складов → доклад ───────────────────────────
    state.location = "square";
    pick(state, talk(state, "sergey"), "Я разберусь с Клещом."); // q-klesh
    state.location = "workshop";
    pick(state, talk(state, "taras"), "Клещ у складов?");
    expect(state.questStates["q-klesh"]?.stage).toBe("fight");
    const klesh = selectEncounter(content, state);
    expect(klesh?.id).toBe("klesh-warehouse");
    expect(klesh?.enemy).toBe("klesh");
    settleEncounter(content, klesh!, "win", state);
    expect(state.flags["klesh-defeated"]).toBe(true);
    expect(state.questStates["q-klesh"]?.stage).toBe("report");
    state.location = "square";
    pick(state, talk(state, "sergey"), "Клещ больше не проблема.");
    expect(state.questStates["q-klesh"]?.status).toBe("done");

    // ── День 14: финал и эпилог по флагам ───────────────────────────────────
    advanceTime(state, content, 12); // день 10 утро → день 14 утро
    expect(state.time).toEqual({ day: 14, slot: "morning" });
    state.location = "apartment";
    pick(state, talk(state, "luda"), "Соберёмся, как в день третий."); // q-quarantine-end
    expect(state.questStates["q-quarantine-end"]?.status).toBe("active");
    advanceTime(state, content, slotsToEvening(state.time.slot));
    const table = pick(state, talk(state, "luda"), "Я за стол.");
    expect(state.questStates["q-quarantine-end"]?.stage).toBe("broadcast");
    const finale = pick(state, table!, "Включить радио.");
    expect(state.questStates["q-quarantine-end"]?.status).toBe("done");
    expect(state.flags["game-complete-v2"]).toBe(true);

    // Все пять вариаций эпилога открыты флагами выборов прогона.
    const variants = finale!.choices.map((c) => c.text);
    for (const text of [
      "Дима рядом.",
      "Люда здесь, за столом.",
      "Клещ больше не проблема.",
      "Про Зину дошла проверка.",
      "Борис остался в больнице.",
    ]) {
      expect(variants).toContain(text);
    }
    pick(state, finale!, "Клещ больше не проблема.");
    expect(state.party).toEqual(["dima", "luda"]);
    expect(state.hero.level).toBe(2);
  });
});
