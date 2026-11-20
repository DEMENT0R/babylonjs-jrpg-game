// Титульный экран — главное меню при запуске: «Новая игра» (→ выбор
// персонажа), «Продолжить» (свежий слот сейва), «Список изменений».
// Пока открыт, ввод сцены блокируется (main.ts: modalOpen).
import type { GameState } from "../types";
import type { IStorageProvider } from "../state/persistence/IStorageProvider";
import { onUiAction } from "../core/uiActions";
import "./titleScreen.css";

export interface TitleScreen {
  open(): void;
  close(): void;
  isOpen(): boolean;
  dispose(): void;
}

export function createTitleScreen(opts: {
  storage: IStorageProvider;
  /** Открыт ли ченджлог поверх титула — тогда титул ввод не обрабатывает. */
  isChangelogOpen(): boolean;
  onNewGame(): void;
  /** После успешной загрузки слота: приложение применяет сейв и сцену. */
  onLoad(state: GameState): void;
  onChangelog(): void;
}): TitleScreen {
  const root = document.createElement("div");
  root.className = "ts-root";
  root.hidden = true;

  const panel = document.createElement("div");
  panel.className = "ts-panel";
  const title = document.createElement("h1");
  title.className = "ts-title";
  title.textContent = "Обычный день";
  const subtitle = document.createElement("p");
  subtitle.className = "ts-subtitle";
  subtitle.textContent = "Старогорск";
  const list = document.createElement("div");
  list.className = "ts-list";
  const status = document.createElement("p");
  status.className = "ts-status";
  const hint = document.createElement("p");
  hint.className = "ts-hint";
  hint.textContent = "↑ / ↓ — выбрать · Enter — подтвердить · тап по пункту";
  panel.append(title, subtitle, list, status, hint);
  root.append(panel);
  document.body.append(root);
  const actions: { run: () => void }[] = [
    {
      run: () => {
        closeTitle();
        opts.onNewGame();
      },
    },
    {
      run: () => {
        void continueLatest();
      },
    },
    {
      run: () => {
        opts.onChangelog();
      },
    },
  ];
  const labels = ["Новая игра", "Продолжить", "Список изменений"];
  const buttons = labels.map((label, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ts-item";
    button.textContent = label;
    button.addEventListener("click", () => {
      if (button.disabled) return;
      selected = index;
      highlight();
      actions[index]!.run();
    });
    list.append(button);
    return button;
  });
  const continueGame = buttons[1]!;

  let selected = 0;
  let closed = true;

  const highlight = () => {
    buttons.forEach((b, i) => b.classList.toggle("ts-item--active", i === selected));
  };

  /** «Продолжить»: свежий слот по savedAt; пусто/ошибка — подпись-статус. */
  async function continueLatest(): Promise<void> {
    if (closed) return;
    try {
      const slots = await opts.storage.listSlots();
      if (slots.length === 0) {
        status.textContent = "Нет сохранений.";
        return;
      }
      const latest = slots.reduce((a, b) => (a.savedAt > b.savedAt ? a : b));
      const loaded = await opts.storage.load(latest.id);
      if (!loaded) {
        status.textContent = `Слот ${latest.id} пуст.`;
        return;
      }
      closeTitle();
      opts.onLoad(loaded);
    } catch (error) {
      status.textContent =
        error instanceof Error ? `Ошибка загрузки: ${error.message}` : "Не удалось загрузить.";
    }
  }

  const blocked = () => closed || opts.isChangelogOpen();

  const activate = () => {
    if (blocked()) return;
    const button = buttons[selected];
    if (button && !button.disabled) actions[selected]!.run();
  };

  const moveSelection = (delta: number): void => {
    if (blocked()) return;
    selected = (selected + delta + buttons.length) % buttons.length;
    highlight();
  };

  const onKey = (event: KeyboardEvent) => {
    if (blocked()) return;
    if (event.code === "ArrowUp" || event.code === "KeyW") {
      moveSelection(-1);
    } else if (event.code === "ArrowDown" || event.code === "KeyS") {
      moveSelection(1);
    } else if (event.code === "Enter" || event.code === "KeyE") {
      activate();
    } else {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  };

  window.addEventListener("keydown", onKey, true);
  const offUiAction = onUiAction((action) => {
    if (blocked()) return;
    if (action === "up") {
      moveSelection(-1);
    } else if (action === "down") {
      moveSelection(1);
    } else if (action === "confirm") {
      activate();
    }
  });

  function closeTitle(): void {
    closed = true;
    root.hidden = true;
  }

  return {
    open() {
      closed = false;
      root.hidden = false;
      status.textContent = "";
      selected = 0;
      highlight();
      // Есть ли сейвы для «Продолжить»: кнопка активируется по факту списка.
      continueGame.disabled = true;
      void opts.storage
        .listSlots()
        .then((slots) => {
          continueGame.disabled = closed || slots.length === 0;
        })
        .catch(() => {
          continueGame.disabled = true;
        });
    },
    close: closeTitle,
    isOpen: () => !closed,
    dispose() {
      offUiAction();
      window.removeEventListener("keydown", onKey, true);
      root.remove();
    },
  };
}
