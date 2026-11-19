// Меню паузы: слоты 1–3 (сохранить/загрузить/удалить), экспорт/импорт JSON,
// продолжить/выйти. Пока меню открыто, ввод сцены блокируется.
import type { IStorageProvider, SaveSlotInfo } from "../state/persistence/IStorageProvider";
import { exportSave, importSave } from "../state/persistence/exportImport";
import type { GameState, Store } from "../types";
import { onUiAction } from "../core/uiActions";
import "./ui.css";

const SLOT_IDS = ["1", "2", "3"] as const;

export interface PauseMenuOptions {
  storage: IStorageProvider;
  store: Store<GameState>;
  onResume(): void;
  onQuit(): void;
  /** После успешной загрузки/импорта: приложение перестраивает сцену под сейв. */
  onLoad?(state: GameState): void;
  /** Хост оверлея (по умолчанию document.body). */
  host?: HTMLElement;
}

export interface PauseMenu {
  open(): void;
  close(): void;
  toggle(): void;
  isOpen(): boolean;
  dispose(): void;
}

interface SlotRow {
  info: HTMLSpanElement;
  load: HTMLButtonElement;
  remove: HTMLButtonElement;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function formatSavedAt(savedAt: string): string {
  const date = new Date(savedAt);
  if (Number.isNaN(date.getTime())) return savedAt;
  return date.toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" });
}

/** Создаёт скрытое меню паузы; управление — open/close/toggle. */
export function createPauseMenu(opts: PauseMenuOptions): PauseMenu {
  const { storage, store } = opts;
  const host = opts.host ?? document.body;

  const root = document.createElement("div");
  root.className = "ui-menu";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-label", "Меню паузы");

  const panel = document.createElement("div");
  panel.className = "ui-menu__panel";

  const title = document.createElement("h2");
  title.className = "ui-menu__title";
  title.textContent = "Пауза";

  const slotsEl = document.createElement("div");
  slotsEl.className = "ui-menu__slots";

  const rows = new Map<string, SlotRow>();

  for (const id of SLOT_IDS) {
    const row = document.createElement("div");
    row.className = "ui-menu__slot";

    const label = document.createElement("span");
    label.className = "ui-menu__slot-title";
    label.textContent = `Слот ${id}`;

    const info = document.createElement("span");
    info.className = "ui-menu__slot-info";
    info.textContent = "пусто";

    const actions = document.createElement("div");
    actions.className = "ui-menu__slot-actions";

    const save = document.createElement("button");
    save.type = "button";
    save.className = "ui-button";
    save.textContent = "Сохранить";
    save.addEventListener("click", () => {
      void saveSlot(id);
    });

    const load = document.createElement("button");
    load.type = "button";
    load.className = "ui-button";
    load.textContent = "Загрузить";
    load.addEventListener("click", () => {
      void loadSlot(id);
    });

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "ui-button ui-button--danger";
    remove.textContent = "Удалить";
    remove.addEventListener("click", () => {
      void removeSlot(id);
    });

    actions.append(save, load, remove);
    row.append(label, info, actions);
    slotsEl.append(row);
    rows.set(id, { info, load, remove });
  }

  const fileRow = document.createElement("div");
  fileRow.className = "ui-menu__file-row";

  const exportButton = document.createElement("button");
  exportButton.type = "button";
  exportButton.className = "ui-button";
  exportButton.textContent = "Экспорт JSON";
  exportButton.addEventListener("click", () => {
    exportToFile();
  });

  const importButton = document.createElement("button");
  importButton.type = "button";
  importButton.className = "ui-button";
  importButton.textContent = "Импорт JSON";
  importButton.addEventListener("click", () => {
    fileInput.click();
  });

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "application/json,.json";
  fileInput.className = "ui-menu__file";
  fileInput.addEventListener("change", () => {
    void importFromFile();
  });

  fileRow.append(exportButton, importButton, fileInput);

  const messageEl = document.createElement("div");
  messageEl.className = "ui-menu__message";
  messageEl.setAttribute("role", "status");

  const hintEl = document.createElement("div");
  hintEl.className = "ui-menu__hint";
  hintEl.textContent = "↑/↓ — выбор · Enter/A — нажать · Esc/B — закрыть";

  const footer = document.createElement("div");
  footer.className = "ui-menu__footer";

  const resumeButton = document.createElement("button");
  resumeButton.type = "button";
  resumeButton.className = "ui-button ui-button--primary";
  resumeButton.textContent = "Продолжить";
  resumeButton.addEventListener("click", resume);

  const quitButton = document.createElement("button");
  quitButton.type = "button";
  quitButton.className = "ui-button ui-button--danger";
  quitButton.textContent = "Выйти";
  quitButton.addEventListener("click", () => {
    close();
    opts.onQuit();
  });

  footer.append(resumeButton, quitButton);
  panel.append(title, slotsEl, fileRow, messageEl, hintEl, footer);
  root.append(panel);
  host.append(root);

  let shown = false;
  let disposed = false;
  let refreshSeq = 0;
  let slotInfos = new Map<string, SaveSlotInfo>();

  function setMessage(text: string, isError = false): void {
    messageEl.textContent = text;
    messageEl.classList.toggle("ui-menu__message--error", isError);
  }

  function renderSlots(): void {
    for (const id of SLOT_IDS) {
      const row = rows.get(id);
      if (!row) continue;
      const slot = slotInfos.get(id);
      row.info.textContent = slot
        ? `${slot.heroName}, день ${slot.day} · ${formatSavedAt(slot.savedAt)}`
        : "пусто";
      row.load.disabled = !slot;
      row.remove.disabled = !slot;
    }
  }

  const menuButtons = (): HTMLButtonElement[] =>
    Array.from(panel.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));

