import { describe, expect, it, vi } from "vitest";
import { Trie, type WildcardSegment, w } from "../src/index.ts";

async function collect<T>(input: AsyncIterable<T>) {
  const values: T[] = [];
  for await (const value of input) values.push(value);
  return values;
}

function deferred() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

describe("wildcard deletion", () => {
  it.each([false, true])(
    "keeps ordinary siblings (async: %s)",
    async (asyncMode) => {
      const trie = new Trie<number | string, string>([
        [[w()], "short"],
        [[w(), "x"], "keep"],
        [[w(2)], "long"],
      ]);
      if (asyncMode) await trie.delete([w()]);
      else trie.deleteSync([w()]);
      expect(trie.size).toBe(2);
      expect(trie.getSync([w(), "x"])).toBe("keep");
      expect(trie.getSync([w(2)])).toBe("long");
      expect([...trie.matchSync([0, "x"])]).toEqual(["long", "keep"]);
    },
  );

  it("keeps siblings while pruning a different ordinary branch", () => {
    const trie = new Trie<number | string, string>([
      [[w(), "x"], "remove"],
      [[w(), "y"], "keep"],
      [[w(2)], "long"],
    ]);
    expect(trie.deleteSync([w(), "x"])).toBe(true);
    expect(trie.getSync([w(), "y"])).toBe("keep");
    expect(trie.getSync([w(2)])).toBe("long");
    expect(trie.size).toBe(2);
  });
});

describe("mutation commits", () => {
  it("re-resolves synchronous callback writes after reentrant mutations", () => {
    const trie = new Trie<number, string>();
    trie.setCallbackSync([1], () => {
      trie.setSync([1], "inner");
      return "outer";
    });
    expect(trie.size).toBe(1);
    trie.setCallbackSync([1], () => {
      trie.clear();
      return "after clear";
    });
    expect(trie.getSync([1])).toBe("after clear");
    expect(trie.size).toBe(1);
  });

  it("does not overwrite a branch inserted while a path is suspended", async () => {
    const ready = deferred();
    const gate = deferred();
    const trie = new Trie<string, string>();
    async function* path() {
      yield w(5);
      ready.release();
      await gate.promise;
      yield "a";
    }
    const pending = trie.set(path(), "A");
    await ready.promise;
    await trie.set([w(3), "b"], "B");
    gate.release();
    await pending;
    expect(trie.getSync([w(5), "a"])).toBe("A");
    expect(trie.getSync([w(3), "b"])).toBe("B");
    expect(trie.size).toBe(2);
  });

  it("resolves a pending set against the tree after clear", async () => {
    const ready = deferred();
    const gate = deferred();
    const trie = new Trie<number, string>();
    async function* path() {
      yield 1;
      ready.release();
      await gate.promise;
    }
    const pending = trie.set(path(), "value");
    await ready.promise;
    trie.clear();
    gate.release();
    await pending;
    expect(trie.getSync([1])).toBe("value");
    expect(trie.size).toBe(1);
  });

  it("does not mutate the tree when a path rejects", async () => {
    const trie = new Trie<number, string>([[[w(2)], "keep"]]);
    async function* path() {
      yield w();
      throw new Error("path failed");
    }
    await expect(trie.set(path(), "lost")).rejects.toThrow("path failed");
    expect(trie.getSync([w(2)])).toBe("keep");
    expect(trie.hasSync([w()])).toBe(false);
    expect(trie.size).toBe(1);
  });

  it("counts overlapping callbacks once and commits in completion order", async () => {
    const firstGate = deferred();
    const secondGate = deferred();
    const firstReady = deferred();
    const secondReady = deferred();
    const trie = new Trie<number, string>();
    const first = trie.setCallback([1], async (previous, exists) => {
      expect(previous).toBeUndefined();
      expect(exists).toBe(false);
      firstReady.release();
      await firstGate.promise;
      return "first";
    });
    const second = trie.setCallback([1], async () => {
      secondReady.release();
      await secondGate.promise;
      return "second";
    });
    await Promise.all([firstReady.promise, secondReady.promise]);
    secondGate.release();
    await second;
    firstGate.release();
    await first;
    expect(trie.getSync([1])).toBe("first");
    expect(trie.size).toBe(1);
  });

  it("re-resolves a callback path after its old node is removed", async () => {
    const ready = deferred();
    const gate = deferred();
    const trie = new Trie<number, string>([[[1], "before"]]);
    const pending = trie.setCallback([1], async (value) => {
      expect(value).toBe("before");
      ready.release();
      await gate.promise;
      return "after";
    });
    await ready.promise;
    trie.deleteSync([1]);
    gate.release();
    await pending;
    expect(trie.getSync([1])).toBe("after");
    expect(trie.size).toBe(1);
  });

  it("does not decrement size twice for overlapping deletes", async () => {
    const trie = new Trie<number, string>([[[1], "value"]]);
    const results = await Promise.all([trie.delete([1]), trie.delete([1])]);
    expect(results).toEqual([true, false]);
    expect(trie.size).toBe(0);
  });
});

