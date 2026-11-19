import { describe, expect, it } from "vitest";
import { unwrapContent } from "../../src/content";
import { loadBundledContent } from "../../src/content/bundled";
import backgroundsFile from "../../src/content/data/backgrounds.json";
import dialogsFile from "../../src/content/data/dialogs.json";
import encountersFile from "../../src/content/data/encounters.json";
import containersFile from "../../src/content/data/containers.json";
import enemiesFile from "../../src/content/data/enemies.json";
import itemsFile from "../../src/content/data/items.json";
import npcsFile from "../../src/content/data/npcs.json";
import questsFile from "../../src/content/data/quests.json";
import skillsFile from "../../src/content/data/skills.json";
import type {
  BackgroundDef,
  Container,
  ContentData,
  ContentFile,
  DialogNode,
  Encounter,
  Enemy,
  Item,
  Npc,
  Quest,
  SkillDef,
} from "../../src/content/types";
import { validateContent } from "../../src/content/validate";

function bundledData(): ContentData {
  return {
    dialogs: unwrapContent<DialogNode>(
      dialogsFile as unknown as ContentFile<DialogNode>,
      "dialogs",
    ),
    quests: unwrapContent<Quest>(questsFile as unknown as ContentFile<Quest>, "quests"),
    items: unwrapContent<Item>(itemsFile as unknown as ContentFile<Item>, "items"),
    enemies: unwrapContent<Enemy>(enemiesFile as unknown as ContentFile<Enemy>, "enemies"),
    encounters: unwrapContent<Encounter>(
      encountersFile as unknown as ContentFile<Encounter>,
      "encounters",
    ),
    containers: unwrapContent<Container>(
      containersFile as unknown as ContentFile<Container>,
      "containers",
    ),
    npcs: unwrapContent<Npc>(npcsFile as unknown as ContentFile<Npc>, "npcs"),
    skills: unwrapContent<SkillDef>(skillsFile as unknown as ContentFile<SkillDef>, "skills"),
    backgrounds: unwrapContent<BackgroundDef>(
      backgroundsFile as unknown as ContentFile<BackgroundDef>,
      "backgrounds",
    ),
  };
}

function first<T>(items: T[]): T {
  const value = items[0];
  if (value === undefined) throw new Error("фикстура пуста");
  return value;
}

describe("loadBundledContent", () => {
  it("бандл читается без исключений", () => {
    expect(() => loadBundledContent()).not.toThrow();
  });
});

describe("validateContent", () => {
  it("бандл валиден: ошибок нет", () => {
    expect(validateContent(bundledData())).toEqual([]);
  });

  it("битая ссылка на NPC", () => {
    const data = structuredClone(bundledData());
    first(data.dialogs).npc = "nobody";
    const errors = validateContent(data);
    expect(errors.some((error) => error.includes("dialogs[0].npc"))).toBe(true);
    expect(errors.some((error) => error.includes("nobody"))).toBe(true);
  });

  it("дубликат id", () => {
    const data = structuredClone(bundledData());
    data.items.push({ ...first(data.items) });
    const errors = validateContent(data);
    expect(errors.some((error) => error.includes("дубликат id"))).toBe(true);
  });

  it("лишнее поле", () => {
    const data = structuredClone(bundledData());
    const item = first(data.items) as unknown as Record<string, unknown>;
    item.unexpected = true;
    const errors = validateContent(data);
    expect(errors.some((error) => error.includes("unexpected: неизвестное поле"))).toBe(true);
  });

  it("stack > 0 и chance 0..1", () => {
    const data = structuredClone(bundledData());
    first(data.items).stack = 0;
    const enemy = data.enemies.find((entry) => entry.id === "bully");
    if (!enemy) throw new Error("в фикстуре нет bully");
    const loot = first(enemy.loot);
    loot.chance = 2;
    const errors = validateContent(data);
    expect(errors.some((error) => error.includes("items[0].stack"))).toBe(true);
    expect(errors.some((error) => error.includes("chance"))).toBe(true);
  });

  it("пустые стадии квеста", () => {
    const data = structuredClone(bundledData());
    first(data.quests).stages = [];
    const errors = validateContent(data);
    expect(errors.some((error) => error.includes("stages: пустой массив"))).toBe(true);
  });

  it("стычка: битые локация/враг и нечисловой день", () => {
    const data = structuredClone(bundledData());
    const encounter = first(data.encounters);
    encounter.location = "nowhere";
    encounter.enemy = "nobody";
    encounter.conditions = [{ type: "day", op: "gte", value: 0 }];
    const errors = validateContent(data);
    expect(errors.some((error) => error.includes("encounters[0].location"))).toBe(true);
    expect(errors.some((error) => error.includes("encounters[0].enemy"))).toBe(true);
    expect(errors.some((error) => error.includes("номер дня"))).toBe(true);
  });

  it("контейнер: битая локация/предмет/шанс и замок", () => {
    const data = structuredClone(bundledData());
    const container = first(data.containers);
    container.location = "nowhere";
    container.contents = [{ item: "nobody", qty: 0, chance: 2 }];
    container.locked = { skill: "repair", dc: 0, tool: "nobody" };
    const errors = validateContent(data);
    expect(errors.some((error) => error.includes("containers[0].location"))).toBe(true);
    expect(errors.some((error) => error.includes("containers[0].contents[0].item"))).toBe(true);
    expect(errors.some((error) => error.includes("contents[0].qty"))).toBe(true);
    expect(errors.some((error) => error.includes("contents[0].chance"))).toBe(true);
    expect(errors.some((error) => error.includes("containers[0].locked.dc"))).toBe(true);
    expect(errors.some((error) => error.includes("containers[0].locked.tool"))).toBe(true);
  });
});
