import { describe, expect, it } from "vitest";
import type { Enemy } from "../src/content/types";
import type { CombatState, HeroInput } from "../src/systems/combat";
import { act, availableActions, availableItems, startCombat } from "../src/systems/combat";

const hero: HeroInput = {
  id: "hero",
  name: "Герой",
  hp: 20,
  maxHp: 20,
  stats: { medicine: 1, repair: 1, persuasion: 1, stealth: 1 },
  items: { bandage: 2 },
};

function enemy(overrides: Partial<Enemy> = {}): Enemy {
  return {
    id: "bully",
    name: "Хулиган",
    worldPhase: 0,
    stats: { hp: 10, atk: 3, def: 0, spd: 5 },
    actions: [{ id: "shove", name: "Толчок", power: 3 }],
    loot: [],
    xp: 4,
    ...overrides,
  };
}

function withHero(overrides: Partial<HeroInput>): HeroInput {
  return { ...hero, ...overrides, stats: { ...hero.stats, ...overrides.stats } };
}

/** rng, последовательно выдающий заданные значения и повторяющий последнее. */
function sequence(...values: number[]): () => number {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)] ?? 0;
}

describe("combat", () => {
  it("win: герой добивает врага, бой завершён", () => {
    const state = startCombat(
      withHero({ stats: { medicine: 1, repair: 10, persuasion: 1, stealth: 1 } }),
      enemy(),
    );
    // atk = 2 + floor(10 / 2) = 7, HP врага 10 — два удара.
    const first = act(state, "strike", sequence(0.99));
    const second = act(first, "strike", sequence(0.99));
    expect(second.outcome).toBe("win");
    expect(second.enemy.hp).toBe(0);
    expect(second.log.join("\n")).toMatch(/повержен/);
  });

  it("lose: враг выводит героя из строя", () => {
    const state = startCombat(withHero({ hp: 3, maxHp: 3 }), enemy());
    const next = act(state, "strike", sequence(0.99));
    expect(next.outcome).toBe("lose");
    expect(next.hero.hp).toBe(0);
  });

  it("fled: удачный побег завершает бой", () => {
    const state = startCombat(hero, enemy());
    // Побег: 0.7 + 1 * 0.05 = 0.75; rng 0.5 < 0.75 — успех.
    const next = act(state, "flee", sequence(0.5));
    expect(next.outcome).toBe("fled");
    expect(next.hero.hp).toBe(20);
  });

  it("урон не меньше 1", () => {
    const state = startCombat(hero, enemy({ stats: { hp: 10, atk: 3, def: 99, spd: 5 } }));
    const next = act(state, "strike", sequence(0.99));
    // atk героя 2, def врага 99 — всё равно 1 урона.
    expect(next.enemy.hp).toBe(9);
  });

  it("heal тратит bandage и не лечит сверх maxHp", () => {
    const state = startCombat(withHero({ hp: 15, items: { bandage: 1 } }), enemy());
    const next = act(state, "heal", sequence(0.99));
    expect(next.items.bandage).toBe(0);
    // 15 + 6 + 1 = 22 клампится к 20 — в логе именно +5, затем враг бьёт на 3.
    expect(next.log.join("\n")).toContain("+5 HP (20/20)");
    expect(next.hero.hp).toBe(17);
    expect(availableActions(next)).not.toContain("heal");
    expect(() => act(next, "heal", sequence(0.99))).toThrow(/недоступно/);
  });

  it("defend снижает урон ответа врага", () => {
    const target = enemy({ stats: { hp: 100, atk: 3, def: 0, spd: 5 } });
    const plain = act(startCombat(hero, target), "strike", sequence(0.99));
    const guarded = act(startCombat(hero, target), "defend", sequence(0.99));
    // Враг бьёт power 3: обычный урон 3, в защите 3 - 2 = 1.
    expect(plain.hero.hp).toBe(17);
    expect(guarded.hero.hp).toBe(19);
  });

  it("persuade доступен только на первом ходу", () => {
    const state = startCombat(hero, enemy());
    expect(availableActions(state)).toContain("persuade");
    const next = act(state, "defend", sequence(0.99));
    expect(next.turn).toBe(2);
    expect(availableActions(next)).not.toContain("persuade");
    expect(() => act(next, "persuade", sequence(0.99))).toThrow(/недоступно/);
  });

  it("успешный persuade завершает бой без XP", () => {
    const state = startCombat(hero, enemy({ xp: 8 }));
    const next = act(state, "persuade", sequence(0)); // 0.4 + 0.1 = 0.5, успех
    expect(next.outcome).toBe("fled");
    expect(next.hero.hp).toBe(20);
  });

  it("детерминизм при фиксированном rng", () => {
    const first = act(startCombat(hero, enemy()), "strike", sequence(0.42));
    const second = act(startCombat(hero, enemy()), "strike", sequence(0.42));
    expect(second).toEqual(first);
  });

  it("loot выпадает по chance и попадает в state.loot", () => {
    const rich = enemy({
      stats: { hp: 1, atk: 3, def: 0, spd: 5 },
      loot: [
        { item: "bandage", chance: 0.5 },
        { item: "duct-tape", chance: 0.9 },
      ],
    });
    const next = act(startCombat(hero, rich), "strike", sequence(0.4, 0.4));
    expect(next.outcome).toBe("win");
    expect(next.loot).toEqual(["bandage", "duct-tape"]);
  });

  it("действие после завершения боя — ошибка", () => {
    const won: CombatState = act(
      startCombat(
        withHero({ stats: { medicine: 1, repair: 10, persuasion: 1, stealth: 1 } }),
        enemy({ stats: { hp: 1, atk: 3, def: 0, spd: 5 } }),
      ),
      "strike",
      sequence(0.99),
    );
    expect(won.outcome).toBe("win");
    expect(() => act(won, "strike", sequence(0.99))).toThrow(/после завершения/);
    expect(availableActions(won)).toEqual([]);
  });
});

