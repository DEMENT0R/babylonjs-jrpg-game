import { createGameEngine } from "../core/engine";
import { attachKeyboard, createInputState } from "../core/input";
import { startGameLoop } from "../core/loop";

const { engine, scene } = createGameEngine();
const input = createInputState();
attachKeyboard(input);

// Локации/игрок подключаются следующими коммитами слайса 1.
startGameLoop(engine, scene, input, () => {});
