// Виртуальные контролы для смартфонов: стик ходьбы + кнопки действия/меню/бега.
// Пишут в тот же InputState, что клавиатура и геймпад; сцена о разнице не знает.
import type { InputAction } from "../types";
import type { InputState } from "../core/input";
import "./touchControls.css";

export interface TouchControls {
  /** Показывать только в мире: модалы (диалог/меню/бой/выбор) перекрывают панель. */
  setActive(active: boolean): void;
  dispose(): void;
}

/** Тач-панель на устройствах с грубым указателем; ?touch=1/?touch=0 — ручной override. */
export function prefersTouchControls(win: Window = window): boolean {
  const forced = new URLSearchParams(win.location.search).get("touch");
  if (forced === "1") return true;
  if (forced === "0") return false;
  return win.matchMedia("(any-pointer: coarse)").matches;
}

export function attachTouchControls(
  input: InputState,
  host: HTMLElement = document.body,
): TouchControls {
  const root = document.createElement("div");
  root.className = "touch-controls touch-controls--hidden";
  root.setAttribute("aria-hidden", "true");

  const stick = document.createElement("div");
  stick.className = "touch-stick";
  const knob = document.createElement("div");
  knob.className = "touch-stick__knob";
  stick.append(knob);

  const actions = document.createElement("div");
  actions.className = "touch-actions";

  const held = new Set<InputAction>();
  let active = false;
  let stickPointer: number | null = null;
  let centerX = 0;
  let centerY = 0;
  let travel = 40;

  const stopStick = (): void => {
    if (stickPointer !== null && stick.hasPointerCapture(stickPointer)) {
      stick.releasePointerCapture(stickPointer);
    }
    stickPointer = null;
    knob.style.transform = "";
    input.setStick(0, 0);
  };

  const updateStick = (clientX: number, clientY: number): void => {
    let dx = clientX - centerX;
    let dy = clientY - centerY;
    const distance = Math.hypot(dx, dy);
    if (distance > travel) {
      dx = (dx / distance) * travel;
      dy = (dy / distance) * travel;
    }
    const x = dx / travel;
    const y = dy / travel;
    const magnitude = Math.hypot(x, y);
    input.setStick(magnitude < 0.14 ? 0 : x, magnitude < 0.14 ? 0 : -y);
    knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  };

  stick.addEventListener("pointerdown", (event) => {
    if (!active || stickPointer !== null) return;
    event.preventDefault();
    stickPointer = event.pointerId;
    stick.setPointerCapture(event.pointerId);
    const rect = stick.getBoundingClientRect();
    centerX = rect.left + rect.width / 2;
    centerY = rect.top + rect.height / 2;
    travel = Math.max(22, rect.width / 2 - 18);
    updateStick(event.clientX, event.clientY);
  });
  stick.addEventListener("pointermove", (event) => {
    if (event.pointerId !== stickPointer) return;
    updateStick(event.clientX, event.clientY);
  });
  const onStickEnd = (event: PointerEvent): void => {
    if (event.pointerId === stickPointer) stopStick();
  };
  stick.addEventListener("pointerup", onStickEnd);
  stick.addEventListener("pointercancel", onStickEnd);
  stick.addEventListener("lostpointercapture", onStickEnd);

  const createButton = (
    action: InputAction,
    className: string,
    label: string,
    ariaLabel: string,
  ): HTMLButtonElement => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `touch-btn ${className}`;
    button.textContent = label;
    button.setAttribute("aria-label", ariaLabel);
    const release = (): void => {
      if (!held.delete(action)) return;
      input.setAction(action, false);
    };
    button.addEventListener("pointerdown", (event) => {
      if (!active) return;
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      if (held.has(action)) return;
      held.add(action);
      input.setAction(action, true);
    });
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("lostpointercapture", release);
    return button;
  };

  actions.append(
    createButton("menu", "touch-btn--menu", "☰", "Меню"),
    createButton("run", "touch-btn--run", "Бег", "Бежать"),
    createButton("confirm", "touch-btn--confirm", "◆", "Действие / подтвердить"),
  );

  root.append(stick, actions);
  host.append(root);

  const releaseAll = (): void => {
    stopStick();
    for (const action of held) input.setAction(action, false);
    held.clear();
  };

  const onVisibility = (): void => {
    if (document.hidden) releaseAll();
  };
  window.addEventListener("blur", releaseAll);
  document.addEventListener("visibilitychange", onVisibility);
  root.addEventListener("contextmenu", (event) => event.preventDefault());

  return {
    setActive(next) {
      if (next === active) return;
      active = next;
      root.classList.toggle("touch-controls--hidden", !next);
      if (!next) releaseAll();
    },
    dispose() {
      releaseAll();
      window.removeEventListener("blur", releaseAll);
      document.removeEventListener("visibilitychange", onVisibility);
      root.remove();
    },
  };
}