describe("combat: предметы", () => {
  it("использование лечит по hp предмета и тратит штуку", () => {
    const state = startCombat(
      withHero({
        hp: 5,
        items: { medkit: 2 },
        usableItems: { medkit: { name: "Аптечка", hp: 6 } },
      }),
      enemy(),
    );
    expect(availableItems(state)).toEqual(["medkit"]);
    const next = act(state, { type: "item", item: "medkit" }, sequence(0.99));
    expect(next.items.medkit).toBe(1);
    expect(next.log.join("\n")).toContain("использует Аптечка: +6 HP (11/20)");
    // затем враг бьёт на 3
    expect(next.hero.hp).toBe(8);
  });

  it("недоступен при полном HP, нулевом остатке или отсутствии в каталоге", () => {
    const empty = startCombat(
      withHero({
        hp: 5,
        items: { pills: 0 },
        usableItems: { pills: { name: "Таблетки", hp: 4 } },
      }),
      enemy(),
    );
    expect(availableItems(empty)).toEqual([]);
    expect(() => act(empty, { type: "item", item: "pills" })).toThrow(/недоступен/);

    const full = startCombat(
      withHero({ items: { pills: 1 }, usableItems: { pills: { name: "Таблетки", hp: 4 } } }),
      enemy(),
    );
    expect(availableItems(full)).toEqual([]);
    expect(() => act(full, { type: "item", item: "pills" })).toThrow(/недоступен/);

    const unknown = startCombat(withHero({ hp: 5, items: { soda: 3 } }), enemy());
    expect(() => act(unknown, { type: "item", item: "soda" })).toThrow(/недоступен/);
  });

  it("последняя штука уходит из доступных", () => {
    const state = startCombat(
      withHero({
        hp: 5,
        items: { pills: 1 },
        usableItems: { pills: { name: "Таблетки", hp: 4 } },
      }),
      enemy(),
    );
    const next = act(state, { type: "item", item: "pills" }, sequence(0.99));
    expect(next.items.pills).toBe(0);
    expect(availableItems(next)).toEqual([]);
  });
});
