# Changelog

Формат: [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/), версии — [SemVer](https://semver.org/lang/ru/).

## [Unreleased]

### Добавлено
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
- 2026-11-18 — `AGENTS.md`: удалена случайная служебная строка «]», попавшая в файл
  при правке.
