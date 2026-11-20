// Пошаговый бой «герой + союзники против врага» — чистая детерминированная логика
// (docs/ARCHITECTURE.md §3). Babylon/DOM здесь нет; `rng` инъектируется для тестов.
// Числа — «Баланс боя v2» (docs/CONTRACTS.md): урон max(1, atk - def), хил 6 + medicine,
// побег 70% + stealth*5%. Союзники действуют автоматически после хода героя: лечат
// его при потерянной половине HP, иначе бьют; враг выбирает цель равновероятно среди
// героя и живых союзников. Поражение — только 0 HP героя.
import type { Enemy, EnemyAction } from "../content/types";

export type CombatActionId = "strike" | "defend" | "heal" | "persuade" | "flee";

/** Расходник, который движок умеет применить в бою (лечит на `hp`). */
export interface UsableItem {
  name: string;
  hp: number;
}

/** Действие боя: базовое или использование предмета из инвентаря героя. */
export type CombatAction = CombatActionId | { type: "item"; item: string };

export interface Fighter {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  spd: number;
}

/** Союзник из партии: боевой профиль из content/companions.json. */
export interface AllyInput {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  atk: number;
  /** Лечение героя за ход; 0 — соратник только бьёт. */
  heal: number;
}

/** Снимок героя для боя: статы и расходники живут в сейве, движок их не читает сам. */
export interface HeroInput {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  stats: { medicine: number; repair: number; persuasion: number; stealth: number };
  items: Record<string, number>;
  /** Каталог расходников, доступных в этом бою (id → имя и лечение). */
  usableItems?: Record<string, UsableItem>;
  /** Партия на момент начала боя; HP союзников эфемерно, в сейв не пишется. */
  allies?: AllyInput[];
}

export interface AllyFighter extends Fighter {
  heal: number;
}

export type Outcome = "ongoing" | "win" | "lose" | "fled";

export interface CombatState {
  hero: Fighter;
  enemy: Fighter;
  /** Союзники героя; выбывший (0 HP) перестаёт действовать до конца боя. */
  allies: AllyFighter[];
  turn: number;
  outcome: Outcome;
  log: string[];
  defending: boolean;
  /** id предметов, выпавших после победы (начисление — забота вызывающего). */
  loot: string[];
  // ─── Расширение контракта движком ────────────────────────────────────────
  // act() получает только состояние, поэтому статы и расходники героя, а также
  // таблица действий/лута врага должны жить в самом состоянии.
  heroStats: HeroInput["stats"];
  items: Record<string, number>;
  usableItems: Record<string, UsableItem>;
  enemyActions: EnemyAction[];
  enemyLoot: Enemy["loot"];
}

const HEAL_BASE = 6;
const DEFEND_DEF_BONUS = 2;
const FLEE_BASE_CHANCE = 0.7;
const FLEE_STEALTH_BONUS = 0.05;
const PERSUADE_BASE_CHANCE = 0.4;
const PERSUADE_STAT_BONUS = 0.1;
const ALLY_HEAL_THRESHOLD = 2; // союзники лечат героя, потерявшего больше половины maxHp
const BANDAGE_ITEM = "bandage";

/**
 * atk героя = база 2 + floor(repair / 2). Навык ремонта — физическая/импровизированная
 * опора в драке (подручный инструмент, знание слабых мест техники и телосложения),
 * а не отдельная боевая характеристика.
 */
function heroAttack(stats: HeroInput["stats"]): number {
  return 2 + Math.floor(stats.repair / 2);
}

/** Единственная формула урона v1. */
function damage(atk: number, def: number): number {
  return Math.max(1, atk - def);
}

function clone(state: CombatState): CombatState {
  return {
    hero: { ...state.hero },
    enemy: { ...state.enemy },
    allies: state.allies.map((ally) => ({ ...ally })),
    turn: state.turn,
    outcome: state.outcome,
    log: [...state.log],
    defending: false, // защита действует только на один ход
    loot: [...state.loot],
    heroStats: { ...state.heroStats },
    items: { ...state.items },
    usableItems: { ...state.usableItems },
    enemyActions: state.enemyActions.map((action) => ({ ...action })),
    enemyLoot: state.enemyLoot.map((drop) => ({ ...drop })),
  };
}

