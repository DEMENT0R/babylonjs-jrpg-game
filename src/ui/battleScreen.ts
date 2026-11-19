// HTML-оверлей боя: только рисует CombatState и зовёт onAction/onClose.
// Вся логика — в systems/combat.ts; Babylon и store здесь не используются.
import type { CombatAction, CombatActionId, CombatState } from "../systems/combat";
import { availableActions, availableItems } from "../systems/combat";
import { onUiAction } from "../core/uiActions";

export interface BattleScreenOptions {
  onAction(action: CombatAction): void;
  onClose(): void;
}

export interface BattleScreen {
  render(state: CombatState): void;
  show(): void;
  hide(): void;
  dispose(): void;
}

const ACTION_LABELS: Record<CombatActionId, string> = {
  strike: "Ударить",
  defend: "Защищаться",
  heal: "Перевязать",
  persuade: "Уговорить",
  flee: "Сбежать",
};

const OUTCOME_LABELS: Record<Exclude<CombatState["outcome"], "ongoing">, string> = {
  win: "Победа",
  lose: "Поражение",
  fled: "Бой прерван",
};

function createBar(): HTMLDivElement {
  const bar = document.createElement("div");
  bar.style.height = "10px";
  bar.style.background = "#2a3242";
  bar.style.borderRadius = "5px";
  bar.style.overflow = "hidden";
  return bar;
}

function createFill(): HTMLDivElement {
  const fill = document.createElement("div");
  fill.style.height = "100%";
  fill.style.width = "100%";
  fill.style.background = "#c0554f";
  fill.style.transition = "width 0.15s ease-out";
  return fill;
}

