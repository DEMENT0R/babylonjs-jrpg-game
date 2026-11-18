import { describe, expect, it } from "vitest";
import { advanceSlot, type GameTime } from "../src/core/time";

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