export function startCombat(hero: HeroInput, enemy: Enemy): CombatState {
  return {
    hero: {
      id: hero.id,
      name: hero.name,
      hp: hero.hp,
      maxHp: hero.maxHp,
      atk: heroAttack(hero.stats),
      def: 0,
      spd: 0, // порядок фиксирован: герой всегда действует первым
    },
    enemy: {
      id: enemy.id,
      name: enemy.name,
      hp: enemy.stats.hp,
      maxHp: enemy.stats.hp,
      atk: enemy.stats.atk,
      def: enemy.stats.def,
      spd: enemy.stats.spd,
    },
    allies: (hero.allies ?? []).map((ally) => ({
      id: ally.id,
      name: ally.name,
      hp: ally.hp,
      maxHp: ally.maxHp,
      atk: ally.atk,
      def: 0,
      spd: 0,
      heal: ally.heal,
    })),
    turn: 1,
    outcome: "ongoing",
    log: [
      `${hero.name} против ${enemy.name}` +
        (hero.allies?.length ? `, с ним ${hero.allies.map((ally) => ally.name).join(", ")}` : ""),
    ],
    defending: false,
    loot: [],
    heroStats: { ...hero.stats },
    items: { ...hero.items },
    usableItems: { ...(hero.usableItems ?? {}) },
    enemyActions: enemy.actions.map((action) => ({ ...action })),
    enemyLoot: enemy.loot.map((drop) => ({ ...drop })),
  };
}

export function availableActions(state: CombatState): CombatActionId[] {
  if (state.outcome !== "ongoing") return [];
  const actions: CombatActionId[] = ["strike", "defend"];
  if (state.hero.hp < state.hero.maxHp && (state.items[BANDAGE_ITEM] ?? 0) > 0) {
    actions.push("heal");
  }
  // Уговорить можно только до первой атаки — на первом ходу.
  if (state.turn === 1) actions.push("persuade");
  actions.push("flee");
  return actions;
}

/** Расходники, доступные сейчас: есть в наличии и героя есть что лечить. */
export function availableItems(state: CombatState): string[] {
  if (state.outcome !== "ongoing") return [];
  if (state.hero.hp >= state.hero.maxHp) return [];
  return Object.keys(state.usableItems).filter((id) => (state.items[id] ?? 0) > 0);
}

/**
 * Одно действие героя + ходы союзников + ответ врага. Чистая функция: исходное
 * состояние не мутируется. Бросает, если бой уже завершён или действие недоступно.
 */
