// Прокачка: HP от уровня, XP, очки навыков. Числа — «Баланс боя v1» (docs/CONTRACTS.md).
import type { GameState, SkillId } from "../types";

/** HP героя: 20 на 1-м уровне, +2 за уровень. */
export function maxHp(state: GameState): number {
  return 20 + 2 * (state.hero.level - 1);
}

/** Порог XP для перехода с уровня `level` на следующий. */
export function xpToNextLevel(level: number): number {
  return 8 * level;
}

/** Начисляет XP, поднимает уровни (+2 HP, +1 очко навыка); возвращает число уровней. */
export function awardXp(draft: GameState, amount: number): number {
  if (!Number.isFinite(amount) || amount < 0) throw new Error(`XP: некорректное значение ${amount}`);
  draft.hero.xp += amount;
  let levels = 0;
  while (draft.hero.xp >= xpToNextLevel(draft.hero.level)) {
    draft.hero.xp -= xpToNextLevel(draft.hero.level);
    draft.hero.level += 1;
    draft.hero.skillPoints += 1;
    draft.hero.hp = Math.min(maxHp(draft), draft.hero.hp + 2);
    levels += 1;
  }
  return levels;
}

/** Тратит очко навыка на стат; false — если очков нет. */
export function spendSkillPoint(draft: GameState, stat: SkillId): boolean {
  if (draft.hero.skillPoints <= 0) return false;
  draft.hero.skillPoints -= 1;
  draft.hero.stats[stat] += 1;
  return true;
}

/** Лечение с клампом по максимуму; отрицательный delta — урон. */
export function changeHp(draft: GameState, delta: number): void {
  draft.hero.hp = Math.max(0, Math.min(maxHp(draft), draft.hero.hp + delta));
}
