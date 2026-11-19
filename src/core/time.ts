import type { TimeSlot } from "../types";

export interface GameTime {
  day: number;
  slot: TimeSlot;
}

const NEXT: Record<TimeSlot, TimeSlot> = { morning: "day", day: "evening", evening: "morning" };

/** morning→day→evening→morning(+день). Чистая функция; в рантайме зовёт только advanceTime. */
export function advanceSlot(time: GameTime): GameTime {
  const slot = NEXT[time.slot];
  return slot === "morning" ? { day: time.day + 1, slot } : { day: time.day, slot };
}

/** Сколько слотов до следующего утра (сон в квартире). */
export function slotsToMorning(slot: TimeSlot): number {
  return slot === "morning" ? 3 : slot === "day" ? 2 : 1;
}

/** Сколько слотов до вечера текущего дня (0 — уже вечер). */
export function slotsToEvening(slot: TimeSlot): number {
  return slot === "morning" ? 2 : slot === "day" ? 1 : 0;
}
