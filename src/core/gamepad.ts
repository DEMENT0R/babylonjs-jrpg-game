// Геймпады: опрос Gamepad API раз в кадр → те же InputAction, что у клавиатуры.
// Кнопки дают edge-действия через InputState, левый стик — аналоговую ось.
import type { InputAction } from "../types";
import type { InputState } from "./input";

/** Минимум от Gamepad, нужный драйверу; совместим с DOM Gamepad структурно. */
export interface GamepadLike {
  connected?: boolean;
  buttons: readonly { pressed: boolean; value?: number }[];
  axes: readonly number[];
}

const STICK_DEADZONE = 0.22;

/** Стандартная раскладка: A/B/Start/плечи/DPad. */
const BUTTON_ACTIONS: Readonly<Record<number, readonly InputAction[]>> = {
  0: ["confirm"], // A / Cross
  1: ["cancel"], // B / Circle
  2: ["confirm"], // X / Square
  3: ["confirm"], // Y / Triangle
  4: ["run"], // LB
  5: ["run"], // RB
  6: ["run"], // LT
  7: ["run"], // RT
  8: ["menu"], // Back / Select
  9: ["menu"], // Start
  12: ["up"],
  13: ["down"],
  14: ["left"],
  15: ["right"],
};

const scaleDeadzone = (value: number): number => {
  const magnitude = Math.abs(value);
  if (magnitude <= STICK_DEADZONE) return 0;
  const scaled = (magnitude - STICK_DEADZONE) / (1 - STICK_DEADZONE);
  return Math.sign(value) * Math.min(1, scaled);
};

/** Левый стик → экранные оси: y > 0 — вперёд (у Gamepad API вверх это −1). */
export function stickAxes(axes: readonly number[]): { x: number; y: number } {
  const forward = scaleDeadzone(axes[1] ?? 0);
  return {
    x: scaleDeadzone(axes[0] ?? 0),
    y: forward === 0 ? 0 : -forward,
  };
}

export interface GamepadDriver {
  /** Вызывать раз в кадр до игровой логики. */
  poll(pads: readonly (GamepadLike | null | undefined)[]): void;
}

/**
 * Драйвер одного активного геймпада. `onAction` получает только edge-нажатия —
 * их UI-слой превращает в навигацию по меню/диалогам, пока открыт модал.
 */
export function createGamepadDriver(
  input: InputState,
  onAction?: (action: InputAction) => void,
): GamepadDriver {
  let active = new Set<InputAction>();
  let stickDirection: InputAction | null = null;
  let stickActive = false;
  return {
    poll(pads) {
      let pad: GamepadLike | null = null;
      for (const candidate of pads) {
        if (candidate && candidate.connected !== false) {
          pad = candidate;
          break;
        }
      }
      if (!pad) {
        for (const action of active) input.setAction(action, false);
        active = new Set();
        stickDirection = null;
        // Нейтральный/отключённый геймпад не должен затирать тач-стик.
        if (stickActive) {
          input.setStick(0, 0);
          stickActive = false;
        }
        return;
      }
      const next = new Set<InputAction>();
      for (const [index, actions] of Object.entries(BUTTON_ACTIONS)) {
        const button = pad.buttons[Number(index)];
        if (button && (button.pressed || (button.value ?? 0) > 0.5)) {
          for (const action of actions) next.add(action);
        }
      }
      for (const action of next) {
        if (!active.has(action)) {
          input.setAction(action, true);
          onAction?.(action);
        }
      }
      for (const action of active) {
        if (!next.has(action)) input.setAction(action, false);
      }
      active = next;
      const stick = stickAxes(pad.axes);
      if (stick.x !== 0 || stick.y !== 0) {
        input.setStick(stick.x, stick.y);
        stickActive = true;
      } else if (stickActive) {
        input.setStick(0, 0);
        stickActive = false;
      }
      // Меню навигаются стиком по порогу, без повторного срабатывания, пока он наклонён.
      const magnitude = Math.hypot(stick.x, stick.y);
      let direction: InputAction | null = null;
      if (magnitude >= 0.72) {
        direction =
          Math.abs(stick.x) > Math.abs(stick.y)
            ? stick.x > 0
              ? "right"
              : "left"
            : stick.y > 0
              ? "up"
              : "down";
      }
      if (direction && direction !== stickDirection) onAction?.(direction);
      stickDirection = magnitude < 0.4 ? null : direction;
    },
  };
}
