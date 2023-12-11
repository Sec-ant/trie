type AnyIterable<T> = Iterable<T> | AsyncIterable<T>;

const dataSymbol = Symbol();
const wildcardSymbol = Symbol();
const wildcardCountSymbol = Symbol();

type DataSymbol = typeof dataSymbol;
type WildcardSymbol = typeof wildcardSymbol;
type WildcardCountSymbol = typeof wildcardCountSymbol;

type Node<I, V> = Map<I, Node<I, V>> &
  Map<WildcardSymbol, CountNode<I, V>> &
  Map<DataSymbol, V>;

type CountNode<I, V> = Map<WildcardCountSymbol, number> & Node<I, V>;

interface SeekContext {
  nodeWildcardCount: number;
  pathWildcardCount: number;
}

export type WildcardSegment = WeakMap<typeof wildcardSymbol, number>;

export function w(count = 1): WildcardSegment {
  if (Number.isSafeInteger(count) && count > 0) {
    return new WeakMap([[wildcardSymbol, count]]);
  } else {
    console.warn(`Invalid wildcard count: ${count}, fallback to 1.`);
    return new WeakMap([[wildcardSymbol, 1]]);
  }
}

export class Trie<I, V> {
  #root: Node<I, V> = new Map();
  #size = 0;
  async add(
    initialEntries: AnyIterable<[AnyIterable<I | WildcardSegment>, V]> = [],
  ) {
    for await (const [key, value] of initialEntries) {
      await this.set(key, value);
    }
  }
  addSync(initialEntries: Iterable<[Iterable<I | WildcardSegment>, V]> = []) {
    for (const [key, value] of initialEntries) {
      this.setSync(key, value);
    }
  }
  #hardSeekImpl(
    node: Node<I, V>,
    segment: I | WildcardSegment,
    seekContext: SeekContext,
  ) {
    if (!isWildcardSegment(segment)) {
      // TODO: we should check here
      let childNode = node.get(segment);
      if (!childNode) {
        childNode = new Map();
        node.set(segment, childNode);
      }
      return childNode;
    }
    seekContext.pathWildcardCount += segment.get(wildcardSymbol) ?? 1;
    while (node.has(wildcardSymbol)) {
      const childNode = node.get(wildcardSymbol)!;
      seekContext.nodeWildcardCount += childNode.get(wildcardCountSymbol) ?? 1;
      if (seekContext.nodeWildcardCount === seekContext.pathWildcardCount) {
        return childNode;
      }
      if (seekContext.nodeWildcardCount < seekContext.pathWildcardCount) {
        node = childNode;
        continue;
      }
      // TODO: we do not check here
      const diffCount =
        seekContext.nodeWildcardCount - seekContext.pathWildcardCount;
      const newChildNode = new Map() as CountNode<I, V>;
      newChildNode.set(
        wildcardCountSymbol,
        childNode.get(wildcardCountSymbol)! - diffCount,
      );
      childNode.set(wildcardCountSymbol, diffCount);
      node.set(wildcardSymbol, newChildNode);
      newChildNode.set(wildcardSymbol, childNode);
      return newChildNode;
    }
    if (seekContext.nodeWildcardCount >= seekContext.pathWildcardCount) {
      return node;
    }
    const diffCount =
      seekContext.pathWildcardCount - seekContext.nodeWildcardCount;
    const childNode = new Map() as CountNode<I, V>;
    childNode.set(wildcardCountSymbol, diffCount);
    node.set(wildcardSymbol, childNode);
    return childNode;
  }
  async #hardSeek(path: AnyIterable<I | WildcardSegment>) {
    let node = this.#root;
    const seekContext: SeekContext = {
      nodeWildcardCount: 0,
      pathWildcardCount: 0,
    };
    for await (const segment of path) {
      node = this.#hardSeekImpl(node, segment, seekContext);
    }
    if (seekContext.nodeWildcardCount === seekContext.pathWildcardCount) {
      return node;
    }
    // TODO: and check here
    if (seekContext.nodeWildcardCount > seekContext.pathWildcardCount) {
      assumeAs<CountNode<I, V>>(node);
      const diffCount =
        seekContext.nodeWildcardCount - seekContext.pathWildcardCount;
      const newChildNode = new Map() as CountNode<I, V>;
      newChildNode.set(
        wildcardCountSymbol,
        node.get(wildcardCountSymbol)! - diffCount,
      );
      childNode.set(wildcardCountSymbol, diffCount);
      node.set(wildcardSymbol, newChildNode);
      newChildNode.set(wildcardSymbol, childNode);
      return newChildNode;
    }
  }
  async set(path: AnyIterable<I | WildcardSegment>, value: V) {
    const exists = node.has(dataSymbol);
    node.set(dataSymbol, value);
    if (!exists) {
      ++this.#size;
    }
    return this;
  }
  setSync(path: Iterable<I | WildcardSegment>, value: V) {
    let node = this.#root;
    for (const segment of path) {
      node = this.#hardSeek(node, segment);
    }
    const exists = node.has(dataSymbol);
    node.set(dataSymbol, value);
    if (!exists) {
      ++this.#size;
    }
    return this;
  }
  async setCallback(
    path: AnyIterable<I | WildcardSegment>,
    callback: (prev: V | undefined, exists: boolean) => V | Promise<V>,
  ) {
    let node = this.#root;
    for await (const segment of path) {
      node = this.#hardSeek(node, segment);
    }
    const exists = node.has(dataSymbol);
    node.set(dataSymbol, await callback(node.get(dataSymbol), exists));
    if (!exists) {
      ++this.#size;
    }
    return this;
  }
  setCallbackSync(
    path: Iterable<I | WildcardSegment>,
    callback: (prev: V | undefined, exists: boolean) => V,
  ) {
    let node = this.#root;
    for (const segment of path) {
      node = this.#hardSeek(node, segment);
    }
    const exists = node.has(dataSymbol);
    node.set(dataSymbol, callback(node.get(dataSymbol), exists));
    if (!exists) {
      ++this.#size;
    }
    return this;
  }
  #softSeekImpl(
    node: Node<I, V>,
    segment: I | WildcardSegment,
    seekContext: SeekContext,
    stack?: [I | WildcardSegment, Node<I, V>][],
  ) {
    if (!isWildcardSegment(segment)) {
      const childNode = node.get(segment);
      if (!childNode) {
        stack?.splice(0, stack.length);
        return undefined;
      }
      stack?.unshift([segment, node]);
      return childNode;
    }
    seekContext.pathWildcardCount += segment.get(wildcardSymbol) ?? 1;
    while (
      node.has(wildcardSymbol) &&
      seekContext.nodeWildcardCount < seekContext.pathWildcardCount
    ) {
      const childNode = node.get(wildcardSymbol)!;
      seekContext.nodeWildcardCount += childNode.get(wildcardCountSymbol) ?? 1;
      stack?.unshift([segment, node]);
      node = childNode;
    }
    return node;
  }
  async #softSeek(
    path: AnyIterable<I | WildcardSegment>,
    stack?: [I | WildcardSegment, Node<I, V>][],
  ) {
    let node = this.#root;
    const seekContext: SeekContext = {
      nodeWildcardCount: 0,
      pathWildcardCount: 0,
    };
    for await (const segment of path) {
      const childNode = this.#softSeekImpl(node, segment, seekContext, stack);
      if (!childNode) {
        return undefined;
      }
      node = childNode;
    }
    if (seekContext.nodeWildcardCount !== seekContext.pathWildcardCount) {
      stack?.splice(0, stack.length);
      return undefined;
    }
    return node;
  }
  #softSeekSync(
    path: Iterable<I | WildcardSegment>,
    stack?: [I | WildcardSegment, Node<I, V>][],
  ) {
    let node = this.#root;
    const seekContext: SeekContext = {
      nodeWildcardCount: 0,
      pathWildcardCount: 0,
    };
    for (const segment of path) {
      const childNode = this.#softSeekImpl(node, segment, seekContext, stack);
      if (!childNode) {
        return undefined;
      }
      node = childNode;
    }
    if (seekContext.nodeWildcardCount !== seekContext.pathWildcardCount) {
      stack?.splice(0, stack.length);
      return undefined;
    }
    return node;
  }
  async has(path: AnyIterable<I | WildcardSegment>) {
    return Boolean(await this.#softSeek(path));
  }
  hasSync(path: Iterable<I | WildcardSegment>) {
    return Boolean(this.#softSeekSync(path));
  }
  async get(path: AnyIterable<I | WildcardSegment>) {
    return (await this.#softSeek(path))?.get(dataSymbol);
  }
  getSync(path: Iterable<I | WildcardSegment>) {
    return this.#softSeekSync(path)?.get(dataSymbol);
  }
  // async delete(path: AnyIterable<I | WildcardSegment>) {
  //   const stack: [I, Node<I, V>][] = [];
  //   const node = await this.#seek(path, stack);
  //   if (!node) {
  //     return false;
  //   }
  //   node.delete(dataSymbol);
  //   --this.#size;
  //   if (node.size) {
  //     return true;
  //   }
  //   for (const [segment, node] of stack) {
  //     node.delete(segment);
  //     if (node.size) {
  //       return true;
  //     }
  //   }
  //   return true;
  // }
  // deleteSync(path: Iterable<I | WildcardSegment>) {
  //   const stack: [I, Node<I, V>][] = [];
  //   const node = this.#seekSync(path, stack);
  //   if (!node) {
  //     return false;
  //   }
  //   node.delete(dataSymbol);
  //   --this.#size;
  //   if (node.size) {
  //     return true;
  //   }
  //   for (const [segment, node] of stack) {
  //     node.delete(segment);
  //     if (node.size) {
  //       return true;
  //     }
  //   }
  //   return true;
  // }
  clear() {
    this.#root.clear();
    this.#size = 0;
    return;
  }
  // async *#branchOut(
  //   node: Node<I | WildcardSegment, V>,
  //   pathIterator: AsyncIterator<I> | Iterator<I>,
  // ): AsyncGenerator<V | undefined, void, unknown> {
  //   // yield data
  //   if (node.has(dataSymbol)) {
  //     yield node.get(dataSymbol);
  //   }
  //   const { value, done } = await pathIterator.next();
  //   if (done) {
  //     return;
  //   }
  //   // find matched node
  //   const nextNodeWildcard = node.get(Wildcard);
  //   const nextNodeExact = node.get(value);
  //   // wildcard match only
  //   if (nextNodeWildcard && !nextNodeExact) {
  //     yield* this.#branchOut(nextNodeWildcard, pathIterator);
  //   }
  //   // exact match only
  //   else if (!nextNodeWildcard && nextNodeExact) {
  //     yield* this.#branchOut(nextNodeExact, pathIterator);
  //   }
  //   // both, we need to tee the path iterator
  //   else if (nextNodeWildcard && nextNodeExact) {
  //     const [pathIterator1, pathIterator2] = teeIterator(pathIterator);
  //     yield* this.#branchOut(nextNodeWildcard, pathIterator2);
  //     yield* this.#branchOut(nextNodeExact, pathIterator1);
  //   }
  //   // none
  //   else {
  //     return;
  //   }
  // }
  // *#branchOutSync(
  //   node: Node<I | WildcardSegment, V>,
  //   pathIterator: Iterator<I>,
  // ): Generator<V | undefined, void, unknown> {
  //   // yield data
  //   if (node.has(dataSymbol)) {
  //     yield node.get(dataSymbol);
  //   }
  //   const { value, done } = pathIterator.next();
  //   if (done) {
  //     return;
  //   }
  //   // find matched node
  //   const nextNodeWildcard = node.get(Wildcard);
  //   const nextNodeExact = node.get(value);
  //   // wildcard match only
  //   if (nextNodeWildcard && !nextNodeExact) {
  //     yield* this.#branchOutSync(nextNodeWildcard, pathIterator);
  //   }
  //   // exact match only
  //   else if (!nextNodeWildcard && nextNodeExact) {
  //     yield* this.#branchOutSync(nextNodeExact, pathIterator);
  //   }
  //   // both, we need to tee the path iterator
  //   else if (nextNodeWildcard && nextNodeExact) {
  //     const [pathIterator1, pathIterator2] = teeIteratorSync(pathIterator);
  //     yield* this.#branchOutSync(nextNodeWildcard, pathIterator2);
  //     yield* this.#branchOutSync(nextNodeExact, pathIterator1);
  //   }
  //   // none
  //   else {
  //     return;
  //   }
  // }
  // async *find(path: AnyIterable<I>) {
  //   const pathIterator =
  //     Symbol.asyncIterator in path
  //       ? path[Symbol.asyncIterator]()
  //       : path[Symbol.iterator]();
  //   yield* this.#branchOut(this.#rootNode, pathIterator);
  // }
  // *findSync(path: Iterable<I>) {
  //   const pathIterator = path[Symbol.iterator]();
  //   yield* this.#branchOutSync(this.#rootNode, pathIterator);
  // }
  get size() {
    return this.#size;
  }
  readonly [Symbol.toStringTag] = "Trie";
}

/**
 * Like ReadableStream.tee(), but for iterators.
 * https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream/tee
 *
 * See: MattiasBuelens/web-streams-polyfill#80
 */

export function teeIterator<T>(iterator: AsyncIterator<T> | Iterator<T>) {
  interface LinkedListNode<T> {
    value: T;
    next: LinkedListNode<T> | undefined;
  }
  // A linked list of enqueued chunks. (The first node has no value.)
  let buffer: LinkedListNode<T> = {
    value: undefined!,
    next: undefined,
  };
  // Which branches have already been closed.
  const closed: [boolean, boolean] = [false, false];
  // Whether we're currently reading from the source.
  let reading = false;
  // Whether the source stream has closed.
  let done = false;
  // A promise for the current read (if reading is true).
  let currentRead: Promise<void> | undefined;

  async function next(): Promise<void> {
    reading = true;
    const result = await iterator.next();
    if (result.done) {
      done = true;
    } else {
      const nextNode: LinkedListNode<T> = {
        value: result.value,
        next: undefined,
      };
      buffer.next = nextNode;
      buffer = nextNode;
    }
    reading = false;
  }

  async function* branch(i: 0 | 1, branchBuffer: LinkedListNode<T>) {
    try {
      while (true) {
        if (branchBuffer.next) {
          branchBuffer = branchBuffer.next;
          yield branchBuffer.value;
        } else if (done) {
          return;
        } else {
          if (!reading) {
            currentRead = next();
          }
          await currentRead;
        }
      }
    } finally {
      closed[i] = true;
      // Close source iterator if both branches are closed
      // Important: don't call return() if next() returned {done: true}!
      if (!done && closed[1 - i]) {
        await iterator.return?.();
      }
    }
  }

  return [branch(0, buffer), branch(1, buffer)] as const;
}

export function teeIteratorSync<T>(iterator: Iterator<T>) {
  interface LinkedListNode<T> {
    value: T;
    next: LinkedListNode<T> | undefined;
  }
  // A linked list of enqueued chunks. (The first node has no value.)
  let buffer: LinkedListNode<T> = {
    value: undefined!,
    next: undefined,
  };
  // Which branches have already been closed.
  const closed: [boolean, boolean] = [false, false];
  // Whether the source stream has closed.
  let done = false;

  function next() {
    const result = iterator.next();
    if (result.done) {
      done = true;
    } else {
      const nextNode: LinkedListNode<T> = {
        value: result.value,
        next: undefined,
      };
      buffer.next = nextNode;
      buffer = nextNode;
    }
  }

  function* branch(i: 0 | 1, branchBuffer: LinkedListNode<T>) {
    try {
      while (true) {
        if (branchBuffer.next) {
          branchBuffer = branchBuffer.next;
          yield branchBuffer.value;
        } else if (done) {
          return;
        } else {
          next();
        }
      }
    } finally {
      closed[i] = true;
      // Close source iterator if both branches are closed
      // Important: don't call return() if next() returned {done: true}!
      if (!done && closed[1 - i]) {
        iterator.return?.();
      }
    }
  }

  return [branch(0, buffer), branch(1, buffer)] as const;
}

function isWildcardSegment(segment: unknown): segment is WildcardSegment {
  return segment instanceof WeakMap && segment.has(wildcardSymbol);
}

/* @__NO_SIDE_EFFECTS__ */ function assumeAs<T>(_: unknown): asserts _ is T {
  /* void */
}

function isCountNode<I, V>(node: Node<I, V>): node is CountNode<I, V> {
  return (node as CountNode<I, V>).has(wildcardCountSymbol);
}
