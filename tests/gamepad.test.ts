import { describe, expect, it } from "vitest";
import { createGamepadDriver, stickAxes, type GamepadLike } from "../src/core/gamepad";
import { createInputState } from "../src/core/input";

function pad(
  pressedButtons: readonly number[],
  axes: readonly [number, number] = [0, 0],
): GamepadLike {
  const buttons = Array.from({ length: 16 }, () => ({ pressed: false }));
  for (const index of pressedButtons) buttons[index]!.pressed = true;
  return { connected: true, buttons, axes };
}

describe("геймпад → InputState", () => {
  it("A даёт confirm один раз на нажатие, отпускание снимает held", () => {
    const input = createInputState();
    const driver = createGamepadDriver(input);
    driver.poll([pad([0])]);
    expect(input.pressed("confirm")).toBe(true);
    expect(input.held("confirm")).toBe(true);
    input.endFrame();
    driver.poll([pad([0])]);
    expect(input.pressed("confirm")).toBe(false);
    expect(input.held("confirm")).toBe(true);
    driver.poll([pad([])]);
    expect(input.held("confirm")).toBe(false);
  });

  it("DPad/плечи маппятся в действия, отключение геймпада снимает всё", () => {
    const input = createInputState();
    const driver = createGamepadDriver(input);
    driver.poll([pad([12, 4, 9])]);
    expect(input.held("up")).toBe(true);
    expect(input.held("run")).toBe(true);
    expect(input.held("menu")).toBe(true);
    driver.poll([null]);
    expect(input.held("up")).toBe(false);
    expect(input.held("run")).toBe(false);
    expect(input.held("menu")).toBe(false);
  });

  it("левый стик мёртвая зона/инверсия Y, ось доходит до InputState", () => {
    expect(stickAxes([0, 0])).toEqual({ x: 0, y: 0 });
    expect(stickAxes([0.1, -0.1])).toEqual({ x: 0, y: 0 });
    expect(stickAxes([1, -1])).toEqual({ x: 1, y: 1 });
    const input = createInputState();
    const driver = createGamepadDriver(input);
    driver.poll([pad([], [0.8, -0.8])]);
    const axis = input.axis();
    expect(axis.x).toBeGreaterThan(0.7);
    expect(axis.y).toBeGreaterThan(0.7);
    driver.poll([pad([], [0, 0])]);
    expect(input.axis()).toEqual({ x: 0, y: 0 });
  });

  it("edge-нажатия и наклон стика уходят в UI-колбэк без повторов", () => {
    const input = createInputState();
    const actions: string[] = [];
    const driver = createGamepadDriver(input, (action) => actions.push(action));
    driver.poll([pad([0])]);
    driver.poll([pad([0])]);
    expect(actions).toEqual(["confirm"]);
    driver.poll([pad([], [0, -0.9])]);
    driver.poll([pad([], [0, -0.9])]);
    expect(actions).toEqual(["confirm", "up"]);
    driver.poll([pad([], [0, 0])]);
    driver.poll([pad([], [0.9, 0])]);
    expect(actions).toEqual(["confirm", "up", "right"]);
  });
});
