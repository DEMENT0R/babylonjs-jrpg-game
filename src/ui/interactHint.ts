// Подпись интеракции в фокусе: HTML-плашка «[E] говорить: Борис» внизу экрана.
// Показывается только вблизи (радиус самого действия) — без 3D-анкеров над
// головами. DOM мутируется лишь при смене текста/кнопки; мышь не перехватывает.
import "./ui.css";

export interface InteractHint {
  /** Показать/обновить подпись; повторный вызов с тем же текстом — no-op. */
  show(text: string): void;
  hide(): void;
  dispose(): void;
}

export interface InteractHintOptions {
  /** Кнопка подтверждения в бейдже (E — клавиатура, ◆ — тач-панель). Читается на каждый show. */
  keyLabel?: () => string;
  host?: HTMLElement;
}

/** Скрытая плашка у нижней кромки; открывается show(), закрывается hide(). */
export function createInteractHint(opts: InteractHintOptions = {}): InteractHint {
  const root = document.createElement("div");
  root.className = "ui-interact-hint";

  const keyEl = document.createElement("span");
  keyEl.className = "ui-interact-hint__key";
  const textEl = document.createElement("span");
  textEl.className = "ui-interact-hint__text";
  root.append(keyEl, textEl);
  (opts.host ?? document.body).append(root);

  let open = false;
  let text = "";
  let key = "";

  return {
    show(next) {
      const nextKey = opts.keyLabel?.() ?? "E";
      if (open && text === next && key === nextKey) return;
      open = true;
      text = next;
      key = nextKey;
      keyEl.textContent = nextKey;
      textEl.textContent = next;
      root.classList.add("ui-interact-hint--open");
    },
    hide() {
      if (!open) return;
      open = false;
      text = "";
      root.classList.remove("ui-interact-hint--open");
    },
    dispose() {
      root.remove();
    },
  };
}
