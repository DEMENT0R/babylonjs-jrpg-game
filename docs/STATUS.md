# Статус слайсов (обновляется каждым агентом)

Легенда: ✅ готово и покрыто тестами · 🟡 в работе · ⬜ не начато · 🧊 заблокировано зависимостью.
Актуально на 2026-11-19, 15:40.

| # | Слайс | Ветка | Статус | Что готово / что дальше |
|---|---|---|---|---|
| 1 | Инфраструктура | `slice/1-infra` | ✅ | Vite+Babylon, `core/` (engine/input/loop/time/scenes/solids/phasedAssets), deploy GH Pages, CI |
| 2 | State+persistence | `slice/2-state` | ✅ | Store, `newGame`, localStorage-провайдер, export/import (stable JSON), миграции |
| 4 | Мир | `slice/4-world` | ✅ | 7 локаций × worldPhase, коллизии, топология, `isExitOpen` (метро 0–1) |
| 3 | Системы рутины | — | ✅ | `content/` (типы+IContentProvider+Bundled+валидатор), `systems/` (cond/effect/dialog/quest/inventory/stats/время/encounters), сейв v2; 156 тестов |
| 6 | Бой | — | ✅ | чистый движок 1×1, «Предмет» в бою (список расходников, списание из сейва), `battleScreen`, 14 тестов; интеграция: клавиша B / `__jrpg.fight` |
| 7 | Контент акта 0–1 | — | ✅ | 3 бэкграунда, 6 НПС, 5 квестов, 75 диалогов, 10 предметов, 2 врага; валидатор в тестах |
| 5 | UI | — | ✅ | HUD, диалогбокс (настраиваемая скорость текста), главное меню с вкладками Статус/Инвентарь/Квесты/Крафт/Карта/Настройки/Система (3 слота, export/import); настройки вне сейва (localStorage); проверено в браузере |
| 8 | Сборка среза | — | ✅ | акт 0 → фаза 1 → бой у склада → фаза 2: сквозной тест `tests/e2e/act0-walkthrough.test.ts` зелёный; сон/переждать в квартире доводят до дня 3; браузерный смоук (импорт сейва у склада → бой) пройден |
| 9 | Контейнеры | — | ✅ | `containers.json` (5: мастерская/аптека/больница/квартира/метро), `systems/containers.ts` (фаза/условия/замок/ролл лута, флаг `container:<id>:opened`, сейв не менялся), маркеры+тост+confirm в app, валидатор, 6 тестов |

## Изменения контрактов
- **2026-11-19, сейв v2** (слайс 3): `hero.level`, `hero.xp`, `hero.skillPoints`,
  `questStates[id].startedDay` — без `startedDay` окно квеста (`timeWindow`) не
  отсчитывается от дня взятия, как требует `CONTENT_SCHEMAS.md`; XP/очки нужны бою.
  Старые сейвы v1 поднимает миграция `migrations[1]`. Доки обновлены тем же коммитом.

- **2026-11-19, encounter-контент**: `content/data/encounters.json` + `systems/encounters.ts`
  — стычка при входе в локацию, исход боя через `onWinEffects`/`onLoseEffects`;
  `Cond.type: "day"` — гейт по номеру дня. Сейв не менялся (состояние — во флагах
  `encounter:<id>:done`).
- **2026-11-19, UpdateCtx.content**: локации получают `IContentProvider` для
  интеракций, двигающих время (`advanceTime` проваливает окна квестов). Сон в
  квартире — до следующего утра, стол — до вечера.

- **2026-11-20, container-контент**: `content/data/containers.json` +
  `systems/containers.ts` — осматриваемые контейнеры в локациях: лут
  (`{item, qty, chance}` = словарь `Enemy.loot`), фазовый гейт `phases`,
  `conditions`, замок `locked {skill, dc, tool?}`, `onOpenEffects` (флаги
  «кражи»). Одноразовость — флаг `container:<id>:opened`; сейв не менялся.
  Провайдер: `getContainer`/`containersAt`; валидатор проверяет поля,
  ссылки и дубли id (заодно закрыл пропуск дублей у encounters).

## Известные ограничения
- Рендер/UI не покрыты автотестами: проверка руками по DoD (см. `ARCHITECTURE.md` §7).
- Валидатор контента (`scripts/validate-content.ts`) входит в слайс 7; до него CI
  проверяет только типы/тесты.