export function createBattleScreen(host: HTMLElement, opts: BattleScreenOptions): BattleScreen {
  const root = document.createElement("div");
  root.className = "battle-screen";
  Object.assign(root.style, {
    position: "fixed",
    inset: "0",
    display: "none",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(8, 11, 16, 0.78)",
    zIndex: "1000",
    fontFamily: "system-ui, sans-serif",
    color: "#e6ebf2",
  } satisfies Partial<CSSStyleDeclaration>);

  const panel = document.createElement("div");
  Object.assign(panel.style, {
    width: "min(560px, 92vw)",
    maxHeight: "90vh",
    overflowY: "auto",
    boxSizing: "border-box",
    padding: "16px",
    background: "#141a24",
    border: "1px solid #35415a",
    borderRadius: "10px",
    boxShadow: "0 12px 40px rgba(0, 0, 0, 0.5)",
  } satisfies Partial<CSSStyleDeclaration>);

  const title = document.createElement("h2");
  Object.assign(title.style, {
    margin: "0 0 12px",
    fontSize: "18px",
    fontWeight: "600",
  } satisfies Partial<CSSStyleDeclaration>);

  const enemyRow = document.createElement("div");
  enemyRow.style.marginBottom = "10px";
  const enemyName = document.createElement("div");
  enemyName.style.fontSize = "14px";
  const enemyBar = createBar();
  const enemyFill = createFill();
  enemyBar.appendChild(enemyFill);
  enemyRow.append(enemyName, enemyBar);

  const heroRow = document.createElement("div");
  heroRow.style.marginBottom = "12px";
  const heroName = document.createElement("div");
  heroName.style.fontSize = "14px";
  const heroBar = createBar();
  const heroFill = createFill();
  heroFill.style.background = "#4f8ac0";
  heroBar.appendChild(heroFill);
  heroRow.append(heroName, heroBar);

  const log = document.createElement("div");
  Object.assign(log.style, {
    margin: "0 0 12px",
    padding: "8px",
    maxHeight: "140px",
    overflowY: "auto",
    background: "#0d1118",
    border: "1px solid #263044",
    borderRadius: "6px",
    fontSize: "13px",
    lineHeight: "1.45",
    whiteSpace: "pre-wrap",
  } satisfies Partial<CSSStyleDeclaration>);

  const actions = document.createElement("div");
  Object.assign(actions.style, {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  } satisfies Partial<CSSStyleDeclaration>);

  const hint = document.createElement("div");
  Object.assign(hint.style, {
    marginTop: "10px",
    color: "#8d94a8",
    fontSize: "11px",
    textAlign: "right",
  } satisfies Partial<CSSStyleDeclaration>);
  hint.textContent = "←/→ — выбор · Enter/A — действие · тап по кнопке";

  const result = document.createElement("div");
  Object.assign(result.style, {
    display: "none",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
  } satisfies Partial<CSSStyleDeclaration>);

  const resultText = document.createElement("span");
  resultText.style.fontSize = "15px";

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.textContent = "Продолжить";
  Object.assign(closeButton.style, {
    padding: "8px 14px",
    background: "#2f6b4f",
    color: "#e6ebf2",
    border: "1px solid #3f8a68",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "14px",
  } satisfies Partial<CSSStyleDeclaration>);
  closeButton.addEventListener("click", () => opts.onClose());
  result.append(resultText, closeButton);

  panel.append(title, enemyRow, heroRow, log, actions, hint, result);
  root.appendChild(panel);
  host.appendChild(root);

  let visible = false;
  let ongoing = false;
  let itemMode = false;
  let current: CombatState | null = null;
  let selected = 0;
  let actionButtons: HTMLButtonElement[] = [];

  const highlight = (): void => {
    actionButtons.forEach((button, index) => {
      const active = index === selected;
      button.style.borderColor = active ? "#d7b36a" : "#3a4d70";
      button.style.background = active ? "#2d3b55" : "#22304a";
    });
  };

  function moveSelection(delta: number): void {
    if (actionButtons.length === 0) return;
    selected = (selected + delta + actionButtons.length) % actionButtons.length;
    highlight();
  }

  function confirmSelection(): void {
    if (actionButtons.length > 0) {
      actionButtons[selected]?.click();
      return;
    }
    if (!ongoing) opts.onClose();
  }

  const onKeyDown = (event: KeyboardEvent): void => {
    if (!visible) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.repeat) return;
    const confirm = event.code === "Enter" || event.code === "Space" || event.code === "KeyE";
    if (!ongoing) {
      if (confirm || event.code === "Escape") opts.onClose();
      return;
    }
    if (itemMode && event.code === "Escape") {
      backToActions();
      return;
    }
    if (event.code === "ArrowLeft" || event.code === "ArrowUp" || event.code === "KeyA") {
      moveSelection(-1);
    } else if (event.code === "ArrowRight" || event.code === "ArrowDown" || event.code === "KeyD") {
      moveSelection(1);
    } else if (confirm) {
      confirmSelection();
    }
  };

  const offUiAction = onUiAction((action) => {
    if (!visible) return;
    if (!ongoing) {
      if (action === "confirm" || action === "cancel" || action === "menu") opts.onClose();
      return;
    }
    if (itemMode && action === "cancel") backToActions();
    else if (action === "left" || action === "up") moveSelection(-1);
    else if (action === "right" || action === "down") moveSelection(1);
    else if (action === "confirm") confirmSelection();
  });

  window.addEventListener("keydown", onKeyDown, true);

  function updateFighter(
    nameEl: HTMLElement,
    fill: HTMLElement,
    fighter: CombatState["hero"],
  ): void {
    nameEl.textContent = `${fighter.name}: ${fighter.hp}/${fighter.maxHp} HP`;
    const ratio = fighter.maxHp > 0 ? Math.max(0, fighter.hp) / fighter.maxHp : 0;
    fill.style.width = `${Math.round(ratio * 100)}%`;
  }

  function render(state: CombatState): void {
    title.textContent = `Бой: ${state.hero.name} против ${state.enemy.name}`;
    updateFighter(enemyName, enemyFill, state.enemy);
    updateFighter(heroName, heroFill, state.hero);

    log.textContent = state.log.join("\n");
    log.scrollTop = log.scrollHeight;

    current = state;
    const outcome = state.outcome;
    ongoing = outcome === "ongoing";
    hint.style.display = ongoing ? "block" : "none";
    if (outcome === "ongoing") {
      result.style.display = "none";
      renderActions(state);
    } else {
      actions.style.display = "none";
      result.style.display = "flex";
      resultText.textContent = OUTCOME_LABELS[outcome];
    }
  }

  function button(label: string, onClick: () => void): HTMLButtonElement {
    const element = document.createElement("button");
    element.type = "button";
    element.textContent = label;
    Object.assign(element.style, {
      padding: "8px 14px",
      background: "#22304a",
      color: "#e6ebf2",
      border: "1px solid #3a4d70",
      borderRadius: "6px",
      cursor: "pointer",
      fontSize: "14px",
    } satisfies Partial<CSSStyleDeclaration>);
    element.addEventListener("click", onClick);
    return element;
  }

  /** Основной ряд: базовые действия + «Предмет», если есть что использовать. */
  function renderActions(state: CombatState): void {
    itemMode = false;
    actions.style.display = "flex";
    actions.replaceChildren();
    actionButtons = [];
    selected = 0;
    for (const action of availableActions(state)) {
      const element = button(ACTION_LABELS[action], () => opts.onAction(action));
      actions.appendChild(element);
      actionButtons.push(element);
    }
    const items = availableItems(state);
    if (items.length > 0) {
      const element = button("Предмет", () => renderItems(state));
      actions.appendChild(element);
      actionButtons.push(element);
    }
    highlight();
  }

  /** Ряд предметов: расходники с остатком + «Назад». */
  function renderItems(state: CombatState): void {
    itemMode = true;
    actions.replaceChildren();
    actionButtons = [];
    selected = 0;
    for (const id of availableItems(state)) {
      const usable = state.usableItems[id];
      if (!usable) continue;
      const qty = state.items[id] ?? 0;
      const element = button(`${usable.name} ×${qty}`, () =>
        opts.onAction({ type: "item", item: id }),
      );
      element.title = `Восстановить ${usable.hp} HP`;
      actions.appendChild(element);
      actionButtons.push(element);
    }
    const back = button("Назад", () => renderActions(state));
    actions.appendChild(back);
    actionButtons.push(back);
    highlight();
  }

  function backToActions(): void {
    if (current) renderActions(current);
  }

  return {
    render,
    show(): void {
      visible = true;
      root.style.display = "flex";
    },
    hide(): void {
      visible = false;
      root.style.display = "none";
    },
    dispose(): void {
      visible = false;
      offUiAction();
      window.removeEventListener("keydown", onKeyDown, true);
      root.remove();
    },
  };
}
