import type { Input, InputAction } from "../types";

// Раскладка по CONTRACTS.md: WASD/стрелки — движение, E/Enter — confirm,
// Esc — menu, Shift — run. Backspace → cancel — расширение для HTML-меню (слайс 5).
const KEY_ACTIONS: Record<string, readonly InputAction[]> = {
  KeyW: ["up"],
  ArrowUp: ["up"],
  KeyS: ["down"],
  ArrowDown: ["down"],
  KeyA: ["left"],
  ArrowLeft: ["left"],
  KeyD: ["right"],
  ArrowRight: ["right"],
  KeyE: ["confirm"],
  Enter: ["confirm"],
  Escape: ["menu"],
  ShiftLeft: ["run"],
  ShiftRight: ["run"],
  Backspace: ["cancel"],
};

/** Логика инпута без DOM: keyDown/keyUp можно звать из тестов и обвязки. */
export interface InputState extends Input {
  keyDown(code: string): void;
  keyUp(code: string): void;
  /** Конец кадра: сбрасывает edge-состояние (pressed). Вызывается из game loop. */
  endFrame(): void;
}

/** Состояние клавиш: held — «зажато», pressed — только в кадр нажатия (edge-детект). */
export function createInputState(): InputState {
  const held = new Set<InputAction>();
  const pressed = new Set<InputAction>();
  const apply = (code: string, down: boolean): void => {
    for (const action of KEY_ACTIONS[code] ?? []) {
      if (down) {
        if (!held.has(action)) {
          held.add(action);
          pressed.add(action);
        }
      } else {
        held.delete(action);
        // pressed НЕ снимаем: тап короче кадра должен дожить до ближайшего
        // опроса и погаснуть endFrame'ом, а не потеряться в keyup
      }
    }
  };
  return {
    keyDown(code) {
      apply(code, true);
    },
    keyUp(code) {
      apply(code, false);
    },
    endFrame() {
      pressed.clear();
    },
    // y > 0 — «вперёд/вверх» на экране; знак в мировые оси переводит потребитель.
    axis() {
      return {
        x: (held.has("right") ? 1 : 0) - (held.has("left") ? 1 : 0),
        y: (held.has("up") ? 1 : 0) - (held.has("down") ? 1 : 0),
      };
    },
    pressed(a) {
      return pressed.has(a);
    },
    held(a) {
      return held.has(a);
    },
  };
}

/** Обёртка над DOM keydown/keyup; возвращает отписку. */
export function attachKeyboard(
  state: InputState,
  target: Pick<Window, "addEventListener" | "removeEventListener"> = window,
): () => void {
  const down = (e: KeyboardEvent): void => {
    if (e.repeat) return; // автоповрат браузера не должен ре-триггерить edge
    state.keyDown(e.code);
  };
  const up = (e: KeyboardEvent): void => {
    state.keyUp(e.code);
  };
  target.addEventListener("keydown", down);
  target.addEventListener("keyup", up);
  return () => {
    target.removeEventListener("keydown", down);
    target.removeEventListener("keyup", up);
  };
}
