// Схема района для вкладки «Карта» меню паузы. Модель (buildMapModel) — чистая
// функция над сейвом и контентом (покрыта тестами), рендер — тонкая DOM-обёртка
// без зависимостей от Babylon. Узлы расставлены по сторонам света дверей
// (world/layout.ts), рёбра — из exits локаций, блокировка — isExitOpen.
import type { IContentProvider } from "../content";
import { containerOpenedFlag, isContainerVisible } from "../systems/containers";
import type { GameState } from "../types";
import { allLocations, isExitOpen, LOCATION_IDS, LOCATION_TITLES } from "../world";

/** Позиции центров узлов схемы (viewBox 460 × 320). */
const NODE_POS: Readonly<Record<string, { x: number; y: number }>> = {
  apartment: { x: 85, y: 60 },
  campus: { x: 130, y: 160 },
  hospital: { x: 52, y: 260 },
  square: { x: 230, y: 160 },
  pharmacy: { x: 230, y: 60 },
  workshop: { x: 370, y: 160 },
  "metro-station": { x: 230, y: 260 },
};

export interface MapNode {
  id: string;
  title: string;
  x: number;
  y: number;
  here: boolean;
  /** Имена НПС, присутствующих в локации в текущей фазе мира. */
  npcs: string[];
  /** Видимые и ещё не открытые контейнеры локации. */
  lootables: number;
  /** Названия активных квестов, ведущих в локацию (quest.targetLocation). */
  quests: string[];
}

export interface MapEdge {
  from: string;
  to: string;
  /** Проход работает в обе стороны (двусторонность — контракт топологии). */
  open: boolean;
}

export interface MapModel {
  nodes: MapNode[];
  edges: MapEdge[];
  /** Куда доступно быстрое перемещение: открытые проходы, без текущей локации. */
  travel: string[];
}
/** Названия активных квестов, чья цель — локация (Quest.targetLocation). */
function questTitlesAt(state: GameState, content: IContentProvider, location: string): string[] {
  const titles: string[] = [];
  for (const [id, qs] of Object.entries(state.questStates)) {
    if (qs.status !== "active") continue;
    const quest = content.getQuest(id);
    if (quest.targetLocation === location) titles.push(quest.title);
  }
  return titles;
}

export function buildMapModel(state: GameState, content: IContentProvider): MapModel {
  const nodes: MapNode[] = LOCATION_IDS.map((id) => {
    const pos = NODE_POS[id];
    if (!pos) throw new Error(`Карта: нет позиции узла для локации "${id}"`);
    return {
      id,
      title: LOCATION_TITLES[id] ?? id,
      x: pos.x,
      y: pos.y,
      here: state.location === id,
      npcs: content.npcsAt(id, state.worldPhase).map((npc) => npc.name),
      lootables: content
        .containersAt(id)
        .filter(
          (container) =>
            isContainerVisible(container, state) &&
            state.flags[containerOpenedFlag(container.id)] !== true,
        ).length,
      quests: questTitlesAt(state, content, id),
    };
  });
  // Выходы двусторонние (tests/world/topology.test.ts): каждое ребро встречается
  // в exits с обеих сторон — оставляем по одному экземпляру на пару.
  const edges: MapEdge[] = [];
  const seen = new Set<string>();
  for (const loc of allLocations) {
    for (const exit of loc.exits) {
      const key = [loc.id, exit.to].sort().join("<>");
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({
        from: loc.id,
        to: exit.to,
        open:
          isExitOpen(loc.id, exit.to, state.worldPhase) &&
          isExitOpen(exit.to, loc.id, state.worldPhase),
      });
    }
  }
  return { nodes, edges, travel: reachable(edges, state.location) };
}

/** BFS по открытым проходам от текущей локации: куда можно попасть не пешком. */
function reachable(edges: readonly MapEdge[], from: string): string[] {
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    if (!edge.open) continue;
    for (const pair of [[edge.from, edge.to] as const, [edge.to, edge.from] as const]) {
      const [a, b] = pair;
      adjacency.set(a, [...(adjacency.get(a) ?? []), b]);
    }
  }
  const visited = new Set([from]);
  const queue = [from];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const next of adjacency.get(current) ?? []) {
      if (visited.has(next)) continue;
      visited.add(next);
      queue.push(next);
    }
  }
  return [...visited].filter((id) => id !== from);
}

// ─── Рендер (DOM, тестами не покрыт — как остальной UI) ──────────────────────

const SVG_NS = "http://www.w3.org/2000/svg";
const NODE_W = 92;
const NODE_H = 22;
const MARKER_STEP = 13;

function svgEl(tag: string, attrs: Record<string, string | number>, parent?: Element): SVGElement {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  parent?.append(node);
  return node;
}

/** Строки-маркеры под названием узла: кто там, что обыскать, куда ведёт квест. */
function markerLines(node: MapNode): string[] {
  const lines: string[] = [];
  if (node.npcs.length > 0) lines.push(node.npcs.join(", "));
  if (node.lootables > 0) lines.push(`обыскать ×${node.lootables}`);
  for (const quest of node.quests) lines.push(`квест: ${quest}`);
  return lines;
}

export function renderMapSVG(model: MapModel): SVGSVGElement {
  const svg = svgEl("svg", { viewBox: `0 0 460 320`, class: "ui-map" }) as SVGSVGElement;
  const pos = new Map(model.nodes.map((node) => [node.id, node] as const));
  for (const edge of model.edges) {
    const a = pos.get(edge.from);
    const b = pos.get(edge.to);
    if (!a || !b) continue;
    svgEl(
      "line",
      {
        x1: a.x,
        y1: a.y,
        x2: b.x,
        y2: b.y,
        class: "ui-map-edge" + (edge.open ? "" : " ui-map-edge--closed"),
      },
      svg,
    );
  }
  for (const node of model.nodes) {
    const group = svgEl(
      "g",
      { class: "ui-map-node" + (node.here ? " ui-map-node--here" : "") },
      svg,
    );
    svgEl(
      "rect",
      { x: node.x - NODE_W / 2, y: node.y - NODE_H / 2, width: NODE_W, height: NODE_H, rx: 6 },
      group,
    );
    svgEl(
      "text",
      { x: node.x, y: node.y + 4, "text-anchor": "middle", class: "ui-map-node-title" },
      group,
    ).textContent = node.title;
    markerLines(node).forEach((line, index) => {
      svgEl(
        "text",
        {
          // слева от края блока: длинные «квест: …» не вылезают за viewBox
          x: node.x - NODE_W / 2,
          y: node.y + NODE_H / 2 + 12 + index * MARKER_STEP,
          "text-anchor": "start",
          class: "ui-map-marker",
        },
        group,
      ).textContent = line;
    });
  }
  return svg;
}
