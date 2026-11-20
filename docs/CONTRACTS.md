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
- Игровое состояние — `SaveV2` (см. `CONTENT_SCHEMAS.md`): `store.get()`
  сериализуется в сейв без адаптера. Несейв-поля (например, «диалог открыт») — второй,
  ephemeral-`Store`, в сейв не идущий.
- Межсистемная связь — только через store (subscribe/update). Событийных эмиттеров нет.
  Исключение — инпут (ниже).

## Системы (`systems/*`, владелец слайс 3; потребители 5, 6, 7)
```ts
// dialog.ts
interface DialogView { node: DialogNode; choices: { index: number; text: string }[]; next: string | null }
openDialog(content, state, nodeId): DialogView
chooseDialog(content, node, choiceIndex, draft): string | null   // применяет эффекты выбора
npcDialogId(content, npcId, phase): string | undefined

// effects.ts
applyEffects(effects, draft, content): void   // внутри store.update
advanceTime(draft, content, slots): void      // двигает слоты и проваливает окна квестов

// containers.ts
containerOpenedFlag(id): string                          // container:<id>:opened
findContainerAt(content, state, x, z): Container | undefined  // видимый и не открытый под точкой
canOpenContainer(container, state): boolean               // замок: stat >= dc и tool в инвентаре
containerHint(container, state, content): string         // подпись подсказки: «осмотреть» / «заперто — …»
openContainer(content, container, draft, rng?): {item, qty}[]  // лут + onOpenEffects + флаг; rng injectable

// quest.ts / inventory.ts / stats.ts — чистые хелперы над драфтом GameState
```
- UI никогда не мутирует сейв сам: только `store.update(draft => …)` с этими функциями.
- Контент — только через `IContentProvider` (`src/content/index.ts`); `loadBundledContent()`
  читает `src/content/data/*.json`. Валидатор — `validateContent` (тест в CI).

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
Touch (`ui/touchControls.ts`) и геймпад (`core/gamepad.ts`) пишут в тот же `InputState`
через `setAction(action, down)`/`setStick(x, y)`: сцена не знает об источнике.
Геймпад: A/Cross/X/Y — confirm, B/Circle — cancel, Start/Back — menu, LB/RB/LT/RT — run,
DPad/левый стик — движение. Для открытых модалов edge-действия геймпада идут через
`core/uiActions.ts` (`jrpg:ui-action`), чтобы не смешиваться с игровым инпутом.

## Location (`core/scenes.ts` + `world/`, владельцы 1 и 4)
```ts
interface LocationDef {
  id: string;                            // "apartment", "square", ...
  build(ctx: BuildCtx): void;           // меши/коллизии, один раз на вход
  update(ctx: UpdateCtx): void;         // каждый кадр
  exits: ExitDef[];
  interacts: InteractDef[];
  firstVisitText?: string;                // одноразовая подпись при первом входе
                                         // (тост ui/lootToast.ts, флаг visited-<id> в сейве)
}
interface ExitDef {
  to: string;                           // id целевой локации
  at: { x: number; z: number; r: number };   // точка-триггер в этой локации
  spawn: { x: number; z: number; yaw?: number }; // где появиться в целевой
  label: string;
}
interface InteractDef { at: { x: number; z: number; r: number }; label?: string;
                       onConfirm(ctx: UpdateCtx): void } // label — подпись для подсказки в фокусе (E), опционально
interface BuildCtx  { scene: Scene; worldPhase: number; assets: PhasedAssets; solids: SolidRegistry }
interface UpdateCtx { scene: Scene; dt: number; input: Input; store: Store<GameState>;
                     content: IContentProvider } // интеракции могут двигать время с провалом окон квестов
```
- `SolidRegistry` (стены/AABB) и `PhasedAssets` (одна геометрия → перекраска по фазе) —
  реализует слайс 1 в `core/`; `world/locations/*` только потребляет. Минимальный API
  зафиксирован (расширять можно, менять — отдельным коммитом):
  ```ts
  interface SolidBox { x: number; z: number; w: number; d: number } // центр + полные размеры
  interface SolidRegistry { add(box: SolidBox): void }
  interface PhasedAssets { material(key: string, phase: number): Material } // Babylon Material
  ```
- Все межслайсовые типы из этой доки объявлены в `src/types.ts` — единственном общем
  модуле; слайсы не дублируют их и не правят друг у друга файлы.

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

## Баланс боя v2 (владельцы слайсов 6 и 7; числа правятся только их коммитом)
- Герой (фаза 1): HP 20, ресурс 10; `atk` действия = базовое 2 + `floor(навык / 2)`.
- Предметы в бою: расходники с hp-эффектом лечат на фиксированную `delta` эффекта
  (без medicine); каталог `HeroInput.usableItems` собирает app из контента,
  `CombatAction = { type: "item"; item }`. Потраченное в бою списывается из сейва.
- Хулиган: HP 10, atk 3, def 0, spd 5, XP 4. Мародёр «Клещ»: HP 16, atk 4, def 1, XP 8.
- Союзники (`companions.json`, id = npc-id): Борис hp 12 / atk 2 / heal 6,
  Дима hp 14 / atk 3 / heal 0, Люда hp 8 / atk 1 / heal 3. Порядок хода: герой
  (управление) → союзники по порядку партии (лечат героя, потерявшего больше
  половины maxHp, иначе бьют; урон по той же формуле) → враг.
- Цель врага: равновероятно герой или живой союзник (`rng` движка; без союзников —
  герой). Союзник с 0 HP выбывает из боя и не возрождается; HP союзников эфемерно,
  в сейв не пишется. Поражение — только 0 HP героя.
- `HeroInput.allies` собирает `app/main.ts` из `state.party` через
  `content.getCompanion(npcId)`; валидатор гарантирует профиль каждому `joinParty`.
