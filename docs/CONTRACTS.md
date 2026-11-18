# Контракты между слайсами (TS-сигнатуры, фиксируются ДО старта слайсов)

Минимальные интерфейсы, которые пишут **разные** агенты параллельно. Расширять можно
свободно; менять сигнатуру — только отдельным коммитом с правкой этой доки. Всё, что
не описано здесь, — решение владельца слайса, не предмет этой доки.

## Store (`state/store.ts`, владелец слайс 2; потребители 3, 5, 6)
```ts
interface Store<S> {
  get(): S;                                  // снимок, только чтение
  update(fn: (draft: S) => void): void;      // мутация + уведомление подписчиков
  subscribe(fn: (s: S) => void): () => void; // возвращает отписку
}
```
- Игровое состояние — `SaveV1`-совместимое (см. `CONTENT_SCHEMAS.md`): `store.get()`
  сериализуется в сейв без адаптера. Несейв-поля (например, «диалог открыт») — второй,
  ephemeral-`Store`, в сейв не идущий.
- Межсистемная связь — только через store (subscribe/update). Событийных эмиттеров нет.
  Исключение — инпут (ниже).

## Input (`core/input.ts`, владелец слайс 1; потребители 4, 5)
```ts
type InputAction = "up" | "down" | "left" | "right"
                 | "confirm" | "cancel" | "menu" | "run";
interface Input {
  axis(): { x: number; y: number }; // -1..1, актуально на кадр
  pressed(a: InputAction): boolean; // true только в кадр нажатия
  held(a: InputAction): boolean;
}
```
Раскладка: WASD/стрелки — движение, `E`/`Enter` — confirm, `Esc` — menu, `Shift` — run.
HTML-меню (слайс 5) инпут не проходят — обычные DOM-события.

## Location (`core/scenes.ts` + `world/`, владельцы 1 и 4)
```ts
interface LocationDef {
  id: string;                            // "apartment", "square", ...
  build(ctx: BuildCtx): void;           // меши/коллизии, один раз на вход
  update(ctx: UpdateCtx): void;         // каждый кадр
  exits: ExitDef[];
  interacts: InteractDef[];
}
interface ExitDef {
  to: string;                           // id целевой локации
  at: { x: number; z: number; r: number };   // точка-триггер в этой локации
  spawn: { x: number; z: number; yaw?: number }; // где появиться в целевой
  label: string;
}
interface InteractDef { at: { x: number; z: number; r: number }; onConfirm(ctx: UpdateCtx): void }
interface BuildCtx  { scene: Scene; worldPhase: number; assets: PhasedAssets; solids: SolidRegistry }
interface UpdateCtx { scene: Scene; dt: number; input: Input; store: Store<GameState> }
```
- `SolidRegistry` (стены/AABB) и `PhasedAssets` (одна геометрия → перекраска по фазе) —
  реализует слайс 1; `world/locations/*` только потребляет.
- Открытие диалога из `InteractDef.onConfirm` — через ephemeral-стор, рисует слайс 5.

## Топология района (владелец слайс 4)
```
            apartment
                │
 hospital ── campus ── square ── pharmacy
                         │      ── workshop
                  metro-station (фазы 0–1: вход блокирован, «закрыто на ремонт»)
```
- `square` — хаб; возврат из любой локации — в точку входа хаба.
- Спавн новой игры: `apartment`, день 1, слот `morning`.
- `hospital` доступен только через `campus` (пропуск-диспозиция интерьера).

## Баланс боя v1 (владельцы слайсов 6 и 7; числа правятся только их коммитом)
- Герой (фаза 1): HP 20, ресурс 10; `atk` действия = базовое 2 + `floor(навык / 2)`.
- Урон: `max(1, atk - def)`. Хил аптечки: `6 + medicine`. Побег: `70% + stealth * 5%`.
- Хулиган: HP 10, atk 3, def 0, spd 5, XP 4. Мародёр «Клещ»: HP 16, atk 4, def 1, XP 8.
- Левел-ап: +2 HP, +1 очко навыка; порог XP = `8 * level`.
- Стартовые числа; финальный баланс — одним коммитом вместе с `enemies/*.json`.
