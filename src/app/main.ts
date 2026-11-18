import { ArcRotateCamera, Color3, MeshBuilder, StandardMaterial, Vector3 } from "@babylonjs/core";
import { createGameEngine } from "../core/engine";
import { attachKeyboard, createInputState } from "../core/input";
import { startGameLoop } from "../core/loop";
import { createPhasedAssets } from "../core/phasedAssets";
import { SceneManager, registerLocation } from "../core/scenes";
import { advanceSlot } from "../core/time";
import { newGame } from "../state/gamestate";
import { createStore } from "../state/store";
import type { GameState, TimeSlot } from "../types";
import { allLocations, isExitOpen } from "../world";
import { demoRoom } from "../world/locations/demo-room";

// Стартовое состояние — newGame слайса 2 (спавн: apartment, день 1, утро, фаза 0);
// demo-room остаётся в реестре как референс DoD-1.
const initial: GameState = newGame("intern", "Алекс");

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
const store = createStore(initial);

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

// Реестр локаций: все локации слайса 4 + демо-референс слайса 1.
registerLocation(demoRoom);
for (const def of allLocations) registerLocation(def);

const manager = new SceneManager({
  scene,
  assets,
  store,
  input,
  player: { mesh: playerMesh, radius: 0.4 },
  isExitOpen, // метро закрыто в фазах 0–1 (src/world/index.ts)
});
manager.enter(initial.location, { x: initial.pos[0]!, z: initial.pos[1]! });

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
