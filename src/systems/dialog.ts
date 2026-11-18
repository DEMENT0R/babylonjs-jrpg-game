// Диалоги: выбор видимых реплик по условиям и применение эффектов выбора.
// UI только рисует DialogView; вся логика — здесь.
import type { IContentProvider } from "../content";
import type { DialogNode } from "../content/types";
import type { GameState } from "../types";
import { resolveConds } from "./conditions";
import { applyEffects } from "./effects";

export interface DialogChoiceView {
  /** Индекс в исходном `node.choices` (для chooseDialog). */
  index: number;
  text: string;
}

export interface DialogView {
  node: DialogNode;
  choices: DialogChoiceView[];
  /** Узел без choices: null — конец диалога. */
  next: string | null;
}

/** Видимые выборы: условия + индексы исходного массива. */
export function visibleChoices(node: DialogNode, state: GameState): DialogChoiceView[] {
  return (node.choices ?? [])
    .map((choice, index) => ({ choice, index }))
    .filter(({ choice }) => resolveConds(choice.conditions, state))
    .map(({ choice, index }) => ({ index, text: choice.text }));
}

/**
 * Открывает узел и разворачивает цепочку автопереходов, пока у узла нет choices.
 * Защита от циклов `next` — ошибка контента.
 */
export function openDialog(
  content: IContentProvider,
  state: GameState,
  nodeId: string,
): DialogView {
  const visited = new Set<string>();
  let node = content.getDialog(nodeId);
  while (!node.choices || node.choices.length === 0) {
    if (node.next === undefined) return { node, choices: [], next: null };
    if (visited.has(node.id)) throw new Error(`Диалог: цикл автопереходов на "${node.id}"`);
    visited.add(node.id);
    node = content.getDialog(node.next);
  }
  return { node, choices: visibleChoices(node, state), next: node.next ?? null };
}

/**
 * Применяет выбранную реплику к драфту; возвращает id следующего узла или null.
 * Невалидный/невидимый индекс — ошибка вызывающего (UI), а не тихий no-op.
 */
export function chooseDialog(
  content: IContentProvider,
  node: DialogNode,
  choiceIndex: number,
  draft: GameState,
): string | null {
  const choice = node.choices?.[choiceIndex];
  if (!choice) throw new Error(`Диалог "${node.id}": нет выбора ${choiceIndex}`);
  if (!resolveConds(choice.conditions, draft)) {
    throw new Error(`Диалог "${node.id}": выбор ${choiceIndex} недоступен по условиям`);
  }
  applyEffects(choice.effects, draft, content);
  return choice.next ?? null;
}

/** Стартовый узел НПС в текущей фазе мира (undefined — НПС в этой фазе отсутствует). */
export function npcDialogId(content: IContentProvider, npcId: string, phase: number) {
  const phaseDef = content.getNpc(npcId).phases[phase];
  return phaseDef?.present ? phaseDef.dialog : undefined;
}
