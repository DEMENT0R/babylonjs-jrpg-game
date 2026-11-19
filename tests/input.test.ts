import { describe, expect, it } from "vitest";
import { createInputState } from "../src/core/input";

describe("input edge-детект", () => {
  it("pressed — только в кадр нажатия, held — пока зажата", () => {
    const s = createInputState();
    s.keyDown("KeyW");
    expect(s.pressed("up")).toBe(true);
    expect(s.held("up")).toBe(true);
    s.endFrame();
    expect(s.pressed("up")).toBe(false);
    expect(s.held("up")).toBe(true);
    s.keyUp("KeyW");
    expect(s.held("up")).toBe(false);
    expect(s.pressed("up")).toBe(false);
  });

  it("тап короче кадра не теряется: pressed живёт до ближайшего endFrame", () => {
    const s = createInputState();
    s.keyDown("KeyE");
    s.keyUp("KeyE"); // раньше конца кадра
    expect(s.held("confirm")).toBe(false);
    expect(s.pressed("confirm")).toBe(true);
    s.endFrame();
    expect(s.pressed("confirm")).toBe(false);
  });

  it("повторный keyDown без keyUp не ре-триггерит pressed", () => {
    const s = createInputState();
    s.keyDown("Enter");
    s.endFrame();
    s.keyDown("Enter"); // имитация e.repeat, пропущенного обёрткой
    expect(s.pressed("confirm")).toBe(false);
    expect(s.held("confirm")).toBe(true);
  });

  it("axis: WASD и стрелки, противоположные клавиши гасятся", () => {
    const s = createInputState();
    s.keyDown("KeyD");
    s.keyDown("ArrowUp");
    expect(s.axis()).toEqual({ x: 1, y: 1 });
    s.keyDown("KeyA"); // left + right = 0 по оси
    expect(s.axis()).toEqual({ x: 0, y: 1 });
    s.keyDown("KeyS");
    expect(s.axis()).toEqual({ x: 0, y: 0 });
  });

  it("Shift = run, Esc = menu", () => {
    const s = createInputState();
    s.keyDown("ShiftLeft");
    expect(s.held("run")).toBe(true);
    expect(s.pressed("run")).toBe(true);
    s.endFrame();
    s.keyDown("Escape");
    expect(s.pressed("menu")).toBe(true);
    expect(s.held("run")).toBe(true);
  });

  it("setAction даёт touch/gamepad тот же edge-детект, что клавиши", () => {
    const s = createInputState();
    s.setAction("confirm", true);
    expect(s.pressed("confirm")).toBe(true);
    expect(s.held("confirm")).toBe(true);
    s.endFrame();
    s.setAction("confirm", true); // удержание не ре-триггерит
    expect(s.pressed("confirm")).toBe(false);
    s.setAction("confirm", false);
    expect(s.held("confirm")).toBe(false);
  });

  it("аналоговый стик складывается с цифровыми осями и клампится", () => {
    const s = createInputState();
    s.setStick(0.6, -0.4);
    expect(s.axis()).toEqual({ x: 0.6, y: -0.4 });
    s.keyDown("KeyD");
    s.keyDown("ArrowUp");
    expect(s.axis()).toEqual({ x: 1, y: 0.6 });
    s.setStick(5, -5);
    expect(s.axis()).toEqual({ x: 1, y: 0 });
    s.setStick(5, 5);
    expect(s.axis()).toEqual({ x: 1, y: 1 });
    s.setStick(0, 0);
    s.keyUp("KeyD");
    s.keyUp("ArrowUp");
    expect(s.axis()).toEqual({ x: 0, y: 0 });
  });
});
