// Observable-стор без фреймворков. Реализует контракт Store<S> из src/types.ts.
import type { Store } from "../types";

/** Structural copy: рекурсивная копия plain-объектов/массивов (стейт — чистый JSON). */
function structuralClone<T>(value: T): T {
  if (Array.isArray(value)) return value.map(structuralClone) as T;
  if (value !== null && typeof value === "object") {
    const copy: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) copy[key] = structuralClone(item);
    return copy as T;
  }
  return value;
}

/**
 * Инварианты (docs/CONTRACTS.md, «Store»):
 * - `get()` — снимок; после каждого `update` ссылка стейта меняется;
 * - подписчик, добавленный во время нотификации, текущую волну не получает;
 * - `update` внутри нотификации меняет стейт, но не запускает вложенную волну.
 */
export function createStore<S>(initial: S): Store<S> {
  let state = initial;
  const subscribers = new Set<(s: S) => void>();
  let notifying = false;

  return {
    get: () => state,

    update(fn: (draft: S) => void): void {
      const draft = structuralClone(state);
      fn(draft);
      state = draft;
      if (notifying) return;
      notifying = true;
      try {
        for (const subscriber of [...subscribers]) subscriber(state);
      } finally {
        notifying = false;
      }
    },

    subscribe(fn: (s: S) => void): () => void {
      subscribers.add(fn);
      return () => {
        subscribers.delete(fn);
      };
    },
  };
}
