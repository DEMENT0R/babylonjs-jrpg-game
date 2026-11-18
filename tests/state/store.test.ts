import { describe, expect, it, vi } from "vitest";
import { createStore } from "../../src/state/store";

interface TestState {
  count: number;
  items: string[];
}

function makeState(): TestState {
  return { count: 0, items: ["a"] };
}

describe("createStore", () => {
  it("get возвращает снимок текущего состояния", () => {
    const initial = makeState();
    const store = createStore(initial);
    expect(store.get()).toBe(initial);
    expect(store.get()).toEqual({ count: 0, items: ["a"] });
  });

  it("update мутирует драфт, меняет ссылку и не трогает прежнее состояние", () => {
    const store = createStore(makeState());
    const before = store.get();
    store.update((draft) => {
      draft.count = 7;
      draft.items.push("b");
    });
    expect(store.get()).toEqual({ count: 7, items: ["a", "b"] });
    expect(store.get()).not.toBe(before);
    expect(before).toEqual({ count: 0, items: ["a"] });
  });

  it("update нотифицирует подписчиков новым состоянием", () => {
    const store = createStore(makeState());
    const listener = vi.fn();
    store.subscribe(listener);
    store.update((draft) => {
      draft.count = 1;
    });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(store.get());
  });

  it("отписка прекращает уведомления", () => {
    const store = createStore(makeState());
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    unsubscribe();
    store.update((draft) => {
      draft.count = 1;
    });
    expect(listener).not.toHaveBeenCalled();
  });

  it("подписчик, добавленный во время нотификации, не получает текущую волну", () => {
    const store = createStore(makeState());
    const late = vi.fn();
    store.subscribe(() => {
      store.subscribe(late);
    });
    store.update((draft) => {
      draft.count = 1;
    });
    expect(late).not.toHaveBeenCalled();
    store.update((draft) => {
      draft.count = 2;
    });
    expect(late).toHaveBeenCalledTimes(1);
  });

  it("update внутри нотификации не запускает вложенную волну", () => {
    const store = createStore(makeState());
    const outer = vi.fn(() => {
      store.update((draft) => {
        draft.count += 10;
      });
    });
    const inner = vi.fn();
    store.subscribe(outer);
    store.subscribe(inner);
    store.update((draft) => {
      draft.count = 1;
    });
    expect(outer).toHaveBeenCalledTimes(1);
    expect(inner).toHaveBeenCalledTimes(1);
    expect(inner).toHaveBeenCalledWith(store.get());
    expect(store.get().count).toBe(11);
  });
});