describe("matching order and inputs", () => {
  it("accepts primitive strings in both APIs", async () => {
    const trie = new Trie<string, string>([["abc", "value"]]);
    expect([...trie.matchSync("abcd")]).toEqual(["value"]);
    expect(await collect(trie.match("abcd"))).toEqual(["value"]);
  });

  it("supports deep literal paths without recursive delegation", async () => {
    const path = Array<number>(20_000).fill(1);
    const trie = new Trie<number, string>([[path, "deep"]]);
    expect([...trie.matchSync(path)]).toEqual(["deep"]);
    expect(await collect(trie.match(path))).toEqual(["deep"]);
  });

  it("replays nested alternatives in wildcard-first order", async () => {
    const trie = new Trie<number, string>([
      [[], "empty"],
      [[1], "literal prefix"],
      [[1, 2], "literal"],
      [[w()], "wildcard prefix"],
      [[w(), 2], "wildcard literal"],
      [[w(3)], "long wildcard"],
      [[1, w(2)], "literal wildcard"],
    ]);
    const expected = [
      "empty",
      "wildcard prefix",
      "long wildcard",
      "wildcard literal",
      "literal prefix",
      "literal wildcard",
      "literal",
    ];
    expect([...trie.matchSync([1, 2, 3])]).toEqual(expected);
    expect(await collect(trie.match([1, 2, 3]))).toEqual(expected);
  });

  it("preserves duplicate and undefined values", async () => {
    const trie = new Trie<number, string | undefined>([
      [[], undefined],
      [[w()], "same"],
      [[1], "same"],
    ]);
    expect([...trie.matchSync([1])]).toEqual([undefined, "same", "same"]);
    expect(await collect(trie.match([1]))).toEqual([undefined, "same", "same"]);
  });

  it("preserves object identity, symbols and SameValueZero keys", async () => {
    const object = {};
    const symbol = Symbol("user");
    const trie = new Trie<unknown, string>([
      [[object, symbol, Number.NaN], "value"],
    ]);
    expect([...trie.matchSync([object, symbol, Number.NaN])]).toEqual([
      "value",
    ]);
    expect(await collect(trie.match([object, symbol, Number.NaN]))).toEqual([
      "value",
    ]);
    expect([...trie.matchSync([{}, symbol, Number.NaN])]).toEqual([]);
  });
});

