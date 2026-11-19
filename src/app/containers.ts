// Маркеры контейнеров в сцене: небольшой куб на точке интеракции, пока контейнер
// виден и не открыт (плейсхолдер, как капсулы НПС; мебель локации уже отрисована
// в build()). Пересобирается только при смене набора видимых контейнеров.
import {
  Color3,
  MeshBuilder,
  StandardMaterial,
  Vector3,
  type Mesh,
  type Scene,
} from "@babylonjs/core";
import type { IContentProvider } from "../content";
import { containerOpenedFlag, isContainerVisible } from "../systems/containers";
import type { GameState } from "../types";

const MARKER_COLOR = "#d9b36a";

export interface ContainerPresenter {
  /** Синхронизация под текущее состояние; повторный вызов без изменений — no-op. */
  sync(state: GameState): void;
  dispose(): void;
}

export function createContainerPresenter(
  scene: Scene,
  content: IContentProvider,
): ContainerPresenter {
  const meshes = new Map<string, Mesh>();
  let current = "";

  const disposeAll = () => {
    for (const mesh of meshes.values()) mesh.dispose();
    meshes.clear();
  };

  return {
    sync(state) {
      const open = content
        .containersAt(state.location)
        .filter(
          (container) =>
            isContainerVisible(container, state) &&
            state.flags[containerOpenedFlag(container.id)] !== true,
        );
      const key = `${state.location}@${state.worldPhase}:${open.map((c) => c.id).join(",")}`;
      if (key === current) return;
      current = key;
      disposeAll();
      for (const container of open) {
        const mesh = MeshBuilder.CreateBox(
          `container:${container.id}`,
          { width: 0.45, height: 0.45, depth: 0.45 },
          scene,
        );
        mesh.position = new Vector3(container.at.x, 0.9, container.at.z);
        const mat = new StandardMaterial(`containerMat:${container.id}`, scene);
        mat.diffuseColor = Color3.FromHexString(MARKER_COLOR);
        mat.specularColor = new Color3(0.05, 0.05, 0.05);
        mesh.material = mat;
        meshes.set(container.id, mesh);
      }
    },
    dispose() {
      disposeAll();
      current = "";
    },
  };
}
