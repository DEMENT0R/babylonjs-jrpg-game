// Состояние квестов как чистая логика над драфтом сейва. Эффекты стадий/квестов
// применяет systems/effects.ts — здесь только переходы статусов и окон времени.
import type { IContentProvider } from "../content";
import type { Quest, QuestStage, TimeWindow } from "../content/types";
import type { GameState } from "../types";
import { SLOT_RANK } from "./conditions";

export function questStage(quest: Quest, stageId: string): QuestStage {
  const stage = quest.stages.find((s) => s.id === stageId);
  if (!stage) throw new Error(`Квест "${quest.id}": неизвестная стадия "${stageId}"`);
  return stage;
}

export function nextQuestStage(quest: Quest, currentId: string): QuestStage | undefined {
  const index = quest.stages.findIndex((s) => s.id === currentId);
  if (index < 0) throw new Error(`Квест "${quest.id}": неизвестная стадия "${currentId}"`);
  return quest.stages[index + 1];
}

/** Старт (или перезапуск после провала): активен, стадия — указанная или первая. */
export function startQuestState(draft: GameState, quest: Quest, stageId?: string): QuestStage {
  const stage = questStage(quest, stageId ?? quest.stages[0]!.id);
  draft.questStates[quest.id] = {
    stage: stage.id,
    status: "active",
    startedDay: draft.time.day,
  };
  return stage;
}

/** Следующая (или заданная) стадия активного квеста; undefined — квест не активен. */
export function advanceQuestState(
  draft: GameState,
  quest: Quest,
  stageId?: string,
): QuestStage | undefined {
  const state = draft.questStates[quest.id];
  if (!state || state.status !== "active") return undefined;
  const stage =
    stageId === undefined ? nextQuestStage(quest, state.stage) : questStage(quest, stageId);
  if (!stage) return undefined;
  state.stage = stage.id;
  return stage;
}

export function completeQuestState(draft: GameState, quest: Quest): boolean {
  const state = draft.questStates[quest.id];
  if (!state || state.status !== "active") return false;
  state.status = "done";
  return true;
}

export function failQuestState(draft: GameState, quest: Quest): boolean {
  const state = draft.questStates[quest.id];
  if (!state || state.status !== "active") return false;
  state.status = "failed";
  return true;
}

export function isWindowExpired(window: TimeWindow, startedDay: number, time: GameState["time"]) {
  const deadlineDay = startedDay + (window.days ?? 0);
  if (time.day !== deadlineDay) return time.day > deadlineDay;
  return SLOT_RANK[time.slot] > SLOT_RANK[window.to];
}

/** Активные квесты, чья текущая стадия с окном уже просрочена на текущее время. */
export function expiredQuestIds(state: GameState, content: IContentProvider): string[] {
  const expired: string[] = [];
  for (const [questId, qs] of Object.entries(state.questStates)) {
    if (qs.status !== "active") continue;
    const stage = content.getQuest(questId).stages.find((s) => s.id === qs.stage);
    if (!stage?.timeWindow) continue;
    if (isWindowExpired(stage.timeWindow, qs.startedDay, state.time)) expired.push(questId);
  }
  return expired;
}
