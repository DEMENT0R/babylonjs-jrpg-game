// HTML-оверлей боя: только рисует CombatState и зовёт onAction/onClose.
// Вся логика — в systems/combat.ts; Babylon и store здесь не используются.
import type { CombatActionId, CombatState } from "../systems/combat";
import { availableActions } from "../systems/combat";

export interface BattleScreenOptions {
  onAction(action: CombatActionId): void;
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

  panel.append(title, enemyRow, heroRow, log, actions, result);
  root.appendChild(panel);
  host.appendChild(root);

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

    actions.replaceChildren();
    if (state.outcome === "ongoing") {
      result.style.display = "none";
      actions.style.display = "flex";
      for (const action of availableActions(state)) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = ACTION_LABELS[action];
        Object.assign(button.style, {
          padding: "8px 14px",
          background: "#22304a",
          color: "#e6ebf2",
          border: "1px solid #3a4d70",
          borderRadius: "6px",
          cursor: "pointer",
          fontSize: "14px",
        } satisfies Partial<CSSStyleDeclaration>);
        button.addEventListener("click", () => opts.onAction(action));
        actions.appendChild(button);
      }
    } else {
      actions.style.display = "none";
      result.style.display = "flex";
      resultText.textContent = OUTCOME_LABELS[state.outcome];
    }
  }

  return {
    render,
    show(): void {
      root.style.display = "flex";
    },
    hide(): void {
      root.style.display = "none";
    },
    dispose(): void {
      root.remove();
    },
  };
}
