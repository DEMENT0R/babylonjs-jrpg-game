// Старт героя из контента (background): выбор в character select → сейв v2.
import type { IContentProvider } from "../content";
import { newGame } from "../state/gamestate";
import type { BackgroundId, GameState } from "../types";

/**
 * Новый сейв по бэкграунду: HP/ресурс/статы/навык и стартовая локация — из
 * `BackgroundDef` (docs/CONTENT_SCHEMAS.md, «Background»); имя — из карточки
 * или дефолтное из библии.
 */
export function newGameForBackground(
  content: IContentProvider,
  backgroundId: BackgroundId,
  name?: string,
): GameState {
  const bg = content.getBackground(backgroundId);
  const save = newGame(backgroundId, name ?? bg.name);
  save.hero.hp = bg.hp;
  save.hero.resource = bg.resource;
  save.hero.stats = { ...bg.stats };
  save.hero.skills = [bg.skill];
  save.location = bg.startLocation;
  save.pos = [0, 0];
  return save;
}
