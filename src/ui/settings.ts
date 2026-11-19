// Настройки вне сейва: localStorage под отдельными ключами, сейв-модель
// не трогаем (docs/CONTRACTS.md, «Store»). Ключи заданы здесь единожды —
// их читают и boot (`app/main.ts`), и меню (`ui/menu.ts`).
const TEXT_SPEED_KEY = "jrpg:text-speed";
const TOUCH_KEY = "jrpg:touch";

export interface TextSpeedStep {
  /** Задержка печати символа диалога, мс; 0 — печатать сразу. */
  ms: number;
  label: string;
}

/** Шаги скорости текста диалога; первый — значение по умолчанию. */
export const TEXT_SPEED_STEPS: readonly TextSpeedStep[] = [
  { ms: 30, label: "Обычно" },
  { ms: 12, label: "Быстро" },
  { ms: 0, label: "Сразу" },
];

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null; // приватный режим и т.п. — настройки просто не сохраняются
  }
}

export function readTextSpeed(): number {
  const raw = storage()?.getItem(TEXT_SPEED_KEY);
  if (raw === null) return TEXT_SPEED_STEPS[0]!.ms;
  const value = Number(raw);
  return TEXT_SPEED_STEPS.some((step) => step.ms === value) ? value : TEXT_SPEED_STEPS[0]!.ms;
}

export function writeTextSpeed(ms: number): void {
  try {
    storage()?.setItem(TEXT_SPEED_KEY, String(ms));
  } catch {
    // приватный режим: значение живёт до перезагрузки
  }
}

/** Сохранённый выбор тач-панели; null — решения нет, берём auto-detect. */
export function readTouchSetting(): boolean | null {
  const raw = storage()?.getItem(TOUCH_KEY);
  return raw === "1" ? true : raw === "0" ? false : null;
}

export function writeTouchSetting(on: boolean): void {
  try {
    storage()?.setItem(TOUCH_KEY, on ? "1" : "0");
  } catch {
    // приватный режим: значение живёт до перезагрузки
  }
}
