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
