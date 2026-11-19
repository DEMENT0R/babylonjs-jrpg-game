// Резолвер условий Cond (docs/CONTENT_SCHEMAS.md, «Словарь условий»). Чистая логика:
// состояние сейва на входе, boolean на выходе. Ошибки контента — исключения.
import type { Cond } from "../content/types";
import type { GameState, TimeSlot } from "../types";

export const SLOT_RANK: Record<TimeSlot, number> = { morning: 0, day: 1, evening: 2 };

function compare(
  left: number | string | boolean,
  op: Cond["op"],
  right: number | string | boolean,
) {
  switch (op) {
    case "eq":
      return left === right;
    case "gte":
      return left >= right;
    case "lte":
      return left <= right;
  }
}

export function resolveCond(cond: Cond, state: GameState): boolean {
  switch (cond.type) {
    case "flag": {
      if (cond.id === undefined) throw new Error("Cond flag: не задан id");
      return compare(state.flags[cond.id] ?? false, cond.op, cond.value);
    }
    case "item": {
      if (cond.id === undefined) throw new Error("Cond item: не задан id");
      const qty = state.inventory.find((entry) => entry.item === cond.id)?.qty ?? 0;
      return compare(qty, cond.op, Number(cond.value));
    }
    case "stat": {
      if (cond.id === undefined) throw new Error("Cond stat: не задан id");
      const stat = state.hero.stats[cond.id as keyof GameState["hero"]["stats"]];
      if (stat === undefined) throw new Error(`Cond stat: неизвестный стат "${cond.id}"`);
      return compare(stat, cond.op, Number(cond.value));
    }
    case "quest": {
      if (cond.id === undefined) throw new Error("Cond quest: не задан id");
      return compare(state.questStates[cond.id]?.status ?? "none", cond.op, cond.value);
    }
    case "worldPhase":
      return compare(state.worldPhase, cond.op, Number(cond.value));
    case "day":
      return compare(state.time.day, cond.op, Number(cond.value));
    case "timeSlot": {
      const rank = SLOT_RANK[state.time.slot];
      const target = SLOT_RANK[cond.value as TimeSlot];
      if (target === undefined) throw new Error(`Cond timeSlot: неизвестный слот "${cond.value}"`);
      return compare(rank, cond.op, target);
    }
  }
}

export function resolveConds(conds: readonly Cond[] | undefined, state: GameState): boolean {
  return (conds ?? []).every((cond) => resolveCond(cond, state));
}
