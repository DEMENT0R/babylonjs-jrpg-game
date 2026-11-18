// Инвентарь: стопки предметов. Стек-лимит — из контента (`Item.stack`), лишнее
// не создаёт второй стак, а возвращается вызывающему как overflow.
import type { IContentProvider } from "../content";
import type { GameState } from "../types";

export function countItem(state: GameState, itemId: string): number {
  return state.inventory.find((entry) => entry.item === itemId)?.qty ?? 0;
}

/** Добавляет до `stack` предметов; возвращает количество, не поместившееся в стак. */
export function addItem(
  draft: GameState,
  content: IContentProvider,
  itemId: string,
  qty = 1,
): number {
  if (!Number.isInteger(qty) || qty < 0) throw new Error(`Инвентарь: некорректное qty ${qty}`);
  const item = content.getItem(itemId);
  const entry = draft.inventory.find((it) => it.item === itemId);
  const current = entry?.qty ?? 0;
  const accepted = Math.max(0, Math.min(qty, item.stack - current));
  if (accepted === 0) return qty;
  if (entry) entry.qty += accepted;
  else draft.inventory.push({ item: itemId, qty: accepted });
  return qty - accepted;
}

/** Забирает предметы; false — если их меньше, чем требуется (стейт не меняется). */
export function removeItem(
  draft: GameState,
  content: IContentProvider,
  itemId: string,
  qty = 1,
): boolean {
  content.getItem(itemId); // неизвестный item — ошибка контента, не молчаливый no-op
  const entry = draft.inventory.find((it) => it.item === itemId);
  if (!entry || entry.qty < qty) return false;
  entry.qty -= qty;
  if (entry.qty === 0) draft.inventory = draft.inventory.filter((it) => it !== entry);
  return true;
}
