import { Color4 } from "@babylonjs/core/Maths/math.color";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";

export interface GameEngine {
  engine: Engine;
  scene: Scene;
  canvas: HTMLCanvasElement;
  dispose(): void;
}

/** Canvas + Babylon Engine/Scene; resize слушается на window. */
export function createGameEngine(hostSelector = "#app"): GameEngine {
  const host = document.querySelector(hostSelector) ?? document.body;
  const canvas = document.createElement("canvas");
  host.appendChild(canvas);
  const engine = new Engine(canvas, true, { adaptToDeviceRatio: true });
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.06, 0.06, 0.09, 1);
  const onResize = (): void => {
    engine.resize();
  };
  window.addEventListener("resize", onResize);
  return {
    engine,
    scene,
    canvas,
    dispose() {
      window.removeEventListener("resize", onResize);
      scene.dispose();
      engine.dispose();
      canvas.remove();
    },
  };
}
