import { describe, expect, it } from "vitest";
import { createContentProvider, unwrapContent } from "../../src/content";
import { loadBundledContent } from "../../src/content/bundled";
import type { ContentData, ContentFile, Npc } from "../../src/content/types";

const npc = (id: string, home: string, present: boolean): Npc => ({
  id,
  name: id,
  home,
  phases: { 0: { dialog: "d", present }, 1: { dialog: "d", present: true } },
});

const data: ContentData = {
  dialogs: [],
  quests: [],
  items: [],
  encounters: [],
  enemies: [],
  companions: [],
  containers: [],
  npcs: [npc("a", "apartment", true), npc("b", "apartment", false), npc("c", "square", true)],
  skills: [],
  backgrounds: [],
};

describe("createContentProvider", () => {
  it("npcsAt: локация + present в фазе", () => {
    const content = createContentProvider(data);
    expect(content.npcsAt("apartment", 0).map((n) => n.id)).toEqual(["a"]);
    expect(content.npcsAt("apartment", 1).map((n) => n.id)).toEqual(["a", "b"]);
    expect(content.npcsAt("square", 0).map((n) => n.id)).toEqual(["c"]);
  });

  it("дубликаты id — ошибка контента", () => {
    expect(() =>
      createContentProvider({
        ...data,
        items: [
          { id: "x", name: "X", category: "tool", stack: 1, effects: [] },
          { id: "x", name: "Y", category: "tool", stack: 1, effects: [] },
        ],
      }),
    ).toThrow(/дубликат item "x"/);
  });

  it("неизвестный id — ошибка с типом и id", () => {
    const content = createContentProvider(data);
    expect(() => content.getQuest("nope")).toThrow(/неизвестный quest "nope"/);
  });
});

describe("unwrapContent", () => {
  const file: ContentFile<{ id: string }> = { contentVersion: 1, locale: "ru", data: [] };

  it("принимает текущую версию и локаль", () => {
    expect(unwrapContent(file, "test")).toEqual([]);
  });

  it("чужая версия/пустая локаль/не массив — ошибка", () => {
    expect(() => unwrapContent({ ...file, contentVersion: 2 }, "test")).toThrow(/contentVersion/);
    expect(() => unwrapContent({ ...file, locale: "" }, "test")).toThrow(/locale/);
    expect(() => unwrapContent({ ...file, data: {} as never }, "test")).toThrow(/не массив/);
  });
});

describe("loadBundledContent", () => {
  it("бандл читается: три бэкграунда, НПС и квест Люды на месте", () => {
    const content = loadBundledContent();
    for (const background of ["intern", "student", "engineer"] as const) {
      expect(content.getBackground(background).startLocation).toBeTruthy();
    }
    expect(content.getQuest("q-luda-meds").stages.map((s) => s.id)).toEqual(["take", "give"]);
    expect(content.getNpc("luda").home).toBe("apartment");
  });

  it("containersAt: контейнеры по локации, дубль id — ошибка", () => {
    const content = loadBundledContent();
    expect(content.containersAt("workshop").map((c) => c.id)).toEqual(["workshop-crates"]);
    expect(content.containersAt("campus").map((c) => c.id)).toEqual([
      "campus-vending",
      "campus-evac-box",
    ]);
    expect(content.getContainer("pharmacy-fridge").location).toBe("pharmacy");
    expect(() =>
      createContentProvider({
        ...data,
        containers: [
          { ...content.getContainer("workshop-crates") },
          { ...content.getContainer("workshop-crates") },
        ],
      }),
    ).toThrow(/дубликат container "workshop-crates"/);
  });
});
