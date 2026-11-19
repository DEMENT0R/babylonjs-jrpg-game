// Character select (слайс 8): три бэкграунда из контента, клавиатура + мышь.
// Оверлей создаётся из JS; после выбора onPick получает BackgroundId.
import type { BackgroundId } from "../types";
import type { IContentProvider } from "../content";
import { onUiAction } from "../core/uiActions";
import "./characterSelect.css";

const BACKGROUND_ORDER: readonly BackgroundId[] = ["intern", "student", "engineer"];
const BLURB: Record<BackgroundId, string> = {
  intern: "Полевая медицина: хил сильнее. Старт — больница, наставник Борис.",
  student: "Быстрая учёба: больше XP. Старт — общежитие, сокурсник Дима.",
  engineer: "Крафт без верстака. Старт — мастерская, дворник Тарас.",
};

export interface CharacterSelect {
  open(): void;
  close(): void;
  isOpen(): boolean;
  dispose(): void;
}

export function createCharacterSelect(opts: {
  content: IContentProvider;
  onPick(backgroundId: BackgroundId): void;
}): CharacterSelect {
  const root = document.createElement("div");
  root.className = "cs-root";
  root.hidden = true;

  const panel = document.createElement("div");
  panel.className = "cs-panel";
  const title = document.createElement("h1");
  title.className = "cs-title";
  title.textContent = "Обычный день";
  const subtitle = document.createElement("p");
  subtitle.className = "cs-subtitle";
  subtitle.textContent = "Кто ты в Старогорске?";
  const cards = document.createElement("div");
  cards.className = "cs-cards";

  const buttons = BACKGROUND_ORDER.map((id) => {
    const bg = opts.content.getBackground(id);
    const card = document.createElement("button");
    card.type = "button";
    card.className = "cs-card";
    card.dataset["background"] = id;
    const name = document.createElement("span");
    name.className = "cs-name";
    name.textContent = bg.name;
    const role = document.createElement("span");
    role.className = "cs-role";
    role.textContent = { intern: "Интерн", student: "Студент", engineer: "Инженер ЖЭКа" }[id];
    const blurb = document.createElement("span");
    blurb.className = "cs-blurb";
    blurb.textContent = BLURB[id];
    card.append(role, name, blurb);
    card.addEventListener("click", () => pick(id));
    cards.append(card);
    return card;
  });

  const hint = document.createElement("p");
  hint.className = "cs-hint";
  hint.textContent = "← → / стик — выбрать · Enter / A — подтвердить · тап по карточке";
  panel.append(title, subtitle, cards, hint);
  root.append(panel);
  document.body.append(root);

  let selected = 0;
  let closed = true;

  const highlight = () => {
    buttons.forEach((b, i) => b.classList.toggle("cs-card--active", i === selected));
  };

  const pick = (id: BackgroundId) => {
    if (closed) return;
    close();
    opts.onPick(id);
  };

  const moveSelection = (delta: number): void => {
    selected = (selected + delta + buttons.length) % buttons.length;
    highlight();
  };

  const onKey = (event: KeyboardEvent) => {
    if (closed) return;
    if (event.code === "ArrowLeft" || event.code === "KeyA") {
      moveSelection(-1);
    } else if (event.code === "ArrowRight" || event.code === "KeyD") {
      moveSelection(1);
    } else if (event.code === "Enter" || event.code === "KeyE") {
      pick(BACKGROUND_ORDER[selected]!);
    } else {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  };

  window.addEventListener("keydown", onKey, true);
  const offUiAction = onUiAction((action) => {
    if (closed) return;
    if (action === "left" || action === "up") {
      moveSelection(-1);
    } else if (action === "right" || action === "down") {
      moveSelection(1);
    } else if (action === "confirm") {
      pick(BACKGROUND_ORDER[selected]!);
    }
  });

  function close(): void {
    closed = true;
    root.hidden = true;
  }

  return {
    open() {
      closed = false;
      root.hidden = false;
      selected = 0;
      highlight();
    },
    close,
    isOpen: () => !closed,
    dispose() {
      offUiAction();
      window.removeEventListener("keydown", onKey, true);
      root.remove();
    },
  };
}
