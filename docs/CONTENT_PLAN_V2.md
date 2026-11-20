# Контент-план v2: полные акты 0–2 (вариант B)

Область v2: акт 0 (дни 1–3) уже готов; акты 1 (дни 4–7) и 2 (дни 8–14) наполняются
целиком. Акт 3 (дни 15+, военное положение) — вне v2, обрывается на финале карантина.
Целевая длительность: основная линия ~6–8 ч, с сайдами — 8–12 ч.

Идентификаторы, флаги и узлы ниже — обязательные: контент-слайсы не придумывают свои
id без нужды и не переименовывают существующие. Словарь условий/эффектов — только из
`CONTENT_SCHEMAS.md`. Каждый квест имеет `targetLocation` (маркер на карте).

## Акт 1 — «Тревога» (worldPhase 1, дни 4–7)

Майнлайн акт 1 — существующий `q-hospital-panic` (Борис): склад → драка с хулиганами →
доставка/триаж → переход в Ф2. Днём не гейтится, но по духу — день 4+.

### Новые квесты

| id | Название | Giver | Суть и стейджи | Награда/флаги |
|---|---|---|---|---|
| `q-zina-case` | «Спекулянтка» | sergey | Гейт: флаг `zina-reported=true`. Стейджи: `report` (сообщить Сергею — существующий выбор «Я сообщу Сергею» у Зины уже ставит флаг; у Сергея выбор «Зина спекулирует»), `statement` (выбор «Напишу заявление» — уже даёт `zina-case-opened`), `close` (прийти в аптеку на следующий день — окно `{days:1, from morning, to evening}`, реплика Зины о проверке) | persuasion +1, `zina-case-opened` |
| `q-taras-generator` | «Генератор» | taras | Стейджи: `inspect` (осмотреть генератор — интеракт-диалог), `fix` (нужна изолента ×1 — `takeItem duct-tape`), `report` (доложить Тарасу). Окно `{days:2, from morning, to evening}` | repair +1, мультиметр, `taras-generator-fixed` |
| `q-dima-panic` | «Трусость» | dima | Дима паникует. Стейджи: `talk` (поговорить в общаге), `walk` (сходить с ним в аптеку — диалог Зины, реплика про очередь), `resolve` (Дима решает: если `dima-loyal` — `joinParty dima` (существующий выбор «Держись рядом»), иначе — реплика «Я не могу» и флаг `dima-hid`) | `dima-joined` (лояльная ветка) или `dima-hid` |
| `q-water-reserve` | «Запас воды» | luda | Люда просит воды и мелочёвки. Стейджи: `buy` (купить у Зины 2 бутылки — эффект у Зины: resource −1, `giveItem water-bottle ×2`, флаг `zina-water-bought`), `deliver` (занести Люде — `takeItem water-bottle ×2`). Окно `{days:1, from morning, to evening}` | resource +1, бинт, `luda-water-done` |
| `q-patrol-route` | «Вечерний обход» | sergey | Гейт `day>=5`. Встретиться вечером (`timeSlot eq evening`) и пройти двор: стейджи `meet` (площадь), `check-basement` (мастерская — реплика Тараса), `report` (вернуться к Сергею). Окно `to evening` | persuasion +1, `patrol-done` |

### Контент-поддержка акта 1

- Предмет: `water-bottle` («Бутылка воды», consumable, stack 3, hp +2).
- Враг: без новых (хулиган `bully` уже есть).
- Стычки: `campus-rowdy` (campus, `bully`, условия `day>=5`), `square-mugger`
  (square, `bully`, условия `day>=6` + `timeSlot eq evening`).
- Контейнеры: `square-kiosk` («Киоск на площади», square, фазы [0,1]: таблетки 50%,
  сода), `campus-vending` («Торговый автомат», campus, фазы [0,1], замок
  `repair 2`, внутри `water-bottle ×2`).

## Акт 2 — «Кризис» (worldPhase 2, дни 8–14)

Переход в Ф2 — `q-hospital-panic` (готово). Акт 2: метро-убежище открыто, Зина ушла,
Клещ облюбовал склады, свет по расписанию. Партия (борис/дима/люда) — союзники в бою
(движок v2: соратники действуют автоматически после хода героя).

### Новые квесты

