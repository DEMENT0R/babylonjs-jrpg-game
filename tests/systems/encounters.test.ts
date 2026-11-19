import { describe, expect, it } from "vitest";
import { loadBundledContent } from "../../src/content/bundled";
import { newGameForBackground } from "../../src/systems/character";
import { applyEffects } from "../../src/systems/effects";
import { countItem } from "../../src/systems/inventory";
import { encounterDoneFlag, selectEncounter, settleEncounter } from "../../src/systems/encounters";

const content = loadBundledContent();

function stateAtWarehouse() {
  const state = newGameForBackground(content, "intern");
  applyEffects([{ type: "startQuest", quest: "q-hospital-panic" }], state, content);
  state.location = "pharmacy";
  return state;
}

describe("encounters", () => {
  it("появляется только в своей локации и при выполненных условиях квеста", () => {
    const state = stateAtWarehouse();
    expect(selectEncounter(content, state)?.id).toBe("warehouse-guards");

    state.location = "square";
    expect(selectEncounter(content, state)).toBeUndefined();

    state.location = "pharmacy";
    state.questStates["q-hospital-panic"]!.status = "done";
    expect(selectEncounter(content, state)).toBeUndefined();
  });

  it("победа выдаёт ящик, двигает квест и закрывает стычку", () => {
    const state = stateAtWarehouse();
    const encounter = selectEncounter(content, state)!;
    settleEncounter(content, encounter, "win", state);

    expect(countItem(state, "meds-crate")).toBe(1);
    expect(state.questStates["q-hospital-panic"]?.stage).toBe("deliver");
    expect(state.flags[encounterDoneFlag(encounter.id)]).toBe(true);
    expect(selectEncounter(content, state)).toBeUndefined();
  });

  it("поражение/побег не дают ящик и оставляют попытку", () => {
    for (const outcome of ["lose", "fled"] as const) {
      const state = stateAtWarehouse();
      settleEncounter(content, selectEncounter(content, state)!, outcome, state);

      expect(countItem(state, "meds-crate")).toBe(0);
      expect(state.questStates["q-hospital-panic"]?.stage).toBe("warehouse");
      expect(selectEncounter(content, state)?.id).toBe("warehouse-guards");
    }
  });
});
