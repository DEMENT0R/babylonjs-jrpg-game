import { describe, expect, it, vi } from "vitest";
import type { Mesh, Scene } from "@babylonjs/core";
import type { GameState, LocationDef, PhasedAssets, Store } from "../src/types";
import {
  findExit,
  getLocation,
  locationIds,
  registerLocation,
  SceneManager,
} from "../src/core/scenes";

function fakeStore(initial: GameState): Store<GameState> {
  let state = initial;
  const subs = new Set<(s: GameState) => void>();
  return {
    get: () => state,
    update(fn) {
      const draft = structuredClone(state);
      fn(draft);
      state = draft;
      for (const s of subs) s(state);
    },
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
  };
}

const save = (location: string, pos: [number, number]): GameState => ({
  saveVersion: 1,
  hero: {
    background: "intern",
    name: "Тест",
    hp: 20,
    resource: 10,
    stats: { medicine: 1, repair: 0, persuasion: 0, stealth: 0 },
    skills: [],
  },
  party: [],
  worldPhase: 0,
  time: { day: 1, slot: "morning" },
  location,
  pos,
  inventory: [],
  questStates: {},
  flags: {},
});

const idleInput = {
  axis: () => ({ x: 0, y: 0 }),
  pressed: () => false,
  held: () => false,
};

// Фейк для SceneManager: только то, что менеджер трогает (dispose/position/rotation).
const fakeMesh = (): Mesh =>
  ({ dispose: vi.fn(), position: { x: 0, z: 0 }, rotation: { y: 0 } }) as unknown as Mesh;

const fakeScene = (): Scene => ({ meshes: [] }) as unknown as Scene;
const fakeAssets = {} as unknown as PhasedAssets;

describe("реестр локаций", () => {
  it("registerLocation + getLocation + locationIds", () => {
    const def = { id: "reg-a", build: () => {}, update: () => {}, exits: [], interacts: [] };
    registerLocation(def);
    expect(getLocation("reg-a")).toBe(def);
    expect(locationIds()).toContain("reg-a");
  });

  it("дубликат id — ошибка", () => {
    const def = { id: "reg-dup", build: () => {}, update: () => {}, exits: [], interacts: [] };
    registerLocation(def);
    expect(() => registerLocation(def)).toThrow(/already registered/);
  });
});

describe("findExit", () => {
  const exits = [{ to: "b", at: { x: 0, z: 0, r: 1 }, spawn: { x: 0, z: 0 }, label: "дверь" }];

  it("внутри радиуса — выход найден", () => {
    expect(findExit(exits, 0.5, 0.5)).toBe(exits[0]);
  });

  it("вне радиуса и на границе — нет", () => {
    expect(findExit(exits, 2, 0)).toBeUndefined();
    expect(findExit(exits, 1, 0)).toBeUndefined(); // строгое <
  });
});

describe("SceneManager: смена локации", () => {
  function setup(idA: string, idB: string, isExitOpen?: (f: string, t: string) => boolean) {
    const meshA = fakeMesh();
    const meshB = fakeMesh();
    const playerMesh = fakeMesh();
    const scene = fakeScene();
    const locA: LocationDef = {
      id: idA,
      build: (ctx) => {
        ctx.scene.meshes.push(meshA);
      },
      update: () => {},
      exits: [{ to: idB, at: { x: 0, z: 0, r: 2 }, spawn: { x: 5, z: 5, yaw: 1 }, label: "выход" }],
      interacts: [],
    };
    const locB: LocationDef = {
      id: idB,
      build: (ctx) => {
        ctx.scene.meshes.push(meshB);
      },
      update: () => {},
      exits: [],
      interacts: [],
    };
    registerLocation(locA);
    registerLocation(locB);
    const store = fakeStore(save(idA, [0, 0]));
    const manager = new SceneManager({
      scene,
      assets: fakeAssets,
      store,
      input: idleInput,
      player: { mesh: playerMesh, radius: 0.4 },
      isExitOpen: isExitOpen,
    });
    return { manager, store, meshA, meshB, playerMesh, scene };
  }

  it("enter строит локацию; выход переключает и сносит меши прошлой", () => {
    const { manager, store, meshA, meshB, playerMesh, scene } = setup("mgr-a1", "mgr-b1");
    manager.enter("mgr-a1");
    expect(manager.currentId).toBe("mgr-a1");
    expect(scene.meshes).toContain(meshA);

    manager.update(0.5); // сжигаем grace перехода
    manager.update(0.016); // игрок в круге выхода → переход
    expect(manager.currentId).toBe("mgr-b1");
    expect(meshA.dispose).toHaveBeenCalled();
    expect(scene.meshes).toContain(meshB);
    expect(meshB.dispose).not.toHaveBeenCalled(); // новая локация живёт
    expect(store.get().pos).toEqual([5, 5]);
    expect(playerMesh.position).toEqual({ x: 5, z: 5 });
    expect(playerMesh.rotation.y).toBe(1);
  });

  it("закрытый isExitOpen не пропускает через выход", () => {
    const { manager } = setup("mgr-a2", "mgr-b2", () => false);
    manager.enter("mgr-a2");
    manager.update(0.5);
    manager.update(0.016);
    expect(manager.currentId).toBe("mgr-a2");
  });

  it("неизвестная локация — ошибка", () => {
    const { manager } = setup("mgr-a3", "mgr-b3");
    expect(() => manager.enter("mgr-nowhere")).toThrow(/Unknown location/);
  });
});
