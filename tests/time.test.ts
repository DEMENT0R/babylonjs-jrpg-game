import { describe, expect, it } from "vitest";
import { advanceSlot, slotsToEvening, slotsToMorning, type GameTime } from "../src/core/time";

describe("advanceSlot", () => {
  it("morning → day, день не растёт", () => {
    expect(advanceSlot({ day: 3, slot: "morning" })).toEqual({ day: 3, slot: "day" });
  });

  it("day → evening, день не растёт", () => {
    expect(advanceSlot({ day: 3, slot: "day" })).toEqual({ day: 3, slot: "evening" });
  });

  it("evening → morning, день +1", () => {
    expect(advanceSlot({ day: 3, slot: "evening" })).toEqual({ day: 4, slot: "morning" });
  });

  it("полные сутки", () => {
    let time: GameTime = { day: 1, slot: "morning" };
    time = advanceSlot(time);
    time = advanceSlot(time);
    time = advanceSlot(time);
    expect(time).toEqual({ day: 2, slot: "morning" });
  });
});

describe("отдых в квартире", () => {
  it("сон доводит до следующего утра из любого слота", () => {
    for (const slot of ["morning", "day", "evening"] as const) {
      let time: GameTime = { day: 2, slot };
      for (let i = 0; i < slotsToMorning(slot); i++) time = advanceSlot(time);
      expect(time).toEqual({ day: 3, slot: "morning" });
    }
  });

  it("переждать доводит до вечера текущего дня", () => {
    let time: GameTime = { day: 3, slot: "morning" };
    for (let i = 0; i < slotsToEvening("morning"); i++) time = advanceSlot(time);
    expect(time).toEqual({ day: 3, slot: "evening" });
    expect(slotsToEvening("evening")).toBe(0);
  });
});
