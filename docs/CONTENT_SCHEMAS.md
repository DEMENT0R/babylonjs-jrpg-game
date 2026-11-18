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
Cond   = { type: "flag" | "item" | "stat" | "quest" | "worldPhase" | "timeSlot",
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
- `timeWindow` опционален; истечение окна = `onFailEffects` (провал — не game over).

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

## NPC
```
{ id, name, home: "<location-id>",
  phases: { 0: { dialog: "<node-id>", present: true }, 1: { ... }, 2: { ... } } }
```

## Сейв v1 (`saveVersion: 1`)
```ts
interface SaveV1 {
  saveVersion: 1;
  hero: { background: "intern" | "student" | "engineer"; name: string;
          hp: number; resource: number;
          stats: Record<"medicine"|"repair"|"persuasion"|"stealth", number>;
          skills: string[] };
  party: string[];                                  // npc-id
  worldPhase: 0 | 1 | 2 | 3;
  time: { day: number; slot: "morning" | "day" | "evening" };
  location: string; pos: [number, number];
  inventory: { item: string; qty: number }[];
  questStates: Record<string, { stage: string; status: "active" | "done" | "failed" }>;
  flags: Record<string, boolean>;
}
```
- Миграции: несоответствие `saveVersion` → цепочка `migrations[]` в `state/persistence/`;
  миграция — чистая функция `SaveN → SaveN+1`, покрыта тестом.
- Поля сверх перечисленных запрещены; новое поле = новая версия сейва.
