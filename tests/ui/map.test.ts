// Модель вкладки «Карта»: узлы/рёбра схемы района, маркеры НПС и контейнеров.
// Рендер (renderMapSVG) — DOM, автотестами не покрыт (ARCHITECTURE.md §7).
import { describe, expect, it } from "vitest";
import { loadBundledContent } from "../../src/content/bundled";
import { newGameForBackground } from "../../src/systems/character";
import { containerOpenedFlag } from "../../src/systems/containers";
import type { WorldPhase } from "../../src/types";
import { buildMapModel, type MapModel } from "../../src/ui/map";
const content = loadBundledContent();

function stateIn(location: string, phase: WorldPhase = 0) {
  const state = newGameForBackground(content, "intern");
  state.location = location;
  state.worldPhase = phase;
  return state;
}

function nodeOf(model: MapModel, id: string) {
  const node = model.nodes.find((n) => n.id === id);
  if (!node) throw new Error(`нет узла ${id}`);
  return node;
}

describe("карта района (ui/map.ts)", () => {
  it("7 узлов с позициями и рёбрами ровно по топологии, без дублей", () => {
    const model = buildMapModel(stateIn("square"), content);
    expect(model.nodes).toHaveLength(7);
    expect(model.edges).toHaveLength(6);
    const keys = model.edges.map((e) => [e.from, e.to].sort().join("<>"));
    expect(new Set(keys).size).toBe(6);
    for (const node of model.nodes) {
      expect(node.x).toBeGreaterThan(0);
      expect(node.y).toBeGreaterThan(0);
    }
  });

  it("«вы здесь» — ровно один узел текущей локации", () => {
    const model = buildMapModel(stateIn("pharmacy"), content);
    expect(nodeOf(model, "pharmacy").here).toBe(true);
    expect(model.nodes.filter((n) => n.here)).toHaveLength(1);
  });

  it("метро закрыто в фазах 0–1 и открыто с фазы 2", () => {
    for (const phase of [0, 1] as const) {
      const model = buildMapModel(stateIn("square", phase), content);
      expect(
        model.edges.find((e) => [e.from, e.to].sort().join("<>") === "metro-station<>square")?.open,
      ).toBe(false);
    }
    const open = buildMapModel(stateIn("square", 2), content);
    expect(
      open.edges.find((e) => [e.from, e.to].sort().join("<>") === "metro-station<>square")?.open,
    ).toBe(true);
  });

  it("НПС узла — присутствующие в текущей фазе: Зина исчезает из аптеки к фазе 2", () => {
    const p0 = buildMapModel(stateIn("square", 0), content);
    expect(nodeOf(p0, "pharmacy").npcs).toEqual(["Зина"]);
    expect(nodeOf(p0, "hospital").npcs).toEqual(["Борис"]);
    const p2 = buildMapModel(stateIn("square", 2), content);
    expect(nodeOf(p2, "pharmacy").npcs).toEqual([]);
  });

  it("контейнеры: видимые и не открытые; открытие убирает счётчик, фаза скрывает", () => {
    const state = stateIn("square", 0);
    const model = buildMapModel(state, content);
    expect(nodeOf(model, "pharmacy").lootables).toBe(1);
    expect(nodeOf(model, "hospital").lootables).toBe(0); // фазовый, скрыт в 0
    state.flags[containerOpenedFlag("pharmacy-fridge")] = true;
    expect(nodeOf(buildMapModel(state, content), "pharmacy").lootables).toBe(0);
    const phase1 = buildMapModel(stateIn("square", 1), content);
    expect(nodeOf(phase1, "hospital").lootables).toBe(1);
  });

  it("квест-маркеры: активные квесты на локации цели, выполненные не считаются", () => {
    const state = stateIn("square", 0);
    state.questStates["q-luda-meds"] = { stage: "take", status: "active", startedDay: 1 };
    state.questStates["q-intern-shift"] = { stage: "patients", status: "done", startedDay: 1 };
    const model = buildMapModel(state, content);
    expect(nodeOf(model, "pharmacy").quests).toEqual(["Лекарства для Люды"]);
    expect(nodeOf(model, "hospital").quests).toEqual([]);
  });
});
