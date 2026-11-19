import { describe, expect, it } from "vitest";
import { loadBundledContent } from "../../src/content/bundled";
import { slotsToEvening, slotsToMorning } from "../../src/core/time";
import type { DialogView } from "../../src/systems/dialog";
import { chooseDialog, npcDialogId, openDialog } from "../../src/systems/dialog";
import { selectEncounter, settleEncounter } from "../../src/systems/encounters";
import { advanceTime } from "../../src/systems/effects";
import { countItem } from "../../src/systems/inventory";
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

describe("сквозной прогон акта 0 → фаза 2", () => {
  it("день 1: лекарства Люде; день 3: ужин; акт 1: склад, бой, больница", () => {
    const state = newGameForBackground(content, "intern");

    // День 1: Люда просит таблетки, Зина продаёт, Люда получает.
    state.location = "apartment";
    const ludaIntro = talk(state, "luda");
    expect(ludaIntro.choices.map((c) => c.text)).not.toContain("Давайте соберёмся в день третий.");
    pick(state, ludaIntro, "Я схожу в аптеку.");
    expect(state.questStates["q-luda-meds"]?.status).toBe("active");

    state.location = "pharmacy";
    const zina = talk(state, "zina");
    pick(state, zina, "Мне таблетки для Люды.");
    expect(countItem(state, "pills")).toBe(1);

    state.location = "apartment";
    pick(state, talk(state, "luda"), "Вот ваши таблетки.");
    expect(state.questStates["q-luda-meds"]?.status).toBe("done");
    expect(state.questStates["q-day3-end"]).toBeUndefined();

    // Ужин доступен только на третий день; спим до утра (как интеракция кровати)
    // и пережидаем до вечера (интеракция стола).
    advanceTime(state, content, slotsToMorning(state.time.slot));
    advanceTime(state, content, slotsToMorning(state.time.slot));
    advanceTime(state, content, slotsToEvening(state.time.slot));
    expect(state.time).toEqual({ day: 3, slot: "evening" });
    pick(state, talk(state, "luda"), "Давайте соберёмся в день третий.");
    expect(state.questStates["q-day3-end"]?.status).toBe("active");
    const dinner = pick(state, talk(state, "luda"), "Я за стол.");
    pick(state, dinner!, "Включить новости.");
    expect(state.worldPhase).toBe(1);
    expect(state.flags["day3-done"]).toBe(true);

    // Акт 1: Борис отправляет на склад; ящик без боя не отдаётся.
    state.location = "hospital";
    pick(state, talk(state, "boris"), "Чем помочь, Борис?");
    expect(state.questStates["q-hospital-panic"]?.status).toBe("active");
    expect(countItem(state, "meds-crate")).toBe(0);

    state.location = "pharmacy";
    const encounter = selectEncounter(content, state);
    expect(encounter?.id).toBe("warehouse-guards");
    expect(encounter?.enemy).toBe("bully");
    settleEncounter(content, encounter!, "win", state);
    expect(countItem(state, "meds-crate")).toBe(1);
    expect(state.questStates["q-hospital-panic"]?.stage).toBe("deliver");
    expect(selectEncounter(content, state)).toBeUndefined();

    // Доставка и триаж закрывают квест → карантин (фаза 2).
    state.location = "hospital";
    const deliver = pick(state, talk(state, "boris"), "Ящик уже у меня.");
    const triage = pick(state, deliver!, "Передать ящик.");
    pick(state, triage!, "Остаться и помочь.");
    expect(state.worldPhase).toBe(2);
    expect(state.questStates["q-hospital-panic"]?.status).toBe("done");
    expect(state.flags["act2-started"]).toBe(true);
    expect(countItem(state, "meds-crate")).toBe(0);
  });
});
