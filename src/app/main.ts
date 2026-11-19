import { ArcRotateCamera, Color3, MeshBuilder, StandardMaterial, Vector3 } from "@babylonjs/core";
import { createNpcPresenter } from "./npcs";
import { loadBundledContent } from "../content/bundled";
import type { Effect, Encounter } from "../content/types";
import { createGameEngine } from "../core/engine";
import { createGamepadDriver } from "../core/gamepad";
import { attachKeyboard, createInputState } from "../core/input";
import { startGameLoop } from "../core/loop";
import { createPhasedAssets } from "../core/phasedAssets";
import { SceneManager, registerLocation } from "../core/scenes";
import { emitUiAction } from "../core/uiActions";
import { LocalStorageProvider } from "../state/persistence/LocalStorageProvider";
import { createStore } from "../state/store";
import { act, startCombat, type CombatState } from "../systems/combat";
import { advanceTime } from "../systems/effects";
import { selectEncounter, settleEncounter } from "../systems/encounters";
import { npcDialogId } from "../systems/dialog";
import { newGameForBackground } from "../systems/character";
import { addItem, countItem, removeItem } from "../systems/inventory";
import { awardXp, maxHp } from "../systems/stats";
import { createBattleScreen } from "../ui/battleScreen";
import type { BackgroundId, GameState, TimeSlot, WorldPhase } from "../types";
import { createCharacterSelect } from "../ui/characterSelect";
import { createDialogBox } from "../ui/dialogBox";
import { createHud } from "../ui/hud";
import { createPauseMenu } from "../ui/menu";
import { attachTouchControls, prefersTouchControls } from "../ui/touchControls";
import { readTextSpeed, readTouchSetting, writeTouchSetting } from "../ui/settings";
import { allLocations, isExitOpen } from "../world";
import { demoRoom } from "../world/locations/demo-room";

const TALK_RADIUS = 1.8;

declare global {
  interface Window {
    /** Отладочный доступ (консоль браузера): позиция/время/локация/фаза. */
    __jrpg?: {
      pos(): [number, number];
      time(): { day: number; slot: TimeSlot };
      location(): string;
      phase(): WorldPhase;
      engineInfo(): { fps: number; dtMs: number };
      /** Отладочный запуск боя: id врага из контента. */
      fight(enemyId: string): void;
      ui(): { dialog: boolean; menu: boolean; select: boolean; battle: boolean };
      /** Отладочный переход в локацию (для ручной проверки). */
      goto(location: string): void;
      /** Снимок сейва (диагностика в консоли). */
      save(): GameState;
    };
  }
}

const content = loadBundledContent();
const { engine, scene } = createGameEngine();
const input = createInputState();
attachKeyboard(input);
// Тач-панель: ?touch=1|0 — ручной override, иначе сохранённая настройка или auto-detect.
const forcedTouch = new URLSearchParams(window.location.search).get("touch");
const touchEnabled =
  forcedTouch !== null ? forcedTouch === "1" : (readTouchSetting() ?? prefersTouchControls());
let touch = touchEnabled ? attachTouchControls(input) : null;

/** Применить настройку тач-панели: панель создаётся/убирается на лету. */
function setTouchEnabled(on: boolean): void {
  writeTouchSetting(on);
  if (on) {
    touch ??= attachTouchControls(input);
  } else if (touch) {
    touch.dispose();
    touch = null;
  }
}

const assets = createPhasedAssets(scene);

// До character select — стартовый сейв интерна; выбор бэкграунда заменит его.
const store = createStore<GameState>(newGameForBackground(content, "intern"));
assets.setSlot(store.get().time.slot);

const camera = new ArcRotateCamera("camera", -Math.PI / 2, 0.9, 17, new Vector3(0, 0, 0), scene);
scene.activeCamera = camera;

