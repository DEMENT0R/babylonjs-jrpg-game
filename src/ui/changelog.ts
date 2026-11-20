// Ченджлог внутри игры: CHANGELOG.md импортируется в бандл (?raw) и
// показывается прокручиваемым текстом. Открывается с титульного экрана
// (поверх него) и из вкладки «Система» меню паузы (меню закрывается).
// Пока открыт, ввод сцены блокируется (main.ts: modalOpen).
import changelogText from "../../CHANGELOG.md?raw";
import { onUiAction } from "../core/uiActions";
import "./changelog.css";

export interface ChangelogViewer {
  open(): void;
  close(): void;
  isOpen(): boolean;
  dispose(): void;
}

export function createChangelogViewer(): ChangelogViewer {
  const root = document.createElement("div");
  root.className = "ch-root";
  root.hidden = true;

  const panel = document.createElement("div");
  panel.className = "ch-panel";
  const title = document.createElement("h2");
  title.className = "ch-title";
  title.textContent = "Список изменений";
  const text = document.createElement("pre");
  text.className = "ch-text";
  text.textContent = changelogText;
  const close = document.createElement("button");
  close.type = "button";
  close.className = "ch-close";
  close.textContent = "Закрыть";
  const hint = document.createElement("p");
  hint.className = "ch-hint";
  hint.textContent = "Esc / B — закрыть";
  close.addEventListener("click", () => closeViewer());
  panel.append(title, text, close, hint);
  root.append(panel);
  document.body.append(root);

  let closed = true;

  const onKey = (event: KeyboardEvent) => {
    if (closed) return;
    if (event.code === "Escape" || event.code === "Enter" || event.code === "KeyE") {
      closeViewer();
      event.preventDefault();
      event.stopPropagation();
    }
  };
  window.addEventListener("keydown", onKey, true);
  const offUiAction = onUiAction((action) => {
    if (closed) return;
    if (action === "cancel" || action === "confirm") closeViewer();
  });

  function closeViewer(): void {
    closed = true;
    root.hidden = true;
  }

  return {
    open() {
      closed = false;
      root.hidden = false;
      text.scrollTop = 0;
    },
    close: closeViewer,
    isOpen: () => !closed,
    dispose() {
      offUiAction();
      window.removeEventListener("keydown", onKey, true);
      root.remove();
    },
  };
}