describe("input iterator ownership", () => {
  it.each(["complete", "break", "miss"])(
    "closes synchronous input on %s",
    (mode) => {
      const close = vi.fn();
      let reads = 0;
      function* input() {
        try {
          for (const item of [1, 2, 3]) {
            reads++;
            yield item;
          }
        } finally {
          close();
        }
      }
      const trie = new Trie<number, string>([
        [[mode === "miss" ? 9 : 1], "value"],
      ]);
      for (const _ of trie.matchSync(input())) {
        if (mode === "break") break;
      }
      expect(close).toHaveBeenCalledOnce();
      expect(reads).toBe(1);
    },
  );

  it.each(["complete", "break", "miss"])(
    "closes asynchronous input on %s",
    async (mode) => {
      const close = vi.fn();
      let reads = 0;
      async function* input() {
        try {
          for (const item of [1, 2, 3]) {
            reads++;
            yield item;
          }
        } finally {
          close();
        }
      }
      const trie = new Trie<number, string>([
        [[mode === "miss" ? 9 : 1], "value"],
      ]);
      for await (const _ of trie.match(input())) {
        if (mode === "break") break;
      }
      expect(close).toHaveBeenCalledOnce();
      expect(reads).toBe(1);
    },
  );

  it("closes the shared source when an alternative has not been visited", () => {
    const close = vi.fn();
    function* input() {
      try {
        yield* [1, 2, 3, 4];
      } finally {
        close();
      }
    }
    const trie = new Trie<number, string>([
      [[w(3)], "long"],
      [[1], "short"],
    ]);
    for (const _ of trie.matchSync(input())) break;
    expect(close).toHaveBeenCalledOnce();
  });

  it.each([false, true])(
    "does not call return after source exhaustion (async: %s)",
    async (asyncMode) => {
      const close = vi.fn();
      const input = {
        next: () => ({ done: true as const, value: undefined }),
        return: close,
      };
      const trie = new Trie<number, string>([[[w(2)], "value"]]);
      if (asyncMode)
        await collect(
          trie.match({
            [Symbol.asyncIterator]: () => ({
              next: async () => input.next(),
              return: async () => {
                close();
                return { done: true as const, value: undefined };
              },
            }),
          }),
        );
      else
        expect([...trie.matchSync({ [Symbol.iterator]: () => input })]).toEqual(
          [],
        );
      expect(close).not.toHaveBeenCalled();
    },
  );

  it("propagates input failures and closes the iterator", async () => {
    const close = vi.fn(async () => ({
      done: true as const,
      value: undefined,
    }));
    const input = {
      next: async () => {
        throw new Error("read failed");
      },
      return: close,
      [Symbol.asyncIterator]() {
        return this;
      },
    };
    await expect(
      collect(new Trie<number, string>([[[1], "value"]]).match(input)),
    ).rejects.toThrow("read failed");
    expect(close).toHaveBeenCalledOnce();
  });
});

it("matches a reference model across seeded insertion/deletion sequences", async () => {
  type Token = number | "*";
  type Rule = { tokens: Token[]; value: number };
  let seed = 123456789;
  function random(max: number) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return Math.floor((seed / 2 ** 32) * max);
  }
  function compare(a: Rule, b: Rule) {
    for (let i = 0; i < Math.min(a.tokens.length, b.tokens.length); i++) {
      if (a.tokens[i] === b.tokens[i]) continue;
      return a.tokens[i] === "*" ? -1 : 1;
    }
    return a.tokens.length - b.tokens.length;
  }
  const trie = new Trie<number, number>();
  const model = new Map<string, Rule>();
  for (let operation = 0; operation < 400; operation++) {
    const path: (number | WildcardSegment)[] = [];
    const tokens: Token[] = [];
    for (let i = 0, length = random(6); i < length; i++) {
      if (random(3) === 0) {
        const count = random(4) + 1;
        path.push(w(count));
        tokens.push(...Array<Token>(count).fill("*"));
      } else {
        const value = random(3);
        path.push(value);
        tokens.push(value);
      }
    }
    const key = JSON.stringify(tokens);
    if (random(3) === 0) {
      expect(trie.deleteSync(path)).toBe(model.delete(key));
    } else {
      trie.setSync(path, operation);
      model.set(key, { tokens, value: operation });
    }
    expect(trie.size).toBe(model.size);
    const input = Array.from({ length: random(12) }, () => random(3));
    const expected = [...model.values()]
      .filter(
        ({ tokens: pattern }) =>
          pattern.length <= input.length &&
          pattern.every(
            (token, index) => token === "*" || token === input[index],
          ),
      )
      .sort(compare)
      .map(({ value }) => value);
    expect([...trie.matchSync(input)]).toEqual(expected);
    expect(await collect(trie.match(input))).toEqual(expected);
    if (operation % 20 === 0) {
      for (const rule of model.values()) {
        const storedPath = rule.tokens.map((token) =>
          token === "*" ? w() : token,
        );
        expect(trie.getSync(storedPath)).toBe(rule.value);
      }
    }
  }
});
