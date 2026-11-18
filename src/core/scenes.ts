import type { AbstractMesh, Mesh, Scene } from "@babylonjs/core";
import type {
  BuildCtx,
  ExitDef,
  GameState,
  Input,
  LocationDef,
  PhasedAssets,
  Store,
  UpdateCtx,
  WorldPhase,
} from "../types";
import { createSolidRegistry, type SolidField } from "./solids";

const registry = new Map<string, LocationDef>();

/** Регистрация локации (слайс 4 наполняет через свой src/world/index.ts). Дубликат id — ошибка. */
export function registerLocation(def: LocationDef): void {
  if (registry.has(def.id)) throw new Error(`Location "${def.id}" is already registered`);
  registry.set(def.id, def);
}

export function getLocation(id: string): LocationDef | undefined {
  return registry.get(id);
}

export function locationIds(): string[] {
  return [...registry.keys()];
}

/** Чистая проверка выхода: первый ExitDef, чей триггер-круг накрывает игрока. */
export function findExit(exits: readonly ExitDef[], x: number, z: number): ExitDef | undefined {
  for (const e of exits) {
    if ((x - e.at.x) ** 2 + (z - e.at.z) ** 2 < e.at.r ** 2) return e;
  }
  return undefined;
}

/** Открыт ли переход между локациями при данной фазе мира.
 *  Слайс 4 экспортирует настоящий isExitOpen из src/world/index.ts (метро закрыто
 *  в фазах 0–1); при мерже main.ts передаёт его в SceneManager. Здесь — точка вызова. */
export type IsExitOpen = (from: string, to: string, worldPhase: WorldPhase) => boolean;

const DEFAULT_SPAWN: { x: number; z: number; yaw?: number } = { x: 0, z: 0 };
const EXIT_GRACE_SECONDS = 0.5;
const WALK_SPEED = 3.2;
const RUN_SPEED = 6;

export interface SceneManagerOptions {
  scene: Scene;
  assets: PhasedAssets;
  store: Store<GameState>;
  input: Input;
  /** Меш игрока: позицию ведёт менеджер (радиус — для коллизий). */
  player: { mesh: Mesh; radius: number };
  /** Хук интеграции слайса 4 (isExitOpen); по умолчанию все переходы открыты. */
  isExitOpen?: IsExitOpen;
}

/** Переключение LocationDef по id + покадровое обновление: движение, выходы, интеракции. */
export class SceneManager {
  private def: LocationDef | null = null;
  private builtMeshes: AbstractMesh[] = [];
  private solids: SolidField = createSolidRegistry();
  private exitGrace = 0;

  constructor(private readonly o: SceneManagerOptions) {}

  get currentId(): string | null {
    return this.def?.id ?? null;
  }

  enter(id: string, spawn?: { x: number; z: number; yaw?: number }): void {
    const def = getLocation(id);
    if (!def) throw new Error(`Unknown location "${id}"`);
    for (const m of this.builtMeshes) m.dispose();
    this.builtMeshes = [];
    this.solids = createSolidRegistry();
    const buildCtx: BuildCtx = {
      scene: this.o.scene,
      worldPhase: this.o.store.get().worldPhase,
      assets: this.o.assets,
      solids: this.solids,
    };
    const before = new Set<AbstractMesh>(this.o.scene.meshes);
    def.build(buildCtx);
    this.builtMeshes = this.o.scene.meshes.filter((m) => !before.has(m));
    this.def = def;
    const s = spawn ?? DEFAULT_SPAWN;
    this.o.store.update((draft) => {
      draft.location = id;
      draft.pos = [s.x, s.z];
    });
    this.syncPlayer(s.x, s.z, s.yaw);
    this.exitGrace = EXIT_GRACE_SECONDS;
  }

  /** Один кадр: движение игрока (input poll → canMove) → update локации → интеракции → выходы. */
  update(dt: number): void {
    if (!this.def) return;
    this.movePlayer(dt);
    const uctx: UpdateCtx = {
      scene: this.o.scene,
      dt,
      input: this.o.input,
      store: this.o.store,
    };
    this.def.update(uctx);
    this.checkInteracts(uctx);
    this.checkExit(dt);
  }

  private movePlayer(dt: number): void {
    const a = this.o.input.axis();
    if (a.x === 0 && a.y === 0) return;
    const speed = this.o.input.held("run") ? RUN_SPEED : WALK_SPEED;
    const [px, pz] = this.o.store.get().pos;
    // ось y инпута (вперёд) → −z мира: камера смотрит «сверху-под-углом»
    const to = { x: px + a.x * speed * dt, z: pz - a.y * speed * dt };
    const p = this.solids.canMove({ x: px, z: pz }, to, this.o.player.radius);
    if (p.x !== px || p.z !== pz) {
      this.o.store.update((draft) => {
        draft.pos = [p.x, p.z];
      });
      this.o.player.mesh.position.x = p.x;
      this.o.player.mesh.position.z = p.z;
    }
  }

  private checkInteracts(uctx: UpdateCtx): void {
    if (!this.def || !uctx.input.pressed("confirm")) return;
    const [x, z] = this.o.store.get().pos;
    for (const i of this.def.interacts) {
      if ((x - i.at.x) ** 2 + (z - i.at.z) ** 2 < i.at.r ** 2) {
        i.onConfirm(uctx);
        break;
      }
    }
  }

  private checkExit(dt: number): void {
    if (this.exitGrace > 0) {
      this.exitGrace -= dt;
      return;
    }
    if (!this.def) return;
    const state = this.o.store.get();
    const exit = findExit(this.def.exits, state.pos[0]!, state.pos[1]!);
    if (!exit) return;
    const open = this.o.isExitOpen?.(this.def.id, exit.to, state.worldPhase) ?? true;
    if (open) this.enter(exit.to, exit.spawn);
  }

  private syncPlayer(x: number, z: number, yaw?: number): void {
    const mesh = this.o.player.mesh;
    mesh.position.x = x;
    mesh.position.z = z;
    if (yaw !== undefined) mesh.rotation.y = yaw;
  }
}
