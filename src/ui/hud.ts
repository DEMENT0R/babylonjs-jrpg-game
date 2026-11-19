// HUD: день/слот времени, HP, ресурс, XP и уровень — HTML-оверлей поверх canvas.
// DOM создаётся здесь, стили — ui.css; никаких сайд-эффектов на импорте.
/// <reference types="vite/client" />
import type { GameState, Store, TimeSlot } from "../types";
import { maxHp, xpToNextLevel } from "../systems/stats";
import "./ui.css";

/** Русские метки слотов времени (общие для HUD и меню). */
export const SLOT_LABELS: Record<TimeSlot, string> = {
  morning: "Утро",
  day: "День",
  evening: "Вечер",
};

export interface Hud {
  dispose(): void;
}

/**
 * Панель HUD в левом верхнем углу. Подписывается на стор и обновляет только
 * текстовые узлы/ширины полос — вёрстку и canvas не трогает.
 */
export function createHud(store: Store<GameState>, host: HTMLElement = document.body): Hud {
  const root = document.createElement("div");
  root.className = "ui-hud";
  root.setAttribute("aria-live", "polite");

  const timeRow = document.createElement("div");
  timeRow.className = "ui-hud__row ui-hud__row--time";
  const dayEl = document.createElement("span");
  dayEl.className = "ui-hud__day";
  const slotEl = document.createElement("span");
  slotEl.className = "ui-hud__slot";
  timeRow.append(dayEl, slotEl);

  const hpRow = document.createElement("div");
  hpRow.className = "ui-hud__row ui-hud__row--hp";
  const hpLabel = document.createElement("span");
  hpLabel.className = "ui-hud__label";
  hpLabel.textContent = "HP";
  const hpBar = document.createElement("div");
  hpBar.className = "ui-hud__bar ui-hud__bar--hp";
  const hpFill = document.createElement("div");
  hpFill.className = "ui-hud__fill";
  hpBar.append(hpFill);
  const hpValue = document.createElement("span");
  hpValue.className = "ui-hud__value";
  hpRow.append(hpLabel, hpBar, hpValue);

  const resourceRow = document.createElement("div");
  resourceRow.className = "ui-hud__row ui-hud__row--resource";
  const resourceLabel = document.createElement("span");
  resourceLabel.className = "ui-hud__label";
  resourceLabel.textContent = "Ресурс";
  const resourceValue = document.createElement("span");
  resourceValue.className = "ui-hud__value";
  resourceRow.append(resourceLabel, resourceValue);

  const xpRow = document.createElement("div");
  xpRow.className = "ui-hud__row ui-hud__row--xp";
  const levelEl = document.createElement("span");
  levelEl.className = "ui-hud__level";
  const xpBar = document.createElement("div");
  xpBar.className = "ui-hud__bar ui-hud__bar--xp";
  const xpFill = document.createElement("div");
  xpFill.className = "ui-hud__fill";
  xpBar.append(xpFill);
  const xpValue = document.createElement("span");
  xpValue.className = "ui-hud__value";
  xpRow.append(levelEl, xpBar, xpValue);

  root.append(timeRow, hpRow, resourceRow, xpRow);
  host.append(root);

  const percent = (value: number, max: number): string =>
    `${Math.max(0, Math.min(100, max > 0 ? (value / max) * 100 : 0))}%`;

  const render = (state: GameState): void => {
    const max = Math.max(1, maxHp(state));
    dayEl.textContent = `День ${state.time.day}`;
    slotEl.textContent = SLOT_LABELS[state.time.slot];
    hpValue.textContent = `${state.hero.hp}/${max}`;
    hpFill.style.width = percent(state.hero.hp, max);
    resourceValue.textContent = String(state.hero.resource);
    const threshold = xpToNextLevel(state.hero.level);
    levelEl.textContent = `Ур. ${state.hero.level}`;
    xpValue.textContent = `${state.hero.xp}/${threshold}`;
    xpFill.style.width = percent(state.hero.xp, threshold);
  };

  render(store.get());
  const unsubscribe = store.subscribe(render);

  return {
    dispose(): void {
      unsubscribe();
      root.remove();
    },
  };
}
