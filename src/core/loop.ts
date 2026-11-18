import type { Engine, Scene } from "@babylonjs/core";

/** Предохранитель от скачка dt (таб в фоне): шаг физики/движения не длиннее. */
export const MAX_FRAME_DT = 0.05;

/** Игровой цикл: poll инпута (в onUpdate) → рендер; edge-инпут гасится в конце кадра. */
export function startGameLoop(
  engine: Engine,
  scene: Scene,
  input: { endFrame(): void },
  onUpdate: (dt: number) => void,
): () => void {
  engine.runRenderLoop(() => {
    onUpdate(Math.min(engine.getDeltaTime() / 1000, MAX_FRAME_DT));
    scene.render();
    input.endFrame();
  });
  return () => {
    engine.stopRenderLoop();
  };
}
