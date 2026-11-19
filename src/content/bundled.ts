// Бандл-провайдер: JSON лежит в репо и импортируется сборщиком
// (docs/ARCHITECTURE.md §2). Формат файлов — зеркало docs/CONTENT_SCHEMAS.md.
import backgroundsFile from "./data/backgrounds.json";
import dialogsFile from "./data/dialogs.json";
import encountersFile from "./data/encounters.json";
import containersFile from "./data/containers.json";
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
} from "./types";
import enemiesFile from "./data/enemies.json";
import itemsFile from "./data/items.json";
import npcsFile from "./data/npcs.json";
import questsFile from "./data/quests.json";
import skillsFile from "./data/skills.json";
import { createContentProvider, unwrapContent, type IContentProvider } from "./index";

/** Единственный бандл контента игры; чистые системы получают его как IContentProvider. */
export function loadBundledContent(): IContentProvider {
  const data: ContentData = {
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
  return createContentProvider(data);
}