export function act(
  state: CombatState,
  action: CombatAction,
  rng: () => number = Math.random,
): CombatState {
  const actionLabel = typeof action === "string" ? action : `item:${action.item}`;
  if (state.outcome !== "ongoing") {
    throw new Error(`Бой: действие "${actionLabel}" после завершения боя (${state.outcome})`);
  }
  if (typeof action === "string") {
    if (!availableActions(state).includes(action)) {
      throw new Error(`Бой: действие "${action}" недоступно`);
    }
  } else if (!availableItems(state).includes(action.item)) {
    throw new Error(`Бой: предмет "${action.item}" недоступен`);
  }

  const next = clone(state);
  const { hero, enemy } = next;

  if (typeof action !== "string") {
    const usable = next.usableItems[action.item];
    if (!usable) throw new Error(`Бой: у предмета "${action.item}" нет боевого эффекта`);
    next.items[action.item] = (next.items[action.item] ?? 0) - 1;
    const before = hero.hp;
    hero.hp = Math.min(hero.maxHp, hero.hp + usable.hp);
    next.log.push(
      `${hero.name} использует ${usable.name}: +${hero.hp - before} HP (${hero.hp}/${hero.maxHp})`,
    );
  } else
    switch (action) {
      case "strike": {
        const dmg = damage(hero.atk, enemy.def);
        enemy.hp = Math.max(0, enemy.hp - dmg);
        next.log.push(
          `${hero.name} бьёт: ${dmg} урона (${enemy.name}: ${enemy.hp}/${enemy.maxHp})`,
        );
        break;
      }
      case "defend": {
        next.defending = true;
        next.log.push(`${hero.name} защищается: +${DEFEND_DEF_BONUS} к защите до конца хода`);
        break;
      }
      case "heal": {
        next.items[BANDAGE_ITEM] = (next.items[BANDAGE_ITEM] ?? 0) - 1;
        const before = hero.hp;
        hero.hp = Math.min(hero.maxHp, hero.hp + HEAL_BASE + next.heroStats.medicine);
        next.log.push(
          `${hero.name} перевязывает раны: +${hero.hp - before} HP (${hero.hp}/${hero.maxHp})`,
        );
        break;
      }
      case "persuade": {
        const chance = PERSUADE_BASE_CHANCE + next.heroStats.persuasion * PERSUADE_STAT_BONUS;
        if (rng() < chance) {
          next.outcome = "fled";
          next.log.push(`${enemy.name} отступает под напором слов — бой окончен`);
          return next;
        }
        next.log.push(`${hero.name} пытается договориться, но ${enemy.name} не слушает`);
        break;
      }
      case "flee": {
        const chance = FLEE_BASE_CHANCE + next.heroStats.stealth * FLEE_STEALTH_BONUS;
        if (rng() < chance) {
          next.outcome = "fled";
          next.log.push(`${hero.name} сбегает из боя`);
          return next;
        }
        next.log.push(`${hero.name} пытается сбежать, но не выходит`);
        break;
      }
    }

  // Победа: враг повержен — трофеи, без начисления XP (это делает app через awardXp).
  if (enemy.hp <= 0) {
    finishWin(next, rng);
    return next;
  }

  // Ход союзников: лечат героя, потерявшего больше половины, иначе бьют врага.
  for (const ally of next.allies) {
    if (ally.hp <= 0) continue;
    const hurt = hero.maxHp - hero.hp >= Math.ceil(hero.maxHp / ALLY_HEAL_THRESHOLD);
    if (hurt && ally.heal > 0) {
      const before = hero.hp;
      hero.hp = Math.min(hero.maxHp, hero.hp + ally.heal);
      next.log.push(
        `${ally.name} перевязывает ${hero.name}: +${hero.hp - before} HP (${hero.hp}/${hero.maxHp})`,
      );
    } else {
      const dmg = damage(ally.atk, enemy.def);
      enemy.hp = Math.max(0, enemy.hp - dmg);
      next.log.push(`${ally.name} бьёт: ${dmg} урона (${enemy.name}: ${enemy.hp}/${enemy.maxHp})`);
    }
    if (enemy.hp <= 0) {
      finishWin(next, rng);
      return next;
    }
  }

  // Ход врага: детерминированно выбирает первое действие с максимальным power.
  const chosen = strongestAction(next.enemyActions);
  const power = chosen ? chosen.power : next.enemy.atk;
  const label = chosen ? chosen.name : "контратака";

  // Цель: равновероятно герой или живой союзник (без союзников — всегда герой).
  const targets: Fighter[] = [hero];
  for (const ally of next.allies) {
    if (ally.hp > 0) targets.push(ally);
  }
  const target = targets.length > 1 ? (targets[Math.floor(rng() * targets.length)] ?? hero) : hero;
  const heroDef = target === hero ? hero.def + (next.defending ? DEFEND_DEF_BONUS : 0) : target.def;
  const dmg = damage(power, heroDef);
  target.hp = Math.max(0, target.hp - dmg);
  next.log.push(
    `${enemy.name} — ${label}: ${dmg} урона (${target.name}: ${target.hp}/${target.maxHp})`,
  );

  // Поражение — только выведенный из строя герой; союзник просто выбывает.
  if (target === hero && hero.hp <= 0) {
    next.outcome = "lose";
    next.log.push(`${hero.name} выведен из строя`);
    return next;
  }
  if (target !== hero && target.hp <= 0) {
    next.log.push(`${target.name} выбывает из боя`);
  }

  next.turn += 1;
  return next;
}

/** Победа: лог, ролл трофеев (это делает app через awardXp/addItem). */
function finishWin(next: CombatState, rng: () => number): void {
  next.outcome = "win";
  next.log.push(`${next.enemy.name} повержен`);
  for (const drop of next.enemyLoot) {
    if (rng() < drop.chance) {
      next.loot.push(drop.item);
      next.log.push(`Трофей: ${drop.item}`);
    }
  }
}

/** Первое действие с максимальным power (порядок контента решает ничьи). */
function strongestAction(actions: readonly EnemyAction[]): EnemyAction | undefined {
  let best: EnemyAction | undefined;
  for (const action of actions) {
    if (!best || action.power > best.power) best = action;
  }
  return best;
}
