# Статус слайсов (обновляется каждым агентом)

Легенда: ✅ готово и покрыто тестами · 🟡 в работе · ⬜ не начато · 🧊 заблокировано зависимостью.
Актуально на 2026-11-19.

| # | Слайс | Ветка | Статус | Что готово / что дальше |
|---|---|---|---|---|
| 1 | Инфраструктура | `slice/1-infra` | ✅ | Vite+Babylon, `core/` (engine/input/loop/time/scenes/solids/phasedAssets), deploy GH Pages, CI |
| 2 | State+persistence | `slice/2-state` | ✅ | Store, `newGame`, localStorage-провайдер, export/import (stable JSON), миграции |
| 4 | Мир | `slice/4-world` | ✅ | 7 локаций × worldPhase, коллизии, топология, `isExitOpen` (метро 0–1) |
| 3 | Системы рутины | — | 🟡 | в работе: `content/` (типы+IContentProvider+Bundled), `systems/` (cond/effect/dialog/quest/inventory/stats/время), сейв v2 |
| 6 | Бой | — | 🟡 | параллельно: чистая логика 1×1 + тесты |
| 7 | Контент акта 0–1 | — | 🟡 | параллельно: JSON диалогов/квестов/предметов/врагов/НПС, валидатор |
| 5 | UI | — | 🟡 | параллельно: HUD, диалогбокс, меню паузы (HTML-оверлей) |
| 8 | Сборка среза | — | ⬜ | после 3/5/6/7: character select → акт 0 → кризис, e2e-проверка |

## Изменения контрактов
- **2026-11-19, сейв v2** (слайс 3): `hero.level`, `hero.xp`, `hero.skillPoints`,
  `questStates[id].startedDay` — без `startedDay` окно квеста (`timeWindow`) не
  отсчитывается от дня взятия, как требует `CONTENT_SCHEMAS.md`; XP/очки нужны бою.
  Старые сейвы v1 поднимает миграция `migrations[1]`. Доки обновлены тем же коммитом.

## Известные ограничения
- Рендер/UI не покрыты автотестами: проверка руками по DoD (см. `ARCHITECTURE.md` §7).
- Валидатор контента (`scripts/validate-content.ts`) входит в слайс 7; до него CI
  проверяет только типы/тесты.
