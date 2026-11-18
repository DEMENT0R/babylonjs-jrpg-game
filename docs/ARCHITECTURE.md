# Технический план (Babylon.js, GitHub Pages first)

## 1. Стек
- **Vite + TypeScript** — сборка, деплой `dist/` на GitHub Pages (gh-pages / Actions).
- **Babylon.js** — рендер. Ранний выбор стиля: **low-poly 3D, вид сверху-под-углом (2.5D)**,
  ассеты — примитивы/бесплатные Kenney-паки. Без физики, без navmesh-библиотек (свои
  простые коллизии на сетке/AABB).
- UI — Babylon GUI (для HUD/диалогов) + HTML-оверлей для меню (проще стилизовать).

## 2. Архитектурные слои (важно для будущих субагентов)
```
src/
  core/        engine.ts (bootstrap Babylon), scenes.ts (SceneDef switch), loop.ts, time.ts (слоты времени)
  state/       gamestate.ts (save-модель), store.ts (observable-стор без фреймворков),
               persistence/ IStorageProvider -> LocalStorageProvider (GH Pages),
                          + экспорт/импорт JSON-файлом
  content/     IContentProvider -> BundledContentProvider (JSON в репо)
               dialogs/*.json  quests/*.json  items/*.json  enemies/*.json  npcs/*.json
  systems/     dialog.ts, quest.ts, inventory.ts, crafting.ts, combat.ts (turn-based движок),
               stats.ts (прокачка через использование)
  world/       locations/*.ts (каждая локация = 3 варианта по worldPhase), phasedAssets.ts
  ui/          hud.ts, dialogBox.ts, menu.ts (HTML), battleScreen.ts
  app/         main.ts, saveMenu.ts, characterSelect.ts
```

### Контракт под будущий бэк (заложить СЕЙЧАС, реализовать потом)
Два интерфейса — единственные точки будущей миграции:
- `IStorageProvider`: `load/save/listSlots` — сейчас localStorage; потом HTTP-провайдер
  (JWT + `POST /saves`). Модель сейва — версионированный JSON (`saveVersion`).
- `IContentProvider`: `getDialog(id)/getQuest(id)/...` — сейчас импорт JSON из бандла;
  потом тот же формат катится с сервера без изменения систем.
Запрещено системам ходить в `localStorage`/`fetch` напрямую — только через провайдеры.

## 3. Ключевые решения
- **Data-driven контент**: весь нарратив — JSON-файлы в `src/content/`, редактируемые
  непрограммистом и субагентами параллельно без конфликтов в коде.
- **worldPhase** — единственный флаг, управляющий состоянием мира; локации/диалоги/враги
  читают его. Никаких рассинхронизированных «глобальных» триггеров.
- **Детерминированный бой**: весь бой — чистая функция от (состояние, действия) → новое
  состояние; Babylon только рисует. Это упрощает тесты и будущий серверный валидатор.
- **Сейвы**: только сериализуемые данные (стат, флаги квестов, worldPhase, позиции),
  никакого живого состояния движка.

## 4. Дорожная карта (milestones)
- **M0** — bootstrap Vite+Babylon на GH Pages, квартира-героя: ходьба, коллизии, слот времени.
- **M1** — диалоги (JSON), 2 квеста рутины, инвентарь-минимум, сейвы (localStorage+export).
- **M2** — character select, статы/прокачка, полный день рутины (акт 0 целиком).
- **M3** — combat-модуль (стендэлон-тест) + первый бой, переход акта 0→1, смена вида локации.
- **M4** — акт 1: крафт, партия из 2 НПС, дилеммы; вертикальный срез готов.

## 5. Нарезка для субагентов (v1, порядок = зависимости)
| # | Слайс | Артефакты | Зависит от |
|---|---|---|---|
| 1 | Инфраструктура: Vite+TS+Babylon скелет, deploy на GH Pages, `core/` | runnable page | — |
| 2 | State+пersistence: store, save-модель, LocalStorageProvider, export/import | `state/` + демо-сейв | — |
| 3 | Системы рутины: dialog/quest/time/stats/inventory на JSON-контрактах | `systems/`, `IContentProvider` | 1, 2 |
| 4 | Мир: 6–8 локаций x worldPhase, коллизии, входы/переходы | `world/` | 1 |
| 5 | UI: HUD (время/ресурс), диалогбокс, меню (HTML) | `ui/` | 3, 4 |
| 6 | Бой: turn-based движок (чистая логика + отдельный экран), враги v0 | `systems/combat`, `ui/battleScreen` | 3 |
| 7 | Контент акта 0–1: диалоги/квесты/предметы JSON по GDD, 3 бэкграунда героя | `content/` | 3, 4, 5 |
| 8 | Сборка среза: character select → акт 0 → переход → акт 1, end-to-end | `app/` | все |

Слайсы 2 и 4 стартуют параллельно с 1 (интерфейсы зафиксировать заранее в этой доке);
контент (7) пишется последними JSON-ами параллельно с 5–6.

## 6. Риски
- **Объём ассетов** — главный риск. Смягчение: low-poly примитивы, переиспользование
  одной геометрии с перекраской по фазе вместо трёх наборов моделей.
- **Разрастание боёвки** — ограничить v1 шестью действиями на бойца, без стихий/экипировки-сетов.
- **GH Pages лимиты** — бандл Babylon тяжёлый; настроить code-splitting/CDN-импорт сразу в M0.
