// Стычки в локациях: выбор по условиям и разбор исхода. Чистая логика над драфтом;
// запуск боя — слой приложения (ui/battleScreen рисует, systems/combat считает).
import type { IContentProvider } from "../content";
import type { Encounter } from "../content/types";
import type { GameState } from "../types";
import { resolveConds } from "./conditions";
import { applyEffects } from "./effects";
import type { Outcome } from "./combat";

const DONE_PREFIX = "encounter:";

/** Флаг одноразовости: победа закрывает стычку, поражение/побег — нет. */
export function encounterDoneFlag(id: string): string {
  return `${DONE_PREFIX}${id}:done`;
}

/** Первая стычка локации, чьи условия выполнены и которая ещё не выиграна. */
export function selectEncounter(
  content: IContentProvider,
  state: GameState,
  location = state.location,
): Encounter | undefined {
  return content
    .encountersAt(location)
    .find(
      (encounter) =>
        state.flags[encounterDoneFlag(encounter.id)] !== true &&
        resolveConds(encounter.conditions, state),
    );
}

/** Применяет эффекты исхода; победа помечает стычку пройденной. */
export function settleEncounter(
  content: IContentProvider,
  encounter: Encounter,
  outcome: Exclude<Outcome, "ongoing">,
  draft: GameState,
): void {
  if (outcome === "win") {
    applyEffects(encounter.onWinEffects, draft, content);
    draft.flags[encounterDoneFlag(encounter.id)] = true;
    return;
  }
  applyEffects(encounter.onLoseEffects, draft, content);
}
