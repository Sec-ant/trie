type AnyIterable<T> = Iterable<T> | AsyncIterable<T>;

const dataSymbol = Symbol();
const wildcardSymbol = Symbol();
const wildcardCountSymbol = Symbol();

type DataSymbol = typeof dataSymbol;
type WildcardSymbol = typeof wildcardSymbol;
type WildcardCountSymbol = typeof wildcardCountSymbol;

type WildcardCountNode<I, V> = Map<WildcardCountSymbol, number> & Node<I, V>;
type WildcardNode<I, V> = Map<WildcardSymbol, WildcardCountNode<I, V>>;
type RegularNode<I, V> = Map<I, Node<I, V>>;
type OuterNode<V> = Map<DataSymbol, V>;
type InnerNode<I, V> = WildcardNode<I, V> & RegularNode<I, V>;
type Node<I, V> = InnerNode<I, V> & OuterNode<V>;

type Stack<I, V> = [I | WildcardSymbol, Node<I, V>][];

interface SeekContext<I, V> {
  parentNode?: Node<I, V>;
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
    return this;
  }
  addSync(initialEntries: Iterable<[Iterable<I | WildcardSegment>, V]> = []) {
    for (const [key, value] of initialEntries) {
      this.setSync(key, value);
    }
    return this;
  }
  async set(path: AnyIterable<I | WildcardSegment>, value: V) {
    const node = await hardSeek(this.#root, path);
    const exists = node.has(dataSymbol);
    node.set(dataSymbol, value);
    if (!exists) {
      ++this.#size;
    }
    return this;
  }
  setSync(path: Iterable<I | WildcardSegment>, value: V) {
    const node = hardSeekSync(this.#root, path);
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
    const node = await hardSeek(this.#root, path);
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
    const node = hardSeekSync(this.#root, path);
    const exists = node.has(dataSymbol);
    node.set(dataSymbol, callback(node.get(dataSymbol), exists));
    if (!exists) {
      ++this.#size;
    }
    return this;
  }
  async has(path: AnyIterable<I | WildcardSegment>) {
    return !!(await softSeek(this.#root, path));
  }
  hasSync(path: Iterable<I | WildcardSegment>) {
    return !!softSeekSync(this.#root, path);
  }
  async get(path: AnyIterable<I | WildcardSegment>) {
    return (await softSeek(this.#root, path))?.get(dataSymbol);
  }
  getSync(path: Iterable<I | WildcardSegment>) {
    return softSeekSync(this.#root, path)?.get(dataSymbol);
  }
  async delete(path: AnyIterable<I | WildcardSegment>) {
    const stack: Stack<I, V> = [];
    const node = await softSeek(this.#root, path, stack);
    if (!node) {
      return false;
    }
    node.delete(dataSymbol);
    cleanUp(node, stack);
    --this.#size;
    return true;
  }
  deleteSync(path: Iterable<I | WildcardSegment>) {
    const stack: Stack<I, V> = [];
    const node = softSeekSync(this.#root, path, stack);
    if (!node) {
      return false;
    }
    node.delete(dataSymbol);
    cleanUp(node, stack);
    --this.#size;
    return true;
  }
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

function isWildcardCountNode<I, V>(
  node: Node<I, V>,
): node is WildcardCountNode<I, V> {
  return (node as WildcardCountNode<I, V>).has(wildcardCountSymbol);
}

function resolveNode<I, V>(node: Node<I, V>, seekContext: SeekContext<I, V>) {
  if (seekContext.nodeWildcardCount < seekContext.pathWildcardCount) {
    const diffCount =
      seekContext.pathWildcardCount - seekContext.nodeWildcardCount;
    const nextNode = new Map() as WildcardCountNode<I, V>;
    nextNode.set(wildcardCountSymbol, diffCount);
    node.set(wildcardSymbol, nextNode);
    node = nextNode;
  } else if (seekContext.nodeWildcardCount > seekContext.pathWildcardCount) {
    assumeAs<WildcardCountNode<I, V>>(node);
    const diffCount =
      seekContext.nodeWildcardCount - seekContext.pathWildcardCount;
    const nextNode = new Map() as WildcardCountNode<I, V>;
    nextNode.set(
      wildcardCountSymbol,
      node.get(wildcardCountSymbol)! - diffCount,
    );
    node.set(wildcardCountSymbol, diffCount);
    seekContext.parentNode!.set(wildcardSymbol, nextNode);
    nextNode.set(wildcardSymbol, node);
    node = nextNode;
  }
  seekContext.nodeWildcardCount = 0;
  seekContext.pathWildcardCount = 0;
  seekContext.parentNode = undefined;
  return node;
}

function hardSeekStep<I, V>(
  node: Node<I, V>,
  segment: I | WildcardSegment,
  seekContext: SeekContext<I, V>,
) {
  if (!isWildcardSegment(segment)) {
    node = resolveNode(node, seekContext);
    let childNode = node.get(segment);
    if (!childNode) {
      childNode = new Map();
      node.set(segment, childNode);
    }
    return childNode;
  }
  seekContext.pathWildcardCount += segment.get(wildcardSymbol) ?? 1;
  while (
    node.has(wildcardSymbol) &&
    seekContext.nodeWildcardCount < seekContext.pathWildcardCount
  ) {
    const childNode = node.get(wildcardSymbol)!;
    seekContext.nodeWildcardCount += childNode.get(wildcardCountSymbol) ?? 1;
    seekContext.parentNode = node;
    node = childNode;
  }
  return node;
}

async function hardSeek<I, V>(
  root: Node<I, V>,
  path: AnyIterable<I | WildcardSegment>,
) {
  let node = root;
  const seekContext: SeekContext<I, V> = {
    nodeWildcardCount: 0,
    pathWildcardCount: 0,
  };
  for await (const segment of path) {
    node = hardSeekStep(node, segment, seekContext);
  }
  return resolveNode(node, seekContext);
}

function hardSeekSync<I, V>(
  root: Node<I, V>,
  path: Iterable<I | WildcardSegment>,
) {
  let node = root;
  const seekContext: SeekContext<I, V> = {
    nodeWildcardCount: 0,
    pathWildcardCount: 0,
  };
  for (const segment of path) {
    node = hardSeekStep(node, segment, seekContext);
  }
  return resolveNode(node, seekContext);
}

function softSeekStep<I, V>(
  node: Node<I, V>,
  segment: I | WildcardSegment,
  seekContext: SeekContext<I, V>,
  stack?: Stack<I, V>,
) {
  if (!isWildcardSegment(segment)) {
    if (seekContext.nodeWildcardCount !== seekContext.pathWildcardCount) {
      stack?.splice(0, stack.length);
      return undefined;
    }
    const childNode = node.get(segment);
    if (!childNode) {
      stack?.splice(0, stack.length);
      return undefined;
    }
    stack?.push([segment, node]);
    return childNode;
  }
  seekContext.pathWildcardCount += segment.get(wildcardSymbol) ?? 1;
  while (
    node.has(wildcardSymbol) &&
    seekContext.nodeWildcardCount < seekContext.pathWildcardCount
  ) {
    const childNode = node.get(wildcardSymbol)!;
    seekContext.nodeWildcardCount += childNode.get(wildcardCountSymbol) ?? 1;
    stack?.push([wildcardSymbol, node]);
    node = childNode;
  }
  return node;
}

async function softSeek<I, V>(
  root: Node<I, V>,
  path: AnyIterable<I | WildcardSegment>,
  stack?: Stack<I, V>,
) {
  let node = root;
  const seekContext: SeekContext<I, V> = {
    nodeWildcardCount: 0,
    pathWildcardCount: 0,
  };
  for await (const segment of path) {
    const childNode = softSeekStep(node, segment, seekContext, stack);
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

function softSeekSync<I, V>(
  root: Node<I, V>,
  path: Iterable<I | WildcardSegment>,
  stack?: Stack<I, V>,
) {
  let node = root;
  const seekContext: SeekContext<I, V> = {
    nodeWildcardCount: 0,
    pathWildcardCount: 0,
  };
  for (const segment of path) {
    const childNode = softSeekStep(node, segment, seekContext, stack);
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

function hasChildrenOrData<I, V>(node: Node<I, V>) {
  if (node.has(dataSymbol)) {
    return true;
  }
  for (const key of node.keys()) {
    if (key !== wildcardCountSymbol) {
      return true;
    }
  }
  return false;
}

function cleanUp<I, V>(node: Node<I, V>, stack: Stack<I, V>) {
  while (!hasChildrenOrData(node) && stack.length) {
    const [segment, parentNode] = stack.pop()!;
    parentNode.delete(segment as I);
    node = parentNode;
  }
  if (
    !node.has(dataSymbol) &&
    node.has(wildcardSymbol) &&
    isWildcardCountNode(node)
  ) {
    const childNode = node.get(wildcardSymbol)!;
    childNode.set(
      wildcardCountSymbol,
      childNode.get(wildcardCountSymbol)! + node.get(wildcardCountSymbol)!,
    );
    const [, parentNode] = stack.pop()!;
    parentNode.set(wildcardSymbol, childNode);
  }
}
