// Стартовое состояние новой игры и версия сейва (модель — SaveV2 из src/types.ts).
import type { BackgroundId, GameState, SkillId } from "../types";

/** Текущая версия сейва; новое поле модели = новая версия + миграция. */
export const SAVE_VERSION = 2;

/** Стартовые статы героя — «Баланс боя v1» (docs/CONTRACTS.md): каждый навык 1. */
const START_STATS: Record<SkillId, number> = {
  medicine: 1,
  repair: 1,
  persuasion: 1,
  stealth: 1,
};

/** Уникальный навык бэкграунда — «Герои» в docs/NARRATIVE_BIBLE.md; id — kebab-case. */
const BACKGROUND_SKILLS: Record<BackgroundId, readonly string[]> = {
  intern: ["field-medicine"], // Полевая медицина (усиленный хил)
  student: ["fast-learning"], // Быстрая учёба (+XP)
  engineer: ["craft-without-bench"], // Крафт без верстака
};

/**
 * Чистая функция: стартовое состояние по бэкграунду.
 * HP 20 / ресурс 10 — «Баланс боя v1»; спавн `apartment`, день 1, утро,
 * фаза мира 0 (docs/CONTRACTS.md, «Топология района»).
 */
export function newGame(background: BackgroundId, name: string): GameState {
  return {
    saveVersion: SAVE_VERSION,
    hero: {
      background,
      name,
      hp: 20,
      resource: 10,
      level: 1,
      xp: 0,
      skillPoints: 0,
      stats: { ...START_STATS },
      skills: [...BACKGROUND_SKILLS[background]],
    },
    party: [],
    worldPhase: 0,
    time: { day: 1, slot: "morning" },
    location: "apartment",
    pos: [0, 0],
    inventory: [],
    questStates: {},
    flags: {},
  };
}
