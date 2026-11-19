// Контейнеры в локациях: поиск по точке, замок и открытие с роллом лута.
// Чистая логика над драфтом сейва (как encounters): UI и меши — слой app.
import type { IContentProvider } from "../content";
import type { Container } from "../content/types";
import type { GameState, SkillId } from "../types";
import { resolveConds } from "./conditions";
import { applyEffects } from "./effects";
import { addItem, countItem } from "./inventory";

const OPENED_PREFIX = "container:";

/** Флаг одноразовости: контейнер открывается один раз за игру. */
export function containerOpenedFlag(id: string): string {
  return `${OPENED_PREFIX}${id}:opened`;
}

/** Существует ли контейнер в текущей фазе мира и выполнены ли его условия. */
export function isContainerVisible(container: Container, state: GameState): boolean {
  if (container.phases && !container.phases.includes(state.worldPhase)) return false;
  return resolveConds(container.conditions, state);
}

/** Первый видимый и ещё не открытый контейнер, чей круг накрывает точку. */
export function findContainerAt(
  content: IContentProvider,
  state: GameState,
  x: number,
  z: number,
): Container | undefined {
  return content
    .containersAt(state.location)
    .find(
      (container) =>
        isContainerVisible(container, state) &&
        state.flags[containerOpenedFlag(container.id)] !== true &&
        (x - container.at.x) ** 2 + (z - container.at.z) ** 2 <= container.at.r ** 2,
    );
}

/** Открыт ли замок: навык >= dc и инструмент в инвентаре (если задан). */
export function canOpenContainer(container: Container, state: GameState): boolean {
  const lock = container.locked;
  if (!lock) return true;
  if (lock.tool !== undefined && countItem(state, lock.tool) < 1) return false;
  return state.hero.stats[lock.skill] >= lock.dc;
}

const SKILL_TITLES: Record<SkillId, string> = {
  medicine: "медицина",
  repair: "ремонт",
  persuasion: "убеждение",
  stealth: "скрытность",
};

/** Подпись для подсказки в фокусе: «осмотреть» либо требование замка. */
export function containerHint(
  container: Container,
  state: GameState,
  content: IContentProvider,
): string {
  if (canOpenContainer(container, state)) return `осмотреть: ${container.name}`;
  const lock = container.locked!;
  const tool = lock.tool !== undefined ? ` + ${content.getItem(lock.tool).name.toLowerCase()}` : "";
  return `заперто — ${SKILL_TITLES[lock.skill]} ${lock.dc}${tool}`;
}

/** Открытие: роллит содержимое по шансу, применяет эффекты и ставит флаг.
 *  Вызывающий уже проверил canOpenContainer. Возвращает выданный лут
 *  (стек-переполнение теряется, как у трофеев боя). */
export function openContainer(
  content: IContentProvider,
  container: Container,
  draft: GameState,
  rng: () => number = Math.random,
): { item: string; qty: number }[] {
  const gained: { item: string; qty: number }[] = [];
  for (const drop of container.contents) {
    const qty = drop.qty ?? 1;
    if (qty <= 0) continue;
    if (rng() < (drop.chance ?? 1)) {
      addItem(draft, content, drop.item, qty);
      gained.push({ item: drop.item, qty });
    }
  }
  applyEffects(container.onOpenEffects, draft, content);
  draft.flags[containerOpenedFlag(container.id)] = true;
  return gained;
}
