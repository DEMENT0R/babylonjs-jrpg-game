import { ArcRotateCamera, Color3, MeshBuilder, StandardMaterial, Vector3 } from "@babylonjs/core";
import { createGameEngine } from "../core/engine";
import { attachKeyboard, createInputState } from "../core/input";
import { startGameLoop } from "../core/loop";
import { createPhasedAssets } from "../core/phasedAssets";
import { SceneManager, registerLocation } from "../core/scenes";
import { advanceSlot } from "../core/time";
import type { GameState, Store, TimeSlot } from "../types";
import { DEMO_SPAWN, demoRoom } from "../world/locations/demo-room";

// Демо-store до слайса 2 (state/store.ts): минимальный observable без фреймворков.
// При мерже слайса 2 замещается настоящим Store из src/state/store.ts.
function createDemoStore(initial: GameState): Store<GameState> {
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

const initial: GameState = {
  saveVersion: 1,
  hero: {
    background: "intern",
    name: "Алекс",
    hp: 20,
    resource: 10,
    stats: { medicine: 1, repair: 0, persuasion: 0, stealth: 0 },
    skills: [],
  },
  party: [],
  worldPhase: 0,
  time: { day: 1, slot: "morning" },
  location: "demo-room",
  pos: [DEMO_SPAWN.x, DEMO_SPAWN.z],
  inventory: [],
  questStates: {},
  flags: {},
};

declare global {
  interface Window {
    /** Отладочный доступ для ручной проверки DoD-1 (позиция/время из консоли браузера). */
    __jrpg?: {
      pos(): [number, number];
      time(): { day: number; slot: TimeSlot };
      engineInfo(): { fps: number; dtMs: number };
      heldUp(): boolean;
      debug(): { axis: { x: number; y: number }; def: string | null; mesh: [number, number] };
    };
  }
}

const { engine, scene } = createGameEngine();
const input = createInputState();
attachKeyboard(input);
const assets = createPhasedAssets(scene);
assets.setSlot(initial.time.slot);
const store = createDemoStore(initial);

// вид сверху-под-углом (2.5D): камера следует за игроком
const camera = new ArcRotateCamera("camera", -Math.PI / 2, 0.9, 17, new Vector3(0, 0, 0), scene);
scene.activeCamera = camera;

// игрок: капсула, коллизии — через SolidRegistry менеджера
const playerMesh = MeshBuilder.CreateCapsule("player", { radius: 0.35, height: 1.4 }, scene);
playerMesh.position.y = 0.7;
const playerMat = new StandardMaterial("playerMat", scene);
playerMat.diffuseColor = Color3.FromHexString("#4a7fb5");
playerMat.specularColor = new Color3(0.05, 0.05, 0.05);
playerMesh.material = playerMat;
camera.setTarget(playerMesh);

// Референс-локация DoD-1; при мерже слайса 4 заменяется его реестром
// (registerLocation всех локаций из src/world/index.ts, вход — по save.location).
registerLocation(demoRoom);
const manager = new SceneManager({
  scene,
  assets,
  store,
  input,
  player: { mesh: playerMesh, radius: 0.4 },
});
manager.enter("demo-room", DEMO_SPAWN);

// Слот времени: T — временная клавиша вне контракта Input (DoD-1: видимое
// переключение morning/day/evening через PhasedAssets.setSlot).
window.addEventListener("keydown", (e) => {
  if (e.code !== "KeyT" || e.repeat) return;
  const time = advanceSlot(store.get().time);
  store.update((draft) => {
    draft.time = time;
  });
  assets.setSlot(time.slot);
});

window.__jrpg = {
  pos: () => store.get().pos,
  time: () => store.get().time,
  engineInfo: () => ({ fps: engine.getFps(), dtMs: engine.getDeltaTime() }),
  heldUp: () => input.held("up"),
  debug: () => ({
    axis: input.axis(),
    def: manager.currentId,
    mesh: [playerMesh.position.x, playerMesh.position.z],
  }),
};

startGameLoop(engine, scene, input, (dt) => {
  manager.update(dt);
});
