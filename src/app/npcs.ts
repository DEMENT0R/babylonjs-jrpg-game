// НПС в сцене: капсулы-плейсхолдеры по контенту (docs/NARRATIVE_BIBLE.md, «Ассеты»).
// Позиции — world/npcs.ts; видимость — npcsAt(location, worldPhase).
import {
  Color3,
  MeshBuilder,
  StandardMaterial,
  Vector3,
  type Mesh,
  type Scene,
} from "@babylonjs/core";
import type { IContentProvider } from "../content";
import { npcSpot } from "../world/npcs";

const ROLE_COLORS: Record<string, string> = {
  boris: "#7f9fbf",
  luda: "#b58f6a",
  dima: "#6a9f7f",
  zina: "#b06a8f",
  sergey: "#7f7f8f",
};
const DEFAULT_COLOR = "#9a9a7a";

export interface NpcPresenter {
  /** Пересобирает НПС под локацию/фазу; повторный вызов с теми же аргументами — no-op. */
  sync(location: string, phase: number): void;
  /** id ближайшего НПС в радиусе (для интеракции confirm). */
  nearest(x: number, z: number, radius: number): string | undefined;
  /** Меш НПС по id (для позиционирования/подсветки). */
  meshOf(npcId: string): Mesh | undefined;
  dispose(): void;
}

export function createNpcPresenter(scene: Scene, content: IContentProvider): NpcPresenter {
  const meshes = new Map<string, Mesh>();
  let current = "";

  const disposeAll = () => {
    for (const mesh of meshes.values()) mesh.dispose();
    meshes.clear();
  };

  return {
    sync(location, phase) {
      const key = `${location}@${phase}`;
      if (key === current) return;
      current = key;
      disposeAll();
      content.npcsAt(location, phase).forEach((npc, index) => {
        const spot = npcSpot(location, index);
        if (!spot) throw new Error(`НПС "${npc.id}": нет площадки в локации "${location}"`);
        const mesh = MeshBuilder.CreateCapsule(
          `npc:${npc.id}`,
          { radius: 0.32, height: 1.3 },
          scene,
        );
        mesh.position = new Vector3(spot.x, 0.65, spot.z);
        const mat = new StandardMaterial(`npcMat:${npc.id}`, scene);
        mat.diffuseColor = Color3.FromHexString(ROLE_COLORS[npc.id] ?? DEFAULT_COLOR);
        mat.specularColor = new Color3(0.05, 0.05, 0.05);
        mesh.material = mat;
        meshes.set(npc.id, mesh);
      });
    },
    nearest(x, z, radius) {
      let best: { id: string; d2: number } | undefined;
      for (const [id, mesh] of meshes) {
        const d2 = (mesh.position.x - x) ** 2 + (mesh.position.z - z) ** 2;
        if (d2 <= radius ** 2 && (!best || d2 < best.d2)) best = { id, d2 };
      }
      return best?.id;
    },
    meshOf: (npcId) => meshes.get(npcId),
    dispose() {
      disposeAll();
      current = "";
    },
  };
}
