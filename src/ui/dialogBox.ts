// Диалогбокс: печатает текст узла, показывает видимые выборы и применяет их
// через chooseDialog/store.update. Вся логика диалога — в systems/dialog.ts.
import type { IContentProvider } from "../content";
import type { DialogView } from "../systems/dialog";
import { chooseDialog, openDialog } from "../systems/dialog";
import type { GameState, Store } from "../types";
import { onUiAction } from "../core/uiActions";
import "./ui.css";

/** Задержка печати одного символа, мс. */
const TYPE_MS = 30;

export interface DialogBoxOptions {
  content: IContentProvider;
  store: Store<GameState>;
  /** Хост оверлея (по умолчанию document.body). */
  host?: HTMLElement;
  onClose?(): void;
}

export interface DialogBox {
  open(nodeId: string): void;
  close(): void;
  isOpen(): boolean;
  dispose(): void;
}

/** Создаёт скрытый диалогбокс; открывается через `open(nodeId)`. */
export function createDialogBox(opts: DialogBoxOptions): DialogBox {
  const { content, store } = opts;
  const host = opts.host ?? document.body;

  const root = document.createElement("div");
  root.className = "ui-dialog";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");

  const box = document.createElement("div");
  box.className = "ui-dialog__box";

  const speakerEl = document.createElement("div");
  speakerEl.className = "ui-dialog__speaker";

  const textEl = document.createElement("div");
  textEl.className = "ui-dialog__text";

  const choicesEl = document.createElement("div");
  choicesEl.className = "ui-dialog__choices";

  const hintEl = document.createElement("div");
  hintEl.className = "ui-dialog__hint";

  box.append(speakerEl, textEl, choicesEl, hintEl);
  root.append(box);
  host.append(root);

  let shown = false;
  let current: DialogView | null = null;
  let selected = 0;
  let typed: string[] = [];
  let typedCount = 0;
  let typeTimer: number | undefined;
  let choiceButtons: HTMLButtonElement[] = [];

  const isTyping = (): boolean => typeTimer !== undefined;

  const stopTyping = (): void => {
    if (typeTimer !== undefined) {
      window.clearInterval(typeTimer);
      typeTimer = undefined;
    }
  };

  const updateSelection = (): void => {
    choiceButtons.forEach((button, index) => {
      button.classList.toggle("ui-dialog__choice--selected", index === selected);
    });
  };

  const renderChoices = (): void => {
    choicesEl.replaceChildren();
    choiceButtons = [];
    if (!current) return;
    current.choices.forEach((choice, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "ui-dialog__choice";
      button.textContent = choice.text;
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        if (isTyping()) return;
        select(index);
      });
      button.addEventListener("mouseenter", () => {
        if (isTyping()) return;
        selected = index;
        updateSelection();
      });
      choiceButtons.push(button);
      choicesEl.append(button);
    });
    if (current.choices.length > 0) {
      hintEl.textContent =
        "↑/↓ — выбор · E/Enter/A — подтвердить · Esc/B — закрыть · тап по варианту";
    } else {
      hintEl.textContent = "E/Enter/A или тап — продолжить";
    }
    updateSelection();
  };

  const finishTyping = (): void => {
    stopTyping();
    textEl.textContent = typed.join("");
    typedCount = typed.length;
    renderChoices();
  };

  const startTyping = (text: string): void => {
    stopTyping();
    typed = Array.from(text);
    typedCount = 0;
    textEl.textContent = "";
    choicesEl.replaceChildren();
    choiceButtons = [];
    hintEl.textContent = "";
    if (typed.length === 0) {
      finishTyping();
      return;
    }
    typeTimer = window.setInterval(() => {
      typedCount += 1;
      textEl.textContent = typed.slice(0, typedCount).join("");
      if (typedCount >= typed.length) finishTyping();
    }, TYPE_MS);
  };

  const show = (view: DialogView): void => {
    current = view;
    selected = 0;
    speakerEl.textContent = content.getNpc(view.node.npc).name;
    root.classList.add("ui-dialog--open");
    document.body.classList.add("ui-dialog-open");
    shown = true;
    startTyping(view.node.text);
  };

  function select(index: number): void {
    const view = current;
    const choice = view?.choices[index];
    if (!view || !choice) return;
    // Следующий узел вычисляем после применения эффектов: выбор может менять
    // состояние, от которого зависят видимые реплики следующего узла.
    const result: { next: string | null } = { next: null };
    store.update((draft) => {
      result.next = chooseDialog(content, view.node, choice.index, draft);
    });
    if (result.next) {
      show(openDialog(content, store.get(), result.next));
    } else {
      close();
    }
  }

  function moveSelection(delta: number): void {
    if (!shown || isTyping() || choiceButtons.length === 0) return;
    selected = (selected + delta + choiceButtons.length) % choiceButtons.length;
    updateSelection();
  }

  function confirm(): void {
    if (!shown) return;
    if (isTyping()) {
      finishTyping();
      return;
    }
    if (current && current.choices.length > 0) {
      select(selected);
    } else {
      close();
    }
  }

  const onKeyDown = (event: KeyboardEvent): void => {
    if (!shown) return;
    // Пока диалог открыт, клавиатура принадлежит ему: сцена не должна получать
    // ни движения, ни confirm. Keyup не глушим, чтобы не залипало held-состояние.
    event.preventDefault();
    event.stopPropagation();
    if (event.repeat) return;
    switch (event.code) {
      case "ArrowUp":
      case "KeyW":
        moveSelection(-1);
        break;
      case "ArrowDown":
      case "KeyS":
        moveSelection(1);
        break;
      case "KeyE":
      case "Enter":
      case "Space":
        confirm();
        break;
      case "Escape":
      case "Backspace":
        close();
        break;
      default:
        break;
    }
  };

  // Клик/тап по тексту/коробке: пока идёт печать — допечатать, после — закрыть
  // реплику без выборов. Клики по выборам обрабатываются кнопками (они всплывают
  // сюда уже после своего обработчика).
  const onClick = (): void => {
    if (!shown) return;
    if (isTyping()) {
      finishTyping();
      return;
    }
    if (current && current.choices.length === 0) close();
  };

  function close(): void {
    if (!shown) return;
    shown = false;
    current = null;
    stopTyping();
    root.classList.remove("ui-dialog--open");
    document.body.classList.remove("ui-dialog-open");
    opts.onClose?.();
  }

  root.addEventListener("click", onClick);
  window.addEventListener("keydown", onKeyDown, true);
  const offUiAction = onUiAction((action) => {
    if (!shown) return;
    if (action === "up") moveSelection(-1);
    else if (action === "down") moveSelection(1);
    else if (action === "confirm") confirm();
    else if (action === "cancel" || action === "menu") close();
  });

  return {
    open(nodeId: string): void {
      show(openDialog(content, store.get(), nodeId));
    },
    close,
    isOpen: () => shown,
    dispose(): void {
      close();
      offUiAction();
      window.removeEventListener("keydown", onKeyDown, true);
      root.removeEventListener("click", onClick);
      root.remove();
    },
  };
}
