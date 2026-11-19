# Схемы контента (JSON) и сейва

Единый источник контрактов для слайсов 2, 3, 7. TS-типы живут в `src/content/types.ts` —
эта дока их зеркало; при расхождении приоритет у кода и валидатора, доку обновлять тем же
коммитом.

## Общие правила
- Обёртка каждого файла: `{ "contentVersion": 1, "locale": "ru", "data": [...] }`.
  `locale` обязателен сразу — точка входа для будущего i18n; язык по умолчанию `ru`.
- Идентификаторы: `kebab-case`, уникальны в пределах типа; ссылки между типами — по id.
- Контент валидируется скриптом `scripts/validate-content.ts` (CI-гейт): неизвестные
  поля, битые ссылки, дубли id — ошибка сборки.

## Словарь условий и эффектов (общий для всех типов)

```
Cond   = { type: "flag" | "item" | "stat" | "quest" | "worldPhase" | "timeSlot" | "day",
           id?: string, op: "eq" | "gte" | "lte", value: number | string | boolean }
Effect = one of:
  { type: "setFlag",        id, value? }
  { type: "giveItem" | "takeItem", item, qty? }
  { type: "stat",           stat: "medicine"|"repair"|"persuasion"|"stealth", delta }
  { type: "resource",       delta }          // мораль/энергия
  { type: "hp",             delta }
  { type: "advanceTime",    slots: 1 }       // единственный способ сдвинуть время
  { type: "startQuest" | "advanceQuest" | "completeQuest" | "failQuest", quest, stage? }
  { type: "setWorldPhase",  phase: 0|1|2|3 }  // единственный способ сменить фазу мира
  { type: "joinParty" | "leaveParty", npc }
```
- `day` сравнивает `time.day` целым числом (`{ "type": "day", "op": "gte", "value": 3 }`
  — «не раньше третьего дня»); `id` не используется.

## DialogNode
```json
{ "id": "boris-intern-intro",
  "npc": "boris",
  "text": "Третья смену подряд? Иди отдыхай, воскреснем.",
  "choices": [
    { "text": "Ещё двух пациентов принять надо.",
      "conditions": [{ "type": "quest", "id": "q-intern-shift", "op": "eq", "value": "active" }],
      "effects": [{ "type": "advanceQuest", "quest": "q-intern-shift", "stage": "patients" }],
      "next": "boris-intern-shift" },
    { "text": "Уйти.", "next": "boris-intern-exit" }
  ] }
```
- Узел без `choices` → автопереход по `next`.
- Вход в граф — через `npc.phases[phase].dialog` или квест; по миру — интеракция с НПС.

## Quest
```json
{ "id": "q-luda-meds", "title": "Лекарства для Люды",
  "giver": "luda", "worldPhases": [0, 1],
  "stages": [
    { "id": "take", "description": "Купить таблетки в аптеке.",
      "timeWindow": { "from": "morning", "to": "evening" } },
    { "id": "give", "description": "Занести Люде.",
      "onEnterEffects": [{ "type": "stat", "stat": "persuasion", "delta": 1 }] }
  ],
  "onCompleteEffects": [],
  "onFailEffects": [] }
```
- `timeWindow` опционален; отсчитывается от дня взятия квеста: `{from, to}` — тот же
  день, `{days, from, to}` — со сдвигом. Провал срабатывает на первом `advanceTime`,
  выводящем время за `to` (день взятия + `days`); провал — не game over.

## Item
```
{ id, name, category: "consumable" | "material" | "tool", stack, effects: Effect[],
  recipe?: { inputs: [{ item, qty }], stat: "repair" | "medicine", dc } }
```

## Enemy
```
{ id, name, worldPhase: 0|1|2|3,
  stats: { hp, atk, def, spd },
  actions: [{ id, name, power, effects: Effect[] }],
  loot: [{ item, chance }], xp }
```

## Encounter (стычка в локации)
```
{ id, location: "<location-id>", enemy: "<enemy-id>",
  conditions?: Cond[],                 // когда стычка появляется
  onWinEffects?: Effect[],             // победа; стычка закрывается флагом encounter:<id>:done
  onLoseEffects?: Effect[] }           // поражение/побег; попытка сохраняется
```
- Проверяется при входе в локацию (`systems/encounters.ts` + `app/main.ts`), бой
  запускается без диалога. Победа выставляет `encounter:<id>:done` в `flags` и
  применяет `onWinEffects`; поражение/побег применяет `onLoseEffects` и оставляет
  стычку доступной при повторном входе.

## NPC
```
{ id, name, home: "<location-id>",
  phases: { 0: { dialog: "<node-id>", present: true }, 1: { ... }, 2: { ... } } }
```

## Background (старт героя, content)
```
{ id: "intern" | "student" | "engineer", name, startLocation, startNpc,
  hp, resource, stats: Record<SkillId, number>, skill: "<skill-id>" }
```
`hero.skills` в сейве — список id из `content/skills.json` (v1: один на бэкграунд):
`Skill = { id, name, effect }`, где `effect` — из общего словаря Effect выше.

## Сейв v2 (`saveVersion: 2`, текущий)
```ts
interface SaveV2 {
  saveVersion: 2;
  hero: { background: "intern" | "student" | "engineer"; name: string;
          hp: number; resource: number;
          level: number; xp: number; skillPoints: number;
          stats: Record<"medicine"|"repair"|"persuasion"|"stealth", number>;
          skills: string[] };
  party: string[];                                  // npc-id
  worldPhase: 0 | 1 | 2 | 3;
  time: { day: number; slot: "morning" | "day" | "evening" };
  location: string; pos: [number, number];
  inventory: { item: string; qty: number }[];
  questStates: Record<string, { stage: string; status: "active" | "done" | "failed";
                                startedDay: number }>;
  flags: Record<string, boolean>;
}
```
- `startedDay` — день взятия квеста: от него отсчитывается `timeWindow` текущей стадии
  (`{from,to}` — тот же день, `{days,from,to}` — со сдвигом). Без поля окно не проверить.
- `level`/`xp`/`skillPoints` — прокачка из боя: порог `8 * level`, +2 HP и +1 очко за
  уровень (docs/CONTRACTS.md, «Баланс боя v1»).
- Миграции: несоответствие `saveVersion` → цепочка `migrations[]` в `state/persistence/`;
  миграция — чистая функция `SaveN → SaveN+1`, покрыта тестом. v1 → v2 добавляет
  `level=1`,`xp=0`,`skillPoints=0`, а `startedDay` берёт из `time.day` сейва.
- Поля сверх перечисленных запрещены; новое поле = новая версия сейва.
