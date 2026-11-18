// Единый применитель эффектов (docs/CONTENT_SCHEMAS.md, «Словарь эффектов»).
// Работает над драфтом сейва внутри store.update: детерминированно, без DOM.
import type { IContentProvider } from "../content";
import type { Effect } from "../content/types";
import { advanceSlot } from "../core/time";
import type { GameState } from "../types";
import { addItem, removeItem } from "./inventory";
import {
  advanceQuestState,
  completeQuestState,
  expiredQuestIds,
  failQuestState,
  startQuestState,
} from "./quest";
import { changeHp } from "./stats";

/** Защита от циклов контента (квест, запускающий себя, и т.п.). */
const MAX_EFFECT_DEPTH = 8;

export function applyEffects(
  effects: readonly Effect[] | undefined,
  draft: GameState,
  content: IContentProvider,
): void {
  applyList(effects, draft, content, 0);
}

function applyList(
  effects: readonly Effect[] | undefined,
  draft: GameState,
  content: IContentProvider,
  depth: number,
): void {
  if (!effects) return;
  if (depth > MAX_EFFECT_DEPTH) throw new Error("Эффекты: превышена глубина вложенности");
  for (const effect of effects) applyEffect(effect, draft, content, depth);
}

function applyEffect(
  effect: Effect,
  draft: GameState,
  content: IContentProvider,
  depth: number,
): void {
  switch (effect.type) {
    case "setFlag":
      draft.flags[effect.id] = effect.value ?? true;
      return;
    case "giveItem":
      addItem(draft, content, effect.item, effect.qty ?? 1);
      return;
    case "takeItem":
      // Контент может требовать забрать предмет, которого нет; это не ошибка
      // (условия выбора обычно уже проверены), поэтому no-op допустим.
      removeItem(draft, content, effect.item, effect.qty ?? 1);
      return;
    case "stat":
      draft.hero.stats[effect.stat] = Math.max(0, draft.hero.stats[effect.stat] + effect.delta);
      return;
    case "resource":
      draft.hero.resource = Math.max(0, draft.hero.resource + effect.delta);
      return;
    case "hp":
      changeHp(draft, effect.delta);
      return;
    case "advanceTime":
      advanceTime(draft, content, effect.slots, depth + 1);
      return;
    case "startQuest": {
      const quest = content.getQuest(effect.quest);
      const stage = startQuestState(draft, quest, effect.stage);
      applyList(stage.onEnterEffects, draft, content, depth + 1);
      return;
    }
    case "advanceQuest": {
      const quest = content.getQuest(effect.quest);
      const stage = advanceQuestState(draft, quest, effect.stage);
      applyList(stage?.onEnterEffects, draft, content, depth + 1);
      return;
    }
    case "completeQuest": {
      const quest = content.getQuest(effect.quest);
      if (completeQuestState(draft, quest)) {
        applyList(quest.onCompleteEffects, draft, content, depth + 1);
      }
      return;
    }
    case "failQuest": {
      const quest = content.getQuest(effect.quest);
      if (failQuestState(draft, quest)) {
        applyList(quest.onFailEffects, draft, content, depth + 1);
      }
      return;
    }
    case "setWorldPhase":
      draft.worldPhase = effect.phase;
      return;
    case "joinParty":
      if (!draft.party.includes(effect.npc)) draft.party.push(effect.npc);
      return;
    case "leaveParty":
      draft.party = draft.party.filter((npc) => npc !== effect.npc);
      return;
  }
}

/**
 * Сдвигает время на `slots` и проваливает квесты, чьё окно вышло. Провал — не game
 * over, срабатывает на первом сдвиге за `to` (docs/CONTENT_SCHEMAS.md).
 */
export function advanceTime(
  draft: GameState,
  content: IContentProvider,
  slots = 1,
  depth = 0,
): void {
  if (!Number.isInteger(slots) || slots <= 0) {
    throw new Error(`advanceTime: некорректное число слотов ${slots}`);
  }
  if (depth > MAX_EFFECT_DEPTH) throw new Error("Эффекты: превышена глубина вложенности");
  for (let i = 0; i < slots; i++) draft.time = advanceSlot(draft.time);
  for (const questId of expiredQuestIds(draft, content)) {
    const quest = content.getQuest(questId);
    if (failQuestState(draft, quest)) applyList(quest.onFailEffects, draft, content, depth + 1);
  }
}
