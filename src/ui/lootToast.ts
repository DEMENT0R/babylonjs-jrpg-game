// Тост найденного лута: короткая плашка над зоной диалога, авто-скрытие.
// Мышь не перехватывает; DOM мутируется только по show().
import "./ui.css";

export interface LootToast {
  show(text: string): void;
  dispose(): void;
}

const VISIBLE_MS = 2600;

export function createLootToast(host: HTMLElement = document.body): LootToast {
  const root = document.createElement("div");
  root.className = "ui-loot-toast";
  host.append(root);
  let timer: number | undefined;

  return {
    show(text) {
      root.textContent = text;
      root.classList.add("ui-loot-toast--open");
      clearTimeout(timer);
      timer = window.setTimeout(() => {
        timer = undefined;
        root.classList.remove("ui-loot-toast--open");
      }, VISIBLE_MS);
    },
    dispose() {
      clearTimeout(timer);
      root.remove();
    },
  };
}
