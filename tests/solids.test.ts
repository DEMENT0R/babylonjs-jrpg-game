import { describe, expect, it } from "vitest";
import { createSolidRegistry } from "../src/core/solids";

describe("canMove", () => {
  it("без препятствий — движение свободно", () => {
    const f = createSolidRegistry();
    expect(f.canMove({ x: 0, z: 0 }, { x: 1, z: 2 }, 0.4)).toEqual({ x: 1, z: 2 });
  });

  it("стена блокирует движение сквозь неё (даже большим шагом)", () => {
    const f = createSolidRegistry();
    f.add({ x: 0, z: 0, w: 10, d: 1 }); // стена вдоль x, z ∈ [-0.5, 0.5]
    const r = f.canMove({ x: 0, z: -2 }, { x: 0, z: 2 }, 0.4);
    expect(r).toEqual({ x: 0, z: -0.9 }); // упёрлись в грань (z = -0.5 - 0.4)
  });

  it("скользит вдоль стены: свободная ось сохраняется", () => {
    const f = createSolidRegistry();
    f.add({ x: 0, z: 0, w: 10, d: 1 });
    const r = f.canMove({ x: -1, z: -2 }, { x: 2, z: -0.2 }, 0.4);
    expect(r).toEqual({ x: 2, z: -0.9 });
  });

  it("скольжение в обратную сторону: заблокирована ось x", () => {
    const f = createSolidRegistry();
    f.add({ x: 0, z: 0, w: 1, d: 10 }); // стена вдоль z, x ∈ [-0.5, 0.5]
    const r = f.canMove({ x: -2, z: -1 }, { x: 2, z: 1 }, 0.4);
    expect(r).toEqual({ x: -0.9, z: 1 });
  });

  it("угол: диагональ к колонне останавливается в контакте, без проникновения", () => {
    const f = createSolidRegistry();
    f.add({ x: 0, z: 0, w: 1, d: 1 }); // колонна, при r=0.45 — контакт с гранью 0.95
    const r = f.canMove({ x: 2, z: 2 }, { x: 0.9, z: 0.9 }, 0.45);
    expect(r).toEqual({ x: 0.9, z: 0.95 });
  });

  it("угол вплотную: скольжение вдоль грани до контакта", () => {
    const f = createSolidRegistry();
    f.add({ x: 0, z: 0, w: 1, d: 1 });
    const r = f.canMove({ x: 1.2, z: 1.2 }, { x: 0.4, z: 0.4 }, 0.45);
    expect(r).toEqual({ x: 0.4, z: 0.95 });
  });

  it("проход между двумя препятствиями, если щель шире диаметра", () => {
    const f = createSolidRegistry();
    f.add({ x: -1.5, z: 0, w: 1, d: 1 });
    f.add({ x: 1.5, z: 0, w: 1, d: 1 }); // щель x ∈ [-1, 1]
    const r = f.canMove({ x: 0, z: -3 }, { x: 0, z: 3 }, 0.4);
    expect(r).toEqual({ x: 0, z: 3 });
  });

  it("щель уже диаметра — упёрлись в препятствие, не пролезаем", () => {
    const f = createSolidRegistry();
    f.add({ x: -0.8, z: 0, w: 1, d: 1 });
    f.add({ x: 0.8, z: 0, w: 1, d: 1 }); // щель x ∈ [-0.3, 0.3] < 2r=0.8
    const r = f.canMove({ x: 0, z: -3 }, { x: 0, z: 3 }, 0.4);
    expect(r).toEqual({ x: 0, z: -0.9 });
  });
});
