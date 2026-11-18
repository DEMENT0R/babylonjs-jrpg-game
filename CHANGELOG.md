# Changelog

Формат: [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/), версии — [SemVer](https://semver.org/lang/ru/).

## [Unreleased]

### Добавлено
- 2026-11-19 — CI-workflow `.github/workflows/ci.yml`: на каждый push/PR —
  `npm ci`, eslint (`--max-warnings 0`), prettier `--check`, `tsc --noEmit`,
  vitest, `vite build`; деплой `.github/workflows/deploy.yml`: push в main →
  build → `upload-pages-artifact`/`deploy-pages` (GitHub Pages,
  concurrency-группа `pages`).
- 2026-11-19 — `world/locations/demo-room.ts`: референс-локация для DoD-1
  (сетка слайса 4: 20×20, стены 0.5, спавн-запас; мебель, демо-выход «в себя»,
  интеракция у кровати); `main.ts`: полный bootstrap — игрок-капсула, камера
  2.5D следует за игроком, ходьба с коллизиями через canMove, клавиша T
  переключает слот времени (morning/day/evening) со сменой света/палитры.
- 2026-11-19 — `core/solids.ts`: `SolidRegistry` + `canMove` — swept-кламп по осям
  (скольжение вдоль стен, нет туннелирования сквозь тонкие стены большим шагом);
  `core/scenes.ts`: реестр `registerLocation`/`getLocation` + `SceneManager`
  (build/update локации, движение игрока через canMove, интеракции, выходы,
  хук `isExitOpen` под интеграцию слайса 4); `core/phasedAssets.ts`: кэш
  материалов по ключу+фазе (палитры 0–3 для floor/wall/door/wood/metal/plastic/
  fabric/stone/glass/foliage/dirt), `setSlot` — свет/фон по слоту времени,
  low-poly билдеры `buildBox`/`buildSolidBox`; vitest-тесты solids/scenes.
- 2026-11-19 — `core/`: `engine.ts` (canvas + Engine/Scene + resize),
  `input.ts` (edge-детект `pressed`/`held`, раскладка WASD/стрелки + E/Enter +
  Esc + Shift, Backspace→cancel), `loop.ts` (game loop: poll → update → render,
  кламп dt), `time.ts` (чистый `advanceSlot` morning→day→evening→morning+день);
  vitest-тесты input/time.
- 2026-11-19 — Vite-скелет под GitHub Pages: `vite` 8.3.8 (devDependency),
  `vite.config.ts` с `base: "/babylonjs-jrpg-game/"`, `index.html` (canvas-хост,
  полноэкранные стили), точка входа `src/app/main.ts` (плейсхолдер до
  `feat(core)`-коммитов); скрипты `dev`/`build`/`preview`.
- 2026-11-19 — `lint`-скрипт ужесточён до `eslint . --max-warnings 0`
  (требование `docs/ARCHITECTURE.md` §6).
- 2026-11-19 — `src/state/persistence/migrations.ts`: механизм миграций версий
  сейва — реестр шагов `migrations` (сейчас пуст: v1 — текущая и единственная),
  `migrate()` принимает v1 как есть, гоняет цепочку шагов для старых версий,
  отвергает неизвестные/новее текущей; тест-доказательство цепочки идёт через
  временный реестр, не засоряя боевой (`tests/state/migrations.test.ts`).
- 2026-11-19 — `src/state/persistence/`: `IStorageProvider` (асинхронный — задел
  под HTTP-провайдер) и `LocalStorageProvider` (ключи `jrpg:save:<id>`, обёртка
  `{savedAt, data}` — время сохранения в `SaveV1` не входит, ошибки не глотаются);
  `exportSave`/`importSave` (строгая валидация схемы v1: лишние поля/типы/версия —
  понятные ошибки с путём); `stableJson` — детерминированный порядок ключей для
  побитово идентичного round-trip. Тесты `tests/state/persistence.test.ts` — на
  in-memory дубле DOM Storage (порядок тестов не влияет, дубль чистится в beforeEach).
- 2026-11-19 — `src/state/gamestate.ts`: `newGame(background, name)` — чистая
  функция стартового состояния по `SaveV1` (HP 20 / ресурс 10, статы 1/1/1/1,
  `apartment`, день 1, слот `morning`, фаза мира 0, пустые партия/инвентарь/
  квесты/флаги) и `SAVE_VERSION = 1`; навыки бэкграундов: `field-medicine`,
  `fast-learning`, `craft-without-bench` (`docs/NARRATIVE_BIBLE.md`, «Герои»).
- 2026-11-19 — `src/state/store.ts`: observable-стор без фреймворков по контракту
  `Store<S>` (`src/types.ts`): structural copy драфта, смена ссылки стейта на
  `update`, подписчик, добавленный во время нотификации, текущую волну не получает,
  вложенный `update` не рекурсит; vitest-покрытие `tests/state/store.test.ts`.
- 2026-11-19 — `src/world/layout.ts`: общая геометрия локаций — единая сетка 20×20 м
  (координаты −10..10), стены-периметр по `SolidBox` (один источник правды для
  коллизий: `perimeterSolids()` используют и `build()`, и `solidsOf()` локаций),
  точки дверей/спавнов по сторонам света, хелперы мешей-примитивов Babylon
  (пол/стены/боксы/цилиндры/двери/таблички) с материалами из `PhasedAssets`.
- 2026-11-19 — локации `apartment`, `campus`, `square` (`src/world/locations/`):
  LocationDef с exits/interacts по топологии из CONTRACTS.md (square — хаб),
  мебель-коллизии и меши-примитивы, 2–4 варианта вида на фазу через материалы
  (запасы/баррикады с Ф2, мусор/объявления с Ф1), табличка «закрыто на ремонт»
  у входа в метро (заглушка onConfirm — диалоги подключит слайс 5).
- 2026-11-19 — локации `hospital`, `pharmacy`, `workshop`, `metro-station`:
  палаты/койки с мерцанием лампы, аптека с полками-стеллажами «товара» по фазам
  (полные → пустые → разграблена), мастерская-крафт-хаб, станция метро
  (турникеты, путь, бомбоубежище с Ф2). hospital доступна только через campus.
- 2026-11-19 — `src/world/index.ts`: реестр локаций — `allLocations`,
  `getLocation(id)`, `solidsOf(id)` (декларативные коллизии) и
  `isExitOpen(from, to, phase)`/`LOCKED_EXITS`: вход в метро заблокирован
  в фазах 0–1 («закрыто на ремонт»), с фазы 2 — бомбоубежище. Менеджер сцен
  (core/) обязан проверять isExitOpen() перед переходом.
- 2026-11-19 — тесты `tests/world/` (vitest, 28): топология по CONTRACTS.md
  (смежность, двусторонность, хаб, hospital только через campus, блокировка
  метро), геометрия (периметр, границы, спавны/триггеры вне коллизий с запасом
  0.5 м), контракт реестра. Babylon в тестах не нужен — геометрия декларативна.
- 2026-11-19 — базовый скелет сборки: `package.json` (пины TypeScript 5.9.3,
  vitest 5.1.1, eslint 10.15.0, typescript-eslint 8.73.0, prettier 3.10.1,
  @babylonjs/core 9.37.1), `tsconfig.json` (strict), eslint/prettier-конфиги;
  `src/types.ts` — межслайсовые контракты (Store, Input, SaveV1/GameState,
  Location/SolidRegistry/PhasedAssets) как код, зеркало `docs/CONTRACTS.md`.
- 2026-11-18 — `docs/GAME_DESIGN.md`: концепция игры (современная реальность, 4 акта
  с деградацией мира через `worldPhase`, механики рутины/времени/пошагового боя).
- 2026-11-18 — `docs/ARCHITECTURE.md`: техплан (Vite+TS+Babylon.js, GitHub Pages,
  контракты `IStorageProvider`/`IContentProvider` под будущий бэк, milestones M0–M4,
  нарезка на 8 слайсов для субагентов).
- 2026-11-18 — `AGENTS.md`: правила для агентов, включая атомарность коммитов
  и обязанность дополнять этот ченджолог.
- 2026-11-18 — `README.md`: указатели на доки.
- 2026-11-18 — `docs/CONTENT_SCHEMAS.md`: контракты JSON-контента (Cond/Effect,
  DialogNode, Quest, Item, Enemy, NPC) и модель сейва v1 с миграциями.
- 2026-11-18 — `docs/NARRATIVE_BIBLE.md`: сеттинг (Старогорск), таймлайн фаз,
  3 бэкграунда героев, 7 локаций, НПС/партия, квесты акта 0 и границы v1.
- 2026-11-18 — `docs/CONTRACTS.md`: межслайсовые TS-контракты (Store, Input, Location),
  топология района со спавном и графом смежности, стартовый баланс боя v1.

### Изменено
- 2026-11-18 — `docs/ARCHITECTURE.md`: ссылки на схемы/нарративную библию, правило
  триггера `worldPhase` (только `setWorldPhase` из контента), CI/деплой/тесты (vitest),
  DoD для 8 слайсов; `docs/GAME_DESIGN.md`: не-цели v1 синхронизированы (акты 0–1
  плюс вход в акт 2).
- 2026-11-18 — `README.md`: ссылки на схемы контента и нарративную библию.
- 2026-11-18 — `docs/CONTENT_SCHEMAS.md`: типы `Background`/`Skill` для старта героя;
  уточнена семантика `timeWindow` (относительно дня взятия, провал на первом
  `advanceTime` за окном).
- 2026-11-18 — `docs/NARRATIVE_BIBLE.md`: политика ассетов v1 — примитивы-плейсхолдеры
  до M4, внешние паки только после среза.
- 2026-11-18 — `docs/ARCHITECTURE.md`: §8 «Workflow субагентов» — ветки
  `slice/<n>-<slug>`, PR-мерж по зависимостям, operational-чеклист Pages/Actions;
  риски перенумерованы в §9.
- 2026-11-18 — `README.md`: ссылка на межслайсовые контракты.

### Исправлено
- 2026-11-19 — `core/solids.ts`: `canMove` клампил и грани ПОЗАДИ хода
  (стена за спиной останавливала движение); теперь клампится только грань
  между goal и start — регресс-тест «стена позади не мешает».
- 2026-11-19 — `core/input.ts`: keyup снимал pressed — тап короче кадра
  терялся; теперь edge живёт до ближайшего endFrame (регресс-тест).
- 2026-11-18 — `AGENTS.md`: удалена случайная служебная строка «]», попавшая в файл
  при правке.