| id | Название | Giver | Суть и стейджи | Награда/флаги |
|---|---|---|---|---|
| `q-shelter-metro` | «Убежище» | sergey | Стейджи: `enter` (дойти до метро — узнаваемо по открытому выходу), `inspect` (осмотреть запасы убежища — контейнер `metro-shelter-box` получает `onOpenEffects: advanceQuest`), `report` (доложить Сергею). Окно `{days:3, from morning, to evening}` | resource +1, `shelter-checked` |
| `q-boris-triage` | «Ночная смена» | boris | Гейт `day>=9`. Стейджи: `triage` (помочь в приёмном — выбор в диалоге, resource −1), `supplies` (принести Борису антисептик ×1 и бинт ×1 — `takeItem`), `shift` (дежурство до утра — `advanceTime` до конца дня/ночи репликой). Окно `{days:2, from morning, to evening}` | medicine +1, аптечка, `boris-shift-done` |
| `q-evac-list` | «Список на эвакуацию» | dima | Стейджи: `list` (попросить место в списке), `luda` (уговорить Люду — существующий выбор «Впиши Люду» ставит `luda-evac-listed`; добавить выбор «Вписать Тараса» → `taras-evac-listed` у Тараса в мастерской), `close` (вернуться к Диме). Окно `{days:3, from morning, to evening}` | persuasion +1 |
| `q-luda-bandages` | «Рецепты Люды» | luda | Квестификация существующего узла «Научите делать бинты»: стейджи `ask` (попросить), `learn` (существующие награды узла `luda-taught`: марля×3, сода×2, антисептик×2, medicine +1) | `luda-taught` |
| `q-blackout` | «Темнота» | taras | Гейт `day>=10`. Стейджи: `panel` (осмотреть щиток — диалог), `fix` (нужен мультиметр — Cond `item multimeter gte 1`, ремонт 3+), `restore` (свет в подвале — реплика). Окно `{days:2, from morning, to evening}` | repair +1, resource +1, `power-restored` |
| `q-klesh` | «Клещ» | sergey | Стейджи: `track` (расспросить Тараса — тот видел мародёра у складов), `fight` (стычка `klesh-warehouse` в мастерской: условия `quest q-klesh eq active` + провал повторяем), `report` (доложить Сергею). `onWinEffects` стычки: `advanceQuest q-klesh → report`, `setFlag klesh-defeated`. Окно `{days:4, from morning, to evening}` | persuasion +1, `klesh-defeated`; XP/лут — бой |
| `q-quarantine-end` | «День четырнадцатый» | luda | Финал. Гейт `day>=14`. Зеркало `q-day3-end`: стейджи `gather` (собраться у Люды дома вечером — `timeSlot eq evening`), `broadcast` (финальный эфир коменданта — выбор в диалоге) → `completeQuest` + `setFlag game-complete-v2`. Эпилог-узлы с вариациями по флагам (`dima-joined`, `luda-joined`, `klesh-defeated`, `zina-case-opened`, `boris-stay`). Окно `{days:1, from morning, to evening}`; провал — флаг `finale-skipped` и утешительный узел | `game-complete-v2` |

### Контент-поддержка акта 2

- Враги: `looter` («Мародёр», Ф2: hp 12, atk 3, def 1, spd 4, действия «Рывок» 3 /
  «Толчок» 2, лут бинт 50% / таблетки 30%, xp 5). «Клещ» `klesh` уже есть (hp 16,
  atk 4, def 1, xp 8).
- Стычки: `pharmacy-looter` (pharmacy, `looter`, условия `worldPhase eq 2` — по умолч.
  и так Ф2), `klesh-warehouse` (workshop, `klesh`, условия `quest q-klesh eq active`,
  onLose: resource −1).
- Контейнеры: `square-barricade-box` («Ящик баррикад», square, Ф2: изолента, марля),
  `campus-evac-box` («Коробки эвакопункта», campus, Ф2: таблетки 50%,
  `water-bottle`, бинт).

## Союзники в бою (движок v2, отдельный коммит)

- Новый тип контента `companions.json`: `{ id, name, stats: { hp, atk, heal } }`;
  `id` совпадает с npc-id. Данные: `boris` (hp 12, atk 2, heal 6 — полевой врач),
  `dima` (hp 14, atk 3, heal 0 — стойкость), `luda` (hp 8, atk 1, heal 3 — перевязки).
- `HeroInput.allies?: AllyInput[]` — партия на момент начала боя (app собирает из
  `state.party` через провайдер).
- Порядок хода: герой (управление) → союзники (авто: лечат героя, если его HP < половины,
  иначе бьют) → враг. Враг выбирает цель равновероятно среди героя и живых союзников
  (rng инъектируется). Союзник с 0 HP выбывает из боя. Поражение — только 0 HP героя.
- HP союзников эфемерны (не пишутся в сейв, восстанавливаются к следующему бою);
  расходники в бою — только героя.
- UI: полоски HP союзников над полоской героя в `battleScreen`.
- Доки: `CONTENT_SCHEMAS.md` (раздел Companion), `CONTRACTS.md` («Бой v2»).

## Правки существующих узлов (минимальные)

- `sergey-p1-*`: выбор «Напишу заявление» дополнительно `startQuest q-zina-case`
  (квест затем держит те же флаги).
- `taras-p1-intro`: одношотовая починка генератора превращается в квест (выбор
  «Помочь с генератором?» → `startQuest q-taras-generator`; награды переезживают
  в `onCompleteEffects`).
- `dima-p1-intro`/`dima-p2-help`, `luda-p2-intro`: обвязываются квестами
  (`q-dima-panic`, `q-evac-list`, `q-luda-bandages`) без потери существующих флагов.

## Чего в v2 НЕТ

- Акта 3, новых локаций, новых НПС, контроля союзников вручную, голода/усталости,
- репутации как отдельной механики (лояльность — флаги, как сейчас),
- озвучки/ассетов: по-прежнему примитивы с перекраской.
