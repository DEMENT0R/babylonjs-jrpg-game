// Мост «геймпад → открытый модал»: scene-инпут и DOM-меню не смешиваются.
// Слушатели сами проверяют, открыты ли они; клавиатура продолжает работать
// через обычные keydown-обработчики.
import type { InputAction } from "../types";

const UI_ACTION_EVENT = "jrpg:ui-action";

/** Отправить действие открытому модалу (character select / диалог / меню / бой). */
export function emitUiAction(action: InputAction): void {
  window.dispatchEvent(new CustomEvent<InputAction>(UI_ACTION_EVENT, { detail: action }));
}

export function onUiAction(handler: (action: InputAction) => void): () => void {
  const listener = (event: Event): void => {
    handler((event as CustomEvent<InputAction>).detail);
  };
  window.addEventListener(UI_ACTION_EVENT, listener);
  return () => window.removeEventListener(UI_ACTION_EVENT, listener);
}