const playerMesh = MeshBuilder.CreateCapsule("player", { radius: 0.35, height: 1.4 }, scene);
playerMesh.position.y = 0.7;
const playerMat = new StandardMaterial("playerMat", scene);
playerMat.diffuseColor = Color3.FromHexString("#4a7fb5");
playerMat.specularColor = new Color3(0.05, 0.05, 0.05);
playerMesh.material = playerMat;
camera.setTarget(playerMesh);

registerLocation(demoRoom);
for (const def of allLocations) registerLocation(def);

const manager = new SceneManager({
  scene,
  assets,
  store,
  input,
  content,
  player: { mesh: playerMesh, radius: 0.4 },
  isExitOpen,
});
manager.enter(store.get().location, { x: store.get().pos[0]!, z: store.get().pos[1]! });

const npcPresenter = createNpcPresenter(scene, content);
createHud(store); // живёт до перезагрузки страницы
const dialog = createDialogBox({ content, store, typeMs: readTextSpeed() });
const storage = new LocalStorageProvider();
const menu = createPauseMenu({
  storage,
  store,
  content,
  onResume: () => {},
  onQuit: () => window.location.reload(),
  isTouchEnabled: () => touch !== null,
  onTouchChange: setTouchEnabled,
  onTextSpeedChange: (ms) => dialog.setTextSpeed(ms),
  onLoad: (loaded) => {
    assets.setSlot(loaded.time.slot);
    // Сейв мог быть сохранён уже в локации стычки — перепроверить её при загрузке.
    encounterCheckedLocation = "";
    manager.enter(loaded.location, { x: loaded.pos[0]!, z: loaded.pos[1]! });
  },
});

// Бой: экран только рисует состояние, вся логика — systems/combat.ts.
let battle: CombatState | null = null;
let battleXp = 0;
/** Стычка, запустившая текущий бой (null — отладочный бой с клавиши B). */
let activeEncounter: Encounter | null = null;
const battleScreen = createBattleScreen(document.body, {
  onAction: (action) => {
    if (!battle || battle.outcome !== "ongoing") return;
    battle = act(battle, action);
    battleScreen.render(battle);
    if (battle.outcome !== "ongoing") settleBattle(battle);
  },
  onClose: () => {
    battleScreen.hide();
    battle = null;
  },
});

function startBattle(enemyId: string): void {
  if (battle || modalOpen()) return;
  const state = store.get();
  const enemy = content.getEnemy(enemyId);
  const items: Record<string, number> = {};
  const usableItems: Record<string, { name: string; hp: number }> = {};
  for (const entry of state.inventory) {
    items[entry.item] = entry.qty;
    const item = content.getItem(entry.item);
    const hpEffect = item.effects.find(
      (effect): effect is Extract<Effect, { type: "hp" }> =>
        effect.type === "hp" && effect.delta > 0,
    );
    if (item.category === "consumable" && hpEffect) {
      usableItems[entry.item] = { name: item.name, hp: hpEffect.delta };
    }
  }
  battleXp = enemy.xp;
  battle = startCombat(
    {
      id: "hero",
      name: state.hero.name,
      hp: state.hero.hp,
      maxHp: maxHp(state),
      stats: { ...state.hero.stats },
      items,
      usableItems,
    },
    enemy,
  );
  battleScreen.render(battle);
  battleScreen.show();
}

/** Исход боя в сейв: HP, XP/лут за победу; поражение — больница-квартира с 1 HP. */
function settleBattle(result: CombatState): void {
  const encounter = activeEncounter;
  activeEncounter = null;
  store.update((draft) => {
    draft.hero.hp = Math.min(maxHp(draft), Math.max(0, result.hero.hp));
    // Расходники, потраченные в бою (в т.ч. «Перевязать»), уходят из сейва.
    for (const [itemId, qty] of Object.entries(result.items)) {
      const have = countItem(draft, itemId);
      if (qty < have) removeItem(draft, content, itemId, have - qty);
    }
    if (result.outcome === "win") {
      awardXp(draft, battleXp);
      for (const item of result.loot) addItem(draft, content, item, 1);
    } else if (result.outcome === "lose") {
      draft.hero.hp = 1;
      draft.location = "apartment";
      draft.pos = [0, 0];
    }
    if (encounter && result.outcome !== "ongoing") {
      settleEncounter(content, encounter, result.outcome, draft);
    }
  });
}

