// Главное меню (пауза): вкладки Статус / Инвентарь / Квесты / Крафт / Карта /
// Настройки / Система. Все мутации сейва — только через systems/* внутри
// store.update; меню никогда не правит драфт напрямую. Пока меню открыто,
// ввод сцены блокируется (main.ts: modalOpen).
import type { IStorageProvider, SaveSlotInfo } from "../state/persistence/IStorageProvider";
import { exportSave, importSave } from "../state/persistence/exportImport";
import type { GameState, SkillId, Store } from "../types";
import type { IContentProvider } from "../content";
import type { Effect, Item } from "../content/types";
import { applyEffects } from "../systems/effects";
import { countItem, craftItem, craftStatus, removeItem } from "../systems/inventory";
import { isWindowExpired } from "../systems/quest";
import { maxHp, spendSkillPoint, xpToNextLevel } from "../systems/stats";
import { allLocations, isExitOpen, LOCATION_TITLES } from "../world";
import { onUiAction } from "../core/uiActions";
import { SLOT_LABELS } from "./hud";
import { TEXT_SPEED_STEPS, readTextSpeed, writeTextSpeed, writeTouchSetting } from "./settings";
import "./ui.css";

const SLOT_IDS = ["1", "2", "3"] as const;

const TABS = [
  { id: "status", label: "Статус" },
  { id: "inventory", label: "Инвентарь" },
  { id: "quests", label: "Квесты" },
  { id: "craft", label: "Крафт" },
  { id: "map", label: "Карта" },
  { id: "settings", label: "Настройки" },
  { id: "system", label: "Система" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const STAT_LABELS: Record<SkillId, string> = {
  medicine: "Медицина",
  repair: "Ремонт",
  persuasion: "Убеждение",
  stealth: "Скрытность",
};

const ITEM_CATEGORY_LABELS: Record<Item["category"], string> = {
  consumable: "расходное",
  material: "материал",
  tool: "инструмент",
};

const QUEST_STATUS_LABELS: Record<GameState["questStates"][string]["status"], string> = {
  active: "активно",
  done: "выполнено",
  failed: "провалено",
};

export interface PauseMenuOptions {
  storage: IStorageProvider;
  store: Store<GameState>;
  /** Контент для названий предметов/квестов/навыков и рецептов крафта. */
  content: IContentProvider;
  onResume(): void;
  onQuit(): void;
  /** После успешной загрузки/импорта: приложение перестраивает сцену под сейв. */
  onLoad?(state: GameState): void;
  /** Тач-панель сейчас включена (для отображения текущего состояния). */
  isTouchEnabled(): boolean;
  /** Включить/выключить тач-панель; настройка уже записана в ui/settings.ts. */
  onTouchChange(enabled: boolean): void;
  /** Новая скорость текста диалога, мс; настройка уже записана в ui/settings.ts. */
  onTextSpeedChange(ms: number): void;
  /** Открыть список изменений (CHANGELOG.md в игре); меню закрывается. */
  onChangelog?(): void;
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

/** Короткое описание эффекта для статуса/инвентаря (например «HP +6»). */
function describeEffect(effect: Effect): string {
  switch (effect.type) {
    case "hp":
      return `HP ${effect.delta > 0 ? "+" : ""}${effect.delta}`;
    case "resource":
      return `Ресурс ${effect.delta > 0 ? "+" : ""}${effect.delta}`;
    case "stat":
      return `${STAT_LABELS[effect.stat]} ${effect.delta > 0 ? "+" : ""}${effect.delta}`;
    default:
      return effect.type;
  }
}

/** Создаёт скрытое главное меню; управление — open/close/toggle. */
export function createPauseMenu(opts: PauseMenuOptions): PauseMenu {
  const { storage, store, content } = opts;
  const host = opts.host ?? document.body;

  const root = document.createElement("div");
  root.className = "ui-menu";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-label", "Главное меню");

  const panel = document.createElement("div");
  panel.className = "ui-menu__panel";

  const title = document.createElement("h2");
  title.className = "ui-menu__title";
  title.textContent = "Меню";

  // ── Вкладки ──────────────────────────────────────────────────────────────
  const tabbar = document.createElement("div");
  tabbar.className = "ui-menu__tabs";
  tabbar.setAttribute("role", "tablist");
  const tabButtons = new Map<TabId, HTMLButtonElement>();
  for (const tab of TABS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ui-button ui-menu__tab";
    button.textContent = tab.label;
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", "false");
    button.addEventListener("click", () => {
      switchTab(tab.id, { focusTab: false });
    });
    tabbar.append(button);
    tabButtons.set(tab.id, button);
  }

  const panes = new Map<TabId, HTMLDivElement>();
  for (const tab of TABS) {
    const pane = document.createElement("div");
    pane.className = "ui-menu__pane";
    pane.setAttribute("role", "tabpanel");
    pane.hidden = true;
    panes.set(tab.id, pane);
  }
  const paneHost = document.createElement("div");
  paneHost.className = "ui-menu__content";
  paneHost.append(...panes.values());

  const messageEl = document.createElement("div");
  messageEl.className = "ui-menu__message";
  messageEl.setAttribute("role", "status");

  const hintEl = document.createElement("div");
  hintEl.className = "ui-menu__hint";
  hintEl.textContent = "↑/↓ — выбор · ←/→ — вкладка · Enter — нажать · Esc — закрыть";

  // ── Вкладка «Система» (строится один раз) ────────────────────────────────
  const systemPane = panes.get("system")!;
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
  const changelogButton = document.createElement("button");
  changelogButton.type = "button";
  changelogButton.className = "ui-button";
  changelogButton.textContent = "Список изменений";
  changelogButton.addEventListener("click", () => {
    if (!opts.onChangelog) return;
    close();
    opts.onChangelog();
  });
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "application/json,.json";
  fileInput.className = "ui-menu__file";
  fileInput.addEventListener("change", () => {
    void importFromFile();
  });
  fileRow.append(exportButton, importButton, changelogButton, fileInput);
  systemPane.append(slotsEl, fileRow);

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

  panel.append(title, tabbar, paneHost, messageEl, hintEl, footer);
  root.append(panel);
  host.append(root);

  let shown = false;
  let disposed = false;
  let refreshSeq = 0;
  let slotInfos = new Map<string, SaveSlotInfo>();
  let activeTab: TabId = "status";

  // ─── Общие DOM-хелперы вкладок ───────────────────────────────────────────

  /** Строка «название — значение — кнопки»; вся геометрия — в ui.css. */
  function row(titleText: string, valueText: string, actions?: HTMLElement[]): HTMLDivElement {
    const rowEl = document.createElement("div");
    rowEl.className = "ui-menu__row";
    const titleEl = document.createElement("span");
    titleEl.className = "ui-menu__row-title";
    titleEl.textContent = titleText;
    const valueEl = document.createElement("span");
    valueEl.className = "ui-menu__row-value";
    valueEl.textContent = valueText;
    rowEl.append(titleEl, valueEl);
    if (actions && actions.length > 0) {
      const actionsEl = document.createElement("span");
      actionsEl.className = "ui-menu__row-actions";
      actionsEl.append(...actions);
      rowEl.append(actionsEl);
    }
    return rowEl;
  }

  function headerRow(text: string): HTMLDivElement {
    const rowEl = document.createElement("div");
    rowEl.className = "ui-menu__section";
    rowEl.textContent = text;
    return rowEl;
  }

  function emptyRow(text: string): HTMLDivElement {
    const rowEl = document.createElement("div");
    rowEl.className = "ui-menu__empty";
    rowEl.textContent = text;
    return rowEl;
  }

  function setMessage(text: string, isError = false): void {
    messageEl.textContent = text;
    messageEl.classList.toggle("ui-menu__message--error", isError);
  }

  // ─── Панели ───────────────────────────────────────────────────────────────

  function buildStatusPane(): HTMLElement[] {
    const state = store.get();
    const hero = state.hero;
    const background = content.getBackground(hero.background);
    const els: HTMLElement[] = [
      row("Герой", `${hero.name} · ${background.name}`),
      row(`Уровень ${hero.level}`, `${hero.xp}/${xpToNextLevel(hero.level)} XP`),
      row("Здоровье", `${hero.hp}/${maxHp(state)}`),
      row("Ресурс", String(hero.resource)),
      headerRow(`Навыки · свободных очков: ${hero.skillPoints}`),
    ];
    for (const stat of Object.keys(STAT_LABELS) as SkillId[]) {
      const raise = document.createElement("button");
      raise.type = "button";
      raise.className = "ui-button";
      raise.textContent = "+";
      raise.title = `Повысить: ${STAT_LABELS[stat]}`;
      raise.disabled = hero.skillPoints <= 0;
      raise.addEventListener("click", () => {
        store.update((draft) => {
          spendSkillPoint(draft, stat);
        });
        setMessage(`${STAT_LABELS[stat]} повышен`);
        afterChange();
      });
      els.push(row(STAT_LABELS[stat], String(hero.stats[stat]), [raise]));
    }
    if (hero.skills.length > 0) {
      els.push(headerRow("Особые навыки"));
      for (const skillId of hero.skills) {
        const skill = content.getSkill(skillId);
        els.push(row(skill.name, describeEffect(skill.effect)));
      }
    }
    return els;
  }

  function buildInventoryPane(): HTMLElement[] {
    const state = store.get();
    if (state.inventory.length === 0) return [emptyRow("Инвентарь пуст")];
    return state.inventory.map((entry) => {
      const item = content.getItem(entry.item);
      const actions: HTMLElement[] = [];
      if (item.category === "consumable" && item.effects.length > 0) {
        const use = document.createElement("button");
        use.type = "button";
        use.className = "ui-button";
        use.textContent = "Использовать";
        use.addEventListener("click", () => {
          store.update((draft) => {
            applyEffects(item.effects, draft, content);
            removeItem(draft, content, item.id, 1);
          });
          setMessage(`Использовано: ${item.name}`);
          afterChange();
        });
        actions.push(use);
      }
      return row(item.name, `×${entry.qty} · ${ITEM_CATEGORY_LABELS[item.category]}`, actions);
    });
  }

  function buildQuestsPane(): HTMLElement[] {
    const state = store.get();
    const entries = Object.entries(state.questStates);
    if (entries.length === 0) return [emptyRow("Заданий нет")];
    const order = { active: 0, done: 1, failed: 2 } as const;
    entries.sort((a, b) => order[a[1].status] - order[b[1].status]);
    return entries.map(([questId, qs]) => {
      const quest = content.getQuest(questId);
      let value = QUEST_STATUS_LABELS[qs.status];
      if (qs.status === "active") {
        const stage = quest.stages.find((s) => s.id === qs.stage);
        if (stage?.timeWindow) {
          const expired = isWindowExpired(stage.timeWindow, qs.startedDay, state.time);
          const day = qs.startedDay + (stage.timeWindow.days ?? 0);
          const deadline = `${SLOT_LABELS[stage.timeWindow.to].toLowerCase()} дня ${day}`;
          value += ` · до ${deadline}${expired ? " (просрочено)" : ""}`;
        }
        if (stage) value += ` · ${stage.description}`;
      }
      return row(quest.title, value);
    });
  }

  function buildCraftPane(): HTMLElement[] {
    const state = store.get();
    const recipes = content.allItems().filter((item) => item.recipe);
    if (recipes.length === 0) return [emptyRow("Рецептов нет")];
    return recipes.map((item) => {
      const recipe = item.recipe!;
      const inputs = recipe.inputs
        .map((input) => {
          const have = countItem(state, input.item);
          return `${content.getItem(input.item).name} ${have}/${input.qty}`;
        })
        .join(", ");
      const statValue = state.hero.stats[recipe.stat];
      const status = craftStatus(state, content, item.id);
      const craft = document.createElement("button");
      craft.type = "button";
      craft.className = "ui-button";
      craft.textContent = "Создать";
      craft.disabled = !status.ok;
      craft.title = status.ok ? `Создать: ${item.name}` : (status.reason ?? "");
      craft.addEventListener("click", () => {
        const ok = { value: false };
        store.update((draft) => {
          ok.value = craftItem(draft, content, item.id);
        });
        if (ok.value) setMessage(`Создано: ${item.name}`);
        else setMessage(status.reason ?? "Не получилось", true);
        afterChange();
      });
      return row(
        item.name,
        `${inputs} · ${STAT_LABELS[recipe.stat]} ≥ ${recipe.dc} (сейчас ${statValue})`,
        [craft],
      );
    });
  }

  function buildMapPane(): HTMLElement[] {
    const state = store.get();
    const els = [row("Вы здесь", LOCATION_TITLES[state.location] ?? state.location)];
    for (const def of allLocations) {
      const exits = def.exits
        .map((exit) => {
          const open = isExitOpen(def.id, exit.to, state.worldPhase);
          return `${LOCATION_TITLES[exit.to] ?? exit.to}${open ? "" : " (закрыто)"}`;
        })
        .join(", ");
      const here = def.id === state.location ? " · вы здесь" : "";
      els.push(row((LOCATION_TITLES[def.id] ?? def.id) + here, exits || "нет выходов"));
    }
    return els;
  }

  function buildSettingsPane(): HTMLElement[] {
    const els: HTMLElement[] = [];
    const touchOn = opts.isTouchEnabled();
    const touchToggle = document.createElement("button");
    touchToggle.type = "button";
    touchToggle.className = "ui-button";
    touchToggle.textContent = touchOn ? "Выключить" : "Включить";
    touchToggle.addEventListener("click", () => {
      const next = !opts.isTouchEnabled();
      writeTouchSetting(next);
      opts.onTouchChange(next);
      setMessage(`Тач-управление: ${next ? "вкл" : "выкл"}`);
      renderPane("settings");
    });
    els.push(row("Тач-управление", touchOn ? "включено" : "выключено", [touchToggle]));
    els.push(headerRow("Скорость текста диалога"));
    const current = readTextSpeed();
    for (const step of TEXT_SPEED_STEPS) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "ui-button" + (step.ms === current ? " ui-button--primary" : "");
      button.textContent = step.ms === current ? "Выбрано" : "Выбрать";
      button.addEventListener("click", () => {
        writeTextSpeed(step.ms);
        opts.onTextSpeedChange(step.ms);
        setMessage(`Скорость текста: ${step.label.toLowerCase()}`);
        renderPane("settings");
      });
      els.push(row(step.label, `${step.ms} мс/символ`, [button]));
    }
    return els;
  }

  const builders: Record<TabId, () => HTMLElement[]> = {
    status: buildStatusPane,
    inventory: buildInventoryPane,
    quests: buildQuestsPane,
    craft: buildCraftPane,
    map: buildMapPane,
    settings: buildSettingsPane,
    // «Система» строится один раз в setup: слоты/файлы хранят свои листенеры.
    system: () => [],
  };

  function renderPane(id: TabId): void {
    // «Система» статична: её DOM строится один раз (слоты/файлы держат листенеры).
    if (id === "system") return;
    const pane = panes.get(id);
    if (!pane) return;
    pane.replaceChildren(...builders[id]());
  }

  // После мутации сейва перерисовать активную панель, сохранив фокус.
  function afterChange(): void {
    const focused = visibleButtons().indexOf(document.activeElement as HTMLButtonElement);
    renderPane(activeTab);
    const buttons = visibleButtons();
    if (focused >= 0 && buttons.length > 0) {
      buttons[Math.min(focused, buttons.length - 1)]?.focus();
    }
  }

  function switchTab(id: TabId, options: { focusTab: boolean }): void {
    activeTab = id;
    for (const tab of TABS) {
      const button = tabButtons.get(tab.id)!;
      button.setAttribute("aria-selected", String(tab.id === id));
      const pane = panes.get(tab.id)!;
      pane.hidden = tab.id !== id;
    }
    renderPane(id);
    if (options.focusTab) tabButtons.get(id)?.focus();
  }

  // ─── Навигация ────────────────────────────────────────────────────────────

  function visibleButtons(): HTMLButtonElement[] {
    return Array.from(panel.querySelectorAll<HTMLButtonElement>("button")).filter(
      (button) => !button.disabled && !button.closest("[hidden]"),
    );
  }

  function moveFocus(delta: number): void {
    const buttons = visibleButtons();
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
    visibleButtons()[0]?.focus();
  }

  function switchTabBy(delta: number): void {
    const index = TABS.findIndex((tab) => tab.id === activeTab);
    const next = TABS[(index + delta + TABS.length) % TABS.length]!;
    switchTab(next.id, { focusTab: true });
  }

  // ─── Слоты/файлы (без изменений по поведению) ──────────────────────────────

  function renderSlots(): void {
    for (const id of SLOT_IDS) {
      const slotRow = rows.get(id);
      if (!slotRow) continue;
      const slot = slotInfos.get(id);
      slotRow.info.textContent = slot
        ? `${slot.heroName}, день ${slot.day} · ${formatSavedAt(slot.savedAt)}`
        : "пусто";
      slotRow.load.disabled = !slot;
      slotRow.remove.disabled = !slot;
    }
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
    else if (event.code === "ArrowLeft") switchTabBy(-1);
    else if (event.code === "ArrowRight") switchTabBy(1);
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
    else if (action === "left") switchTabBy(-1);
    else if (action === "right") switchTabBy(1);
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
    switchTab(activeTab, { focusTab: true });
    visibleButtons()[0]?.focus();
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