  function moveFocus(delta: number): void {
    const buttons = menuButtons();
    if (buttons.length === 0) return;
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (index < 0) {
      buttons[0]!.focus();
      return;
    }
    buttons[(index + delta + buttons.length) % buttons.length]!.focus();
  }

  function activateFocused(): void {
    const focused = document.activeElement;
    if (focused instanceof HTMLButtonElement && panel.contains(focused) && !focused.disabled) {
      focused.click();
      return;
    }
    menuButtons()[0]?.focus();
  }

  async function refreshSlots(): Promise<void> {
    const seq = ++refreshSeq;
    try {
      const infos = await storage.listSlots();
      if (disposed || seq !== refreshSeq) return;
      slotInfos = new Map(infos.map((info) => [info.id, info]));
      renderSlots();
    } catch (error) {
      if (disposed || seq !== refreshSeq) return;
      setMessage(errorText(error), true);
    }
  }

  async function saveSlot(id: string): Promise<void> {
    try {
      await storage.save(id, store.get());
      if (disposed) return;
      setMessage(`Слот ${id}: сохранено`);
      await refreshSlots();
    } catch (error) {
      if (disposed) return;
      setMessage(errorText(error), true);
    }
  }

  async function loadSlot(id: string): Promise<void> {
    try {
      const loaded = await storage.load(id);
      if (disposed) return;
      if (!loaded) {
        setMessage(`Слот ${id} пуст`, true);
        return;
      }
      store.update((draft) => {
        Object.assign(draft, loaded);
      });
      opts.onLoad?.(loaded);
      setMessage(`Слот ${id}: загружено`);
      resume();
    } catch (error) {
      if (disposed) return;
      setMessage(errorText(error), true);
    }
  }

  async function removeSlot(id: string): Promise<void> {
    try {
      await storage.remove(id);
      if (disposed) return;
      setMessage(`Слот ${id}: удалено`);
      await refreshSlots();
    } catch (error) {
      if (disposed) return;
      setMessage(errorText(error), true);
    }
  }

  function exportToFile(): void {
    try {
      const text = exportSave(store.get());
      const blob = new Blob([text], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `starogorsk-save-day-${store.get().time.day}.json`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      setMessage("Сейв экспортирован");
    } catch (error) {
      setMessage(errorText(error), true);
    }
  }

  async function importFromFile(): Promise<void> {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      const loaded = importSave(await file.text());
      if (disposed) return;
      store.update((draft) => {
        Object.assign(draft, loaded);
      });
      opts.onLoad?.(loaded);
      setMessage(`Импортирован сейв: день ${loaded.time.day}`);
    } catch (error) {
      if (!disposed) setMessage(errorText(error), true);
    } finally {
      fileInput.value = "";
    }
  }

  // Пока меню открыто, клавиатура не должна доходить до сцены. Keyup пропускаем,
  // чтобы не залипало held-состояние зажатых до паузы клавиш.
  const onKeyDown = (event: KeyboardEvent): void => {
    if (!shown) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.code === "Escape") {
      if (!event.repeat) resume();
      return;
    }
    if (event.code === "ArrowUp") moveFocus(-1);
    else if (event.code === "ArrowDown") moveFocus(1);
    else if ((event.code === "Enter" || event.code === "Space") && !event.repeat) {
      activateFocused();
    }
  };

  const offUiAction = onUiAction((action) => {
    if (!shown) return;
    if (action === "cancel" || action === "menu") {
      resume();
      return;
    }
    if (action === "up") moveFocus(-1);
    else if (action === "down") moveFocus(1);
    else if (action === "confirm") activateFocused();
  });

  // Мышь/колесо внутри оверлея не всплывают к документу и canvas.
  const stopEvent = (event: Event): void => {
    event.stopPropagation();
  };

  root.addEventListener("click", stopEvent);
  root.addEventListener("pointerdown", stopEvent);
  root.addEventListener("wheel", stopEvent, { passive: true });
  root.addEventListener("contextmenu", stopEvent);

  function applyVisibility(): void {
    root.classList.toggle("ui-menu--open", shown);
    document.body.classList.toggle("ui-menu-open", shown);
  }

  function open(): void {
    if (shown || disposed) return;
    shown = true;
    setMessage("");
    applyVisibility();
    window.addEventListener("keydown", onKeyDown, true);
    void refreshSlots();
  }

  function close(): void {
    if (!shown) return;
    shown = false;
    applyVisibility();
    window.removeEventListener("keydown", onKeyDown, true);
    const focused = document.activeElement;
    if (focused instanceof HTMLElement && panel.contains(focused)) focused.blur();
  }

  function resume(): void {
    close();
    opts.onResume();
  }

  return {
    open,
    close,
    toggle(): void {
      if (shown) resume();
      else open();
    },
    isOpen: () => shown,
    dispose(): void {
      disposed = true;
      offUiAction();
      close();
      root.removeEventListener("click", stopEvent);
      root.removeEventListener("pointerdown", stopEvent);
      root.removeEventListener("wheel", stopEvent);
      root.removeEventListener("contextmenu", stopEvent);
      root.remove();
    },
  };
}
