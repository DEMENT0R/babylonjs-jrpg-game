import { describe, expect, it } from "vitest";
import { loadBundledContent } from "../../src/content/bundled";
import { newGameForBackground } from "../../src/systems/character";
import { addItem } from "../../src/systems/inventory";
import {
  canOpenContainer,
  containerHint,
  containerOpenedFlag,
  findContainerAt,
  openContainer,
} from "../../src/systems/containers";

const content = loadBundledContent();

/** Детерминированный rng: значения по одному, дальше — 1 (шанс не сыграл). */
function rngOf(...values: number[]): () => number {
  let i = 0;
  return () => {
    const value = values[i];
    i += 1;
    return value ?? 1;
  };
}

function stateIn(location: string) {
  const state = newGameForBackground(content, "intern");
  state.location = location;
  return state;
}

describe("containers", () => {
  it("находится только в своей локации и радиусе; фазовые скрыты до своей фазы", () => {
    const state = stateIn("workshop");
    expect(findContainerAt(content, state, 9, -4.7)?.id).toBe("workshop-crates");
    expect(findContainerAt(content, state, 0, 0)).toBeUndefined();
    state.location = "square";
    expect(findContainerAt(content, state, 9, -4.7)).toBeUndefined();

    const apartment = stateIn("apartment");
    expect(findContainerAt(content, apartment, 2.2, 8.1)).toBeUndefined();
    apartment.worldPhase = 2;
    expect(findContainerAt(content, apartment, 2.2, 8.1)?.id).toBe("apartment-supplies");
  });

  it("лут роллится по chance/qty, открытие одноразовое", () => {
    const state = stateIn("workshop");
    const crate = findContainerAt(content, state, 9, -4.7)!;

    const lucky = openContainer(content, crate, state, rngOf(0.5, 0.5));
    expect(lucky).toEqual([
      { item: "crowbar", qty: 1 },
      { item: "duct-tape", qty: 2 },
    ]);
    expect(state.inventory).toContainEqual({ item: "duct-tape", qty: 2 });
    expect(state.flags[containerOpenedFlag("workshop-crates")]).toBe(true);
    expect(findContainerAt(content, state, 9, -4.7)).toBeUndefined();

    // Гарантированный дроп есть, шанс не сыграл — контейнер всё равно открыт.
    const second = stateIn("workshop");
    const skipped = openContainer(
      content,
      findContainerAt(content, second, 9, -4.7)!,
      second,
      rngOf(0.9, 0.9),
    );
    expect(skipped).toEqual([{ item: "crowbar", qty: 1 }]);
    expect(second.flags[containerOpenedFlag("workshop-crates")]).toBe(true);

    // Ни один шанс не сыграл — «пусто», но открытие фиксируется.
    const third = stateIn("workshop");
    const empty = openContainer(
      content,
      findContainerAt(content, third, 9, -4.7)!,
      third,
      rngOf(1),
    );
    expect(empty).toEqual([]);
    expect(third.flags[containerOpenedFlag("workshop-crates")]).toBe(true);
  });

  it("замок: без навыка и лома не открыть, подпись объясняет требование", () => {
    const state = stateIn("pharmacy");
    const fridge = findContainerAt(content, state, 8.5, -7.2)!;
    expect(fridge.id).toBe("pharmacy-fridge");
    expect(canOpenContainer(fridge, state)).toBe(false);
    expect(containerHint(fridge, state, content)).toBe("заперто — ремонт 3 + лом");

    addItem(state, content, "crowbar", 1);
    state.hero.stats.repair = 3;
    expect(canOpenContainer(fridge, state)).toBe(true);
    expect(containerHint(fridge, state, content)).toBe("осмотреть: Холодильник аптеки");

    const gained = openContainer(content, fridge, state, rngOf(0.5, 0.5));
    expect(gained).toEqual([
      { item: "pills", qty: 2 },
      { item: "antiseptic", qty: 1 },
    ]);
  });

  it("onOpenEffects: флаг «кражи» из тележки больницы", () => {
    const state = stateIn("hospital");
    state.worldPhase = 1;
    const cart = findContainerAt(content, state, 0, -7.8)!;
    expect(cart.id).toBe("hospital-equipment");

    openContainer(content, cart, state, rngOf(0.5, 0.5));
    expect(state.flags["stole:hospital-supplies"]).toBe(true);
    expect(findContainerAt(content, state, 0, -7.8)).toBeUndefined();
  });
});