const select = createCharacterSelect({
  content,
  onPick: (background: BackgroundId) => {
    // Подписка на store ниже сама перекрасит слот/фазу и пересоберёт локацию.
    store.update((draft) => {
      Object.assign(draft, newGameForBackground(content, background));
    });
  },
});

// Смена слота времени/фазы мира должна отражаться на сцене (T-клавиша и эффекты контента).
let lastSlot = store.get().time.slot;
let lastPhase = store.get().worldPhase;
let lastLocation = store.get().location;
store.subscribe((state) => {
  if (state.time.slot !== lastSlot) {
    lastSlot = state.time.slot;
    assets.setSlot(state.time.slot);
  }
  if (state.worldPhase !== lastPhase || state.location !== lastLocation) {
    lastPhase = state.worldPhase;
    lastLocation = state.location;
    manager.enter(state.location, { x: state.pos[0]!, z: state.pos[1]! });
  }
});

window.addEventListener("keydown", (e) => {
  if (e.repeat || dialog.isOpen() || menu.isOpen() || select.isOpen() || battle) return;
  if (e.code === "KeyT") {
    store.update((draft) => advanceTime(draft, content, 1));
  } else if (e.code === "KeyB") {
    // Отладочный вход в бой до контентного триггера акта 1.
    startBattle(store.get().worldPhase >= 2 ? "klesh" : "bully");
  }
});

window.__jrpg = {
  pos: () => store.get().pos,
  time: () => store.get().time,
  location: () => store.get().location,
  phase: () => store.get().worldPhase,
  engineInfo: () => ({ fps: engine.getFps(), dtMs: engine.getDeltaTime() }),
  fight: (enemyId) => startBattle(enemyId),
  ui: () => ({
    dialog: dialog.isOpen(),
    menu: menu.isOpen(),
    select: select.isOpen(),
    battle: battle !== null,
  }),
  goto: (location) => manager.enter(location),
  save: () => store.get(),
};

function modalOpen(): boolean {
  return dialog.isOpen() || menu.isOpen() || select.isOpen() || battle !== null;
}

let encounterCheckedLocation = "";

const gamepad = createGamepadDriver(input, (action) => {
  if (modalOpen()) emitUiAction(action);
});

startGameLoop(engine, scene, input, (dt) => {
  const modalWasOpen = modalOpen();
  gamepad.poll(navigator.getGamepads?.() ?? []);
  touch?.setActive(!modalWasOpen);
  // Кадр, в котором модал закрыли геймпадом, не должен протекать в сцену.
  if (modalWasOpen) return;

  const state = store.get();
  npcPresenter.sync(state.location, state.worldPhase);
  if (modalOpen()) return;

  // Стычка проверяется один раз на вход в локацию: побег/поражение не запирают
  // игрока, а повторный вход даёт новую попытку (успех помечает стычку пройденной).
  if (state.location !== encounterCheckedLocation) {
    encounterCheckedLocation = state.location;
    const encounter = selectEncounter(content, state);
    if (encounter) {
      activeEncounter = encounter;
      startBattle(encounter.enemy);
      return;
    }
  }

  manager.update(dt);

  if (input.pressed("confirm")) {
    const [x, z] = store.get().pos;
    const npcId = npcPresenter.nearest(x, z, TALK_RADIUS);
    if (npcId) {
      const nodeId = npcDialogId(content, npcId, store.get().worldPhase);
      if (nodeId) {
        dialog.open(nodeId);
        return;
      }
    }
  }
  if (input.pressed("menu")) menu.toggle();
});

select.open();
