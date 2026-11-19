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

// ─── Крафт (рецепты из контента, docs/CONTENT_SCHEMAS.md) ─────────────────────

export interface CraftStatus {
  ok: boolean;
  /** Причина недоступности для UI; null, если крафт возможен. */
  reason: string | null;
}

/** Почему крафт недоступен: навык, ингредиенты или стек результата. Чистая. */
export function craftStatus(
  state: GameState,
  content: IContentProvider,
  itemId: string,
): CraftStatus {
  const item = content.getItem(itemId);
  const recipe = item.recipe;
  if (!recipe) throw new Error(`Крафт: у предмета "${itemId}" нет рецепта`);
  if (state.hero.stats[recipe.stat] < recipe.dc) {
    return { ok: false, reason: `навык ${recipe.stat} ниже ${recipe.dc}` };
  }
  for (const input of recipe.inputs) {
    const have = countItem(state, input.item);
    if (have < input.qty) {
      return { ok: false, reason: `не хватает ${input.item} (${have}/${input.qty})` };
    }
  }
  if (countItem(state, itemId) + 1 > item.stack) {
    return { ok: false, reason: "стек результата полон" };
  }
  return { ok: true, reason: null };
}

/** Крафт: тратит ингредиенты и добавляет 1 шт. результата; false — недоступен
 *  (навык/ингредиенты/стек; стейт в этом случае не меняется). */
export function craftItem(draft: GameState, content: IContentProvider, itemId: string): boolean {
  if (!craftStatus(draft, content, itemId).ok) return false;
  const recipe = content.getItem(itemId).recipe;
  if (!recipe) throw new Error(`Крафт: у предмета "${itemId}" нет рецепта`);
  for (const input of recipe.inputs) removeItem(draft, content, input.item, input.qty);
  addItem(draft, content, itemId, 1);
  return true;
}
