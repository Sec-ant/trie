/**
 * Represents either an Iterable or an AsyncIterable of type T.
 */
type AnyIterable<T> = Iterable<T> | AsyncIterable<T>;

/**
 * Symbol as the key of the value of a node.
 */
const dataSymbol = Symbol("d");
/**
 * Symbol as the key of a wildcard node in the Trie.
 */
const wildcardSymbol = Symbol("*");
/**
 * Symbol as the key of the count of wildcards in the a wildcard node.
 */
const wildcardCountSymbol = Symbol("c");

/**
 * Type alias for the data symbol.
 */
type DataSymbol = typeof dataSymbol;
/**
 * Type alias for the wildcard symbol.
 */
type WildcardSymbol = typeof wildcardSymbol;
/**
 * Type alias for the wildcard count symbol.
 */
type WildcardCountSymbol = typeof wildcardCountSymbol;

/**
 * Represents a node in the Trie with wildcard count.
 * @template I - Type of keys in the node.
 * @template V - Type of values stored in the Trie.
 */
type WildcardCountNode<I, V> = Map<WildcardCountSymbol, number> & Node<I, V>;
/**
 * Represents a wildcard node in the Trie.
 * @template I - Type of keys in the node.
 * @template V - Type of values stored in the Trie.
 */
type WildcardNode<I, V> = Map<WildcardSymbol, WildcardCountNode<I, V>>;
/**
 * Represents a data node in the Trie.
 * @template V - Type of values stored in the Trie.
 */
type DataNode<V> = Map<DataSymbol, V>;
/**
 * Represents a leaf node in the Trie.
 * @template V - Type of values stored in the Trie.
 */
type LeafNode<V> = DataNode<V>;
/**
 * Represents a regular branch node in the Trie.
 * @template I - Type of keys in the node.
 * @template V - Type of values stored in the Trie.
 */
type RegularBranchNode<I, V> = Map<I, Node<I, V>>;
/**
 * Represents a branch node in the Trie.
 * @template I - Type of keys in the node.
 * @template V - Type of values stored in the Trie.
 */
type BranchNode<I, V> = WildcardNode<I, V> & RegularBranchNode<I, V>;
/**
 * Represents a node in the Trie.
 * @template I - Type of keys in the node.
 * @template V - Type of values stored in the Trie.
 */
type Node<I, V> = BranchNode<I, V> & LeafNode<V>;

/**
 * Represents a stack used in Trie operations.
 * @template I - Type of keys in the Trie.
 * @template V - Type of values stored in the Trie.
 */
type Stack<I, V> = [I | WildcardSymbol, Node<I, V>][];

/**
 * Interface representing the context during Trie seek operations.
 * @template I - Type of keys in the Trie.
 * @template V - Type of values stored in the Trie.
 */
interface SeekContext<I, V> {
  parentNode?: Node<I, V>;
  nodeWildcardCount: number;
  pathWildcardCount: number;
}

/**
 * Represents a wildcard path segment.
 */
export type WildcardSegment = WeakMap<WildcardSymbol, number>;

/**
 * Creates a wildcard path segment with an optional count.
 * @param count - Optional count for the wildcard. Default is 1.
 * @returns A wildcard path segment.
 */
export function w(count = 1): WildcardSegment {
  if (Number.isSafeInteger(count) && count > 0) {
    return new WeakMap([[wildcardSymbol, count]]);
  } else {
    console.warn(`Invalid wildcard count: ${count}, fallback to 1.`);
    return new WeakMap([[wildcardSymbol, 1]]);
  }
}

/**
 * Represents a Trie data structure.
 * @template I - Type of keys in the Trie.
 * @template V - Type of values stored in the Trie.
 */
export class Trie<I, V> {
  #root: Node<I, V> = new Map();
  #size = 0;
  /**
   * Constructs a new Trie.
   * @param initialEntries - Optional initial entries to populate the Trie.
   */
  constructor(
    initialEntries: Iterable<[Iterable<I | WildcardSegment>, V]> = [],
  ) {
    return this.addSync(initialEntries);
  }
  /**
   * Asynchronously adds paths to the Trie with the specified values.
   * @param initialEntries - The optional initial entries to add to the Trie.
   * @returns A Promise that resolves to the Trie instance.
   */
  async add(
    initialEntries: AnyIterable<[AnyIterable<I | WildcardSegment>, V]>,
  ) {
    for await (const [key, value] of initialEntries) {
      await this.set(key, value);
    }
    return this;
  }
  /**
   * Synchronously adds paths to the Trie with the specified values.
   * @param initialEntries - The optional initial entries to add to the Trie.
   * @returns The Trie instance.
   */
  addSync(initialEntries: Iterable<[Iterable<I | WildcardSegment>, V]>) {
    for (const [key, value] of initialEntries) {
      this.setSync(key, value);
    }
    return this;
  }
  /**
   * Asynchronously sets the value for a path in the Trie.
   * @param path - The path to set.
   * @param value - The value to associate with the path.
   * @returns A Promise that resolves to the Trie instance.
   */
  async set(path: AnyIterable<I | WildcardSegment>, value: V) {
    const node = await hardSeek(this.#root, path);
    const exists = node.has(dataSymbol);
    node.set(dataSymbol, value);
    if (!exists) {
      ++this.#size;
    }
    return this;
  }
  /**
   * Synchronously sets the value for a path in the Trie.
   * @param path - The path to set.
   * @param value - The value to associate with the path.
   * @returns The Trie instance.
   */
  setSync(path: Iterable<I | WildcardSegment>, value: V) {
    const node = hardSeekSync(this.#root, path);
    const exists = node.has(dataSymbol);
    node.set(dataSymbol, value);
    if (!exists) {
      ++this.#size;
    }
    return this;
  }
  /**
   * Asynchronously sets the value for a path in the Trie using a callback.
   * @param path - The path to set.
   * @param callback - The callback function to determine the new value.
   * @returns A Promise that resolves to the Trie instance.
   */
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
  /**
   * Synchronously sets the value for a path in the Trie using a callback.
   * @param path - The path to set.
   * @param callback - The callback function to determine the new value.
   * @returns The Trie instance.
   */
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
  /**
   * Asynchronously checks if a path exists in the Trie.
   * @param path - The path to check.
   * @returns A Promise that resolves to true if the path exists, false otherwise.
   */
  async has(path: AnyIterable<I | WildcardSegment>) {
    return !!(await softSeek(this.#root, path));
  }
  /**
   * Synchronously checks if a path exists in the Trie.
   * @param path - The path to check.
   * @returns True if the path exists, false otherwise.
   */
  hasSync(path: Iterable<I | WildcardSegment>) {
    return !!softSeekSync(this.#root, path);
  }
  /**
   * Asynchronously retrieves the value associated with a path in the Trie.
   * @param path - The path to retrieve the value for.
   * @returns A Promise that resolves to the value associated with the path, or undefined if not found.
   */
  async get(path: AnyIterable<I | WildcardSegment>) {
    return (await softSeek(this.#root, path))?.get(dataSymbol);
  }
  /**
   * Synchronously retrieves the value associated with a path in the Trie.
   * @param path - The path to retrieve the value for.
   * @returns The value associated with the path, or undefined if not found.
   */
  getSync(path: Iterable<I | WildcardSegment>) {
    return softSeekSync(this.#root, path)?.get(dataSymbol);
  }
  /**
   * Asynchronously deletes a path from the Trie.
   * @param path - The path to delete.
   * @returns A Promise that resolves to true if the path was deleted, false otherwise.
   */
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
  /**
   * Synchronously deletes a path from the Trie.
   * @param path - The path to delete.
   * @returns True if the path was deleted, false otherwise.
   */
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
  /**
   * Clears all paths from the Trie.
   */
  clear() {
    this.#root.clear();
    this.#size = 0;
  }
  /**
   * Asynchronously searches for values matching a given path.
   * @param path - The path to match against.
   * @returns An asynchronous generator yielding matching values.
   */
  async *match(path: AnyIterable<I>) {
    const pathIterator =
      Symbol.asyncIterator in path
        ? path[Symbol.asyncIterator]()
        : path[Symbol.iterator]();
    yield* traverse(this.#root, pathIterator);
  }
  /**
   * Synchronously searches for values matching a given path.
   * @param path - The path to match against.
   * @returns A generator yielding matching values.
   */
  *matchSync(path: Iterable<I>) {
    const pathIterator = path[Symbol.iterator]();
    yield* traverseSync(this.#root, pathIterator);
  }
  // #if DEV
  /**
   * Gets the root node of the Trie.
   * @internal
   */
  get root() {
    return this.#root;
  }
  // #endif
  /**
   * Gets the size of the Trie, i.e., the number of paths.
   */
  get size() {
    return this.#size;
  }
  /**
   * Symbol.toStringTag for the Trie class.
   */
  readonly [Symbol.toStringTag] = "Trie";
}

/**
 * Like ReadableStream.tee(), but for iterators.
 * https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream/tee
 *
 * See: MattiasBuelens/web-streams-polyfill#80
 * @template T - Type of elements in the iterator.
 * @param iterator - The iterator to split.
 * @returns An array containing two iterators.
 */
function teeIterator<T>(iterator: AsyncIterator<T> | Iterator<T>) {
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

/**
 * Like ReadableStream.tee(), but for iterators (synchronous version).
 * https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream/tee
 *
 * See: MattiasBuelens/web-streams-polyfill#80
 * @template T - Type of elements in the iterator.
 * @param iterator - The iterator to split.
 * @returns An array containing two iterators.
 */
function teeIteratorSync<T>(iterator: Iterator<T>) {
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

/**
 * Checks if the given segment is a wildcard path segment.
 * @param segment - The segment to check.
 * @returns True if the segment is a wildcard path segment, false otherwise.
 */
function isWildcardSegment(segment: unknown): segment is WildcardSegment {
  return segment instanceof WeakMap && segment.has(wildcardSymbol);
}

/**
 * Asserts that the given value has the specified type.
 * @template T - The expected type of the value.
 * @param _ - The value to assert.
 */
/* @__NO_SIDE_EFFECTS__ */ function assumeAs<T>(_: unknown): asserts _ is T {
  /* void */
}

/**
 * Checks if the given node is a wildcard count node.
 * @template I - Type of keys in the node.
 * @template V - Type of values stored in the Trie.
 * @param node - The node to check.
 * @returns True if the node is a wildcard count node, false otherwise.
 */
function isWildcardCountNode<I, V>(
  node: Node<I, V>,
): node is WildcardCountNode<I, V> {
  return (node as WildcardCountNode<I, V>).has(wildcardCountSymbol);
}

/**
 * Resolves the Trie node based on the seek context.
 * @template I - Type of keys in the Trie.
 * @template V - Type of values stored in the Trie.
 * @param node - The Trie node to resolve.
 * @param seekContext - The context during Trie seek operations.
 * @returns The resolved Trie node.
 */
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

/**
 * Performs a step in the hard Trie seek operation.
 * @template I - Type of keys in the Trie.
 * @template V - Type of values stored in the Trie.
 * @param node - The current Trie node.
 * @param segment - The current path segment.
 * @param seekContext - The context during Trie seek operations.
 * @returns The next Trie node in the seek operation.
 */
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

/**
 * Performs a hard Trie seek operation.
 * @template I - Type of keys in the Trie.
 * @template V - Type of values stored in the Trie.
 * @param root - The root node of the Trie.
 * @param path - The path to seek in the Trie.
 * @returns The Trie node at the end of the seek operation.
 */
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

/**
 * Performs a hard Trie seek operation (synchronous version).
 * @template I - Type of keys in the Trie.
 * @template V - Type of values stored in the Trie.
 * @param root - The root node of the Trie.
 * @param path - The path to seek in the Trie.
 * @returns The Trie node at the end of the seek operation.
 */
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

/**
 * Performs a step in the soft Trie seek operation.
 * @template I - Type of keys in the Trie.
 * @template V - Type of values stored in the Trie.
 * @param node - The current Trie node.
 * @param segment - The current path segment.
 * @param seekContext - The context during Trie seek operations.
 * @param stack - The stack used in Trie operations.
 * @returns The next Trie node in the seek operation.
 */
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

/**
 * Performs a soft Trie seek operation.
 * @template I - Type of keys in the Trie.
 * @template V - Type of values stored in the Trie.
 * @param root - The root node of the Trie.
 * @param path - The path to seek in the Trie.
 * @param stack - The stack used in Trie operations.
 * @returns The Trie node at the end of the seek operation, or undefined if the path is not found.
 */
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
  if (
    seekContext.nodeWildcardCount !== seekContext.pathWildcardCount ||
    !node.has(dataSymbol)
  ) {
    stack?.splice(0, stack.length);
    return undefined;
  }
  return node;
}

/**
 * Performs a soft Trie seek operation (synchronous version).
 * @template I - Type of keys in the Trie.
 * @template V - Type of values stored in the Trie.
 * @param root - The root node of the Trie.
 * @param path - The path to seek in the Trie.
 * @param stack - The stack used in Trie operations.
 * @returns The Trie node at the end of the seek operation, or undefined if the path is not found.
 */
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
  if (
    seekContext.nodeWildcardCount !== seekContext.pathWildcardCount ||
    !node.has(dataSymbol)
  ) {
    stack?.splice(0, stack.length);
    return undefined;
  }
  return node;
}

/**
 * Checks if a Trie node has children or data.
 * @template I - Type of keys in the Trie.
 * @template V - Type of values stored in the Trie.
 * @param node - The Trie node to check.
 * @returns True if the node has children or data, false otherwise.
 */
function hasChildren<I, V>(node: Node<I, V>) {
  for (const key of node.keys()) {
    if (key !== wildcardCountSymbol) {
      return true;
    }
  }
  return false;
}

/**
 * Cleans up the Trie by removing unnecessary nodes.
 * @template I - Type of keys in the Trie.
 * @template V - Type of values stored in the Trie.
 * @param node - The Trie node to clean up.
 * @param stack - The stack used in Trie operations.
 */
function cleanUp<I, V>(node: Node<I, V>, stack: Stack<I, V>) {
  while (!hasChildren(node) && stack.length) {
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

/**
 * Asynchronously generates values by traversing from a Trie node based on a path iterator.
 * @template I - Type of keys in the Trie.
 * @template V - Type of values stored in the Trie.
 * @param node - The Trie node to start branching from.
 * @param pathIterator - An asynchronous iterator representing the path to follow.
 * @returns An asynchronous generator yielding values based on the path.
 */
async function* traverse<I, V>(
  node: Node<I, V>,
  pathIterator: AsyncIterator<I> | Iterator<I>,
): AsyncGenerator<V | undefined, void, unknown> {
  // wildcard
  if (isWildcardCountNode(node)) {
    for (let i = 0; i < node.get(wildcardCountSymbol)! - 1; ++i) {
      const { done } = await pathIterator.next();
      if (done) {
        return;
      }
    }
  }
  // yield data
  if (node.has(dataSymbol)) {
    yield node.get(dataSymbol);
  }
  const { value, done } = await pathIterator.next();
  if (done) {
    return;
  }
  // find matched node
  const nextWildcardNode = node.get(wildcardSymbol);
  const nextRegularNode = node.get(value);
  // wildcard match only
  if (nextWildcardNode && !nextRegularNode) {
    yield* traverse<I, V>(nextWildcardNode, pathIterator);
  }
  // regular match only
  else if (!nextWildcardNode && nextRegularNode) {
    yield* traverse<I, V>(nextRegularNode, pathIterator);
  }
  // both, we need to tee the path iterator
  else if (nextWildcardNode && nextRegularNode) {
    const [pathIterator1, pathIterator2] = teeIterator(pathIterator);
    yield* traverse<I, V>(nextWildcardNode, pathIterator1);
    yield* traverse<I, V>(nextRegularNode, pathIterator2);
  }
  // none
  else {
    return;
  }
}

/**
 * Synchronously generates values by traversing from a Trie node based on a path iterator.
 * @template I - Type of keys in the Trie.
 * @template V - Type of values stored in the Trie.
 * @param node - The Trie node to start branching from.
 * @param pathIterator - A synchronous iterator representing the path to follow.
 * @returns A generator yielding values based on the path.
 */
function* traverseSync<I, V>(
  node: Node<I, V>,
  pathIterator: Iterator<I>,
): Generator<V | undefined, void, unknown> {
  // wildcard
  if (isWildcardCountNode(node)) {
    for (let i = 0; i < node.get(wildcardCountSymbol)! - 1; ++i) {
      const { done } = pathIterator.next();
      if (done) {
        return;
      }
    }
  }
  // yield data
  if (node.has(dataSymbol)) {
    yield node.get(dataSymbol);
  }
  const { value, done } = pathIterator.next();
  if (done) {
    return;
  }
  // find matched node
  const childNode1 = node.get(wildcardSymbol);
  const childNode2 = node.get(value);
  // wildcard match only
  if (childNode1 && !childNode2) {
    yield* traverseSync<I, V>(childNode1, pathIterator);
  }
  // regular match only
  else if (!childNode1 && childNode2) {
    yield* traverseSync<I, V>(childNode2, pathIterator);
  }
  // both, we need to tee the path iterator
  else if (childNode1 && childNode2) {
    const [pathIterator1, pathIterator2] = teeIteratorSync(pathIterator);
    yield* traverseSync<I, V>(childNode1, pathIterator1);
    yield* traverseSync<I, V>(childNode2, pathIterator2);
  }
  // none
  else {
    return;
  }
}

// in-source tests
/* istanbul ignore if -- @preserve */
if (import.meta.vitest) {
  const { it, expect, describe, beforeEach } = import.meta.vitest;
  const clone = (await import("just-clone")).default;

  describe("wildcard segment function", () => {
    it("creating with no arguments", () => {
      expect(w()).toStrictEqual(new WeakMap([[wildcardSymbol, 1]]));
      expect(w(undefined)).toStrictEqual(new WeakMap([[wildcardSymbol, 1]]));
    });

    it("creating with a valid argument", () => {
      expect(w(3)).toStrictEqual(new WeakMap([[wildcardSymbol, 3]]));
    });

    it("creating with invalid arguments", () => {
      expect(w(0)).toStrictEqual(new WeakMap([[wildcardSymbol, 1]]));
      expect(w(-1)).toStrictEqual(new WeakMap([[wildcardSymbol, 1]]));
      expect(w(3.5)).toStrictEqual(new WeakMap([[wildcardSymbol, 1]]));
      expect(w(NaN)).toStrictEqual(new WeakMap([[wildcardSymbol, 1]]));
      expect(w("" as unknown as number)).toStrictEqual(
        new WeakMap([[wildcardSymbol, 1]]),
      );
      expect(w(null as unknown as number)).toStrictEqual(
        new WeakMap([[wildcardSymbol, 1]]),
      );
    });
  });

  describe("constructor", () => {
    it("initializing an empty Trie", () => {
      const trie = new Trie<number, string>();
      expect(trie.root).toStrictEqual(new Map());
      expect(trie.size).toBe(0);
    });

    it("initializing a Trie with initial entries", () => {
      const trie = new Trie<number, string>([
        [[1, 2], "value1"],
        [[3, 4], "value2"],
      ]);
      expect(trie.root).toStrictEqual(
        new Map([
          [1, new Map([[2, new Map([[dataSymbol, "value1"]])]])],
          [3, new Map([[4, new Map([[dataSymbol, "value2"]])]])],
        ]),
      );
      expect(trie.size).toBe(2);
    });
  });

  describe("add and addSync method", () => {
    let trie: Trie<number, string>;

    beforeEach(() => {
      trie = new Trie<number, string>();
    });

    describe("adding new entries", () => {
      const syncEntries = [
        [[1, 2], "value1"],
        [[3, 4], "value2"],
      ] as [number[], string][];

      const asyncEntriesGenerator = async function* () {
        yield [[1, 2], "value1"] as [number[], string];
        yield [[3, 4], "value2"] as [number[], string];
      };

      const asyncPathsEntriesGenerator = async function* () {
        const g1 = async function* () {
          yield 1;
          yield 2;
        };

        const g2 = async function* () {
          yield 3;
          yield 4;
        };

        yield [g1(), "value1"] as [AsyncIterable<number>, string];
        yield [g2(), "value2"] as [AsyncIterable<number>, string];
      };

      const root = new Map([
        [1, new Map([[2, new Map([[dataSymbol, "value1"]])]])],
        [3, new Map([[4, new Map([[dataSymbol, "value2"]])]])],
      ]);

      it("add(syncEntries)", async () => {
        await trie.add(syncEntries);
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(2);
      });

      it("add(asyncEntries)", async () => {
        await trie.add(asyncEntriesGenerator());
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(2);
      });

      it("add(asyncPathsEntries)", async () => {
        await trie.add(asyncPathsEntriesGenerator());
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(2);
      });

      it("addSync(syncEntries)", () => {
        trie.addSync(syncEntries);
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(2);
      });
    });

    describe("adding entries with duplicated paths", () => {
      const syncEntries = [
        [[1, 2], "value1"],
        [[1, 2], "value2"],
      ] as [number[], string][];

      const asyncEntriesGenerator = async function* () {
        yield [[1, 2], "value1"] as [number[], string];
        yield [[1, 2], "value2"] as [number[], string];
      };

      const asyncPathsEntriesGenerator = async function* () {
        const g = async function* () {
          yield 1;
          yield 2;
        };

        yield [g(), "value1"] as [AsyncIterable<number>, string];
        yield [g(), "value2"] as [AsyncIterable<number>, string];
      };

      const root = new Map([
        [1, new Map([[2, new Map([[dataSymbol, "value2"]])]])],
      ]);

      it("add(syncEntries)", async () => {
        await trie.add(syncEntries);
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(1);
      });

      it("add(asyncEntries)", async () => {
        await trie.add(asyncEntriesGenerator());
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(1);
      });

      it("add(asyncPathsEntries)", async () => {
        await trie.add(asyncPathsEntriesGenerator());
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(1);
      });

      it("addSync(syncEntries)", () => {
        trie.addSync(syncEntries);
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(1);
      });
    });

    describe("adding entries with existing paths", () => {
      const syncEntries1 = [[[1, 2], "value1"]] as [number[], string][];
      const syncEntries2 = [[[1, 2], "value2"]] as [number[], string][];

      const asyncEntriesGenerator1 = async function* () {
        yield [[1, 2], "value1"] as [number[], string];
      };
      const asyncEntriesGenerator2 = async function* () {
        yield [[1, 2], "value2"] as [number[], string];
      };

      const asyncPathsEntriesGenerator1 = async function* () {
        const g = async function* () {
          yield 1;
          yield 2;
        };
        yield [g(), "value1"] as [AsyncIterable<number>, string];
      };
      const asyncPathsEntriesGenerator2 = async function* () {
        const g = async function* () {
          yield 1;
          yield 2;
        };
        yield [g(), "value2"] as [AsyncIterable<number>, string];
      };

      const root = new Map([
        [1, new Map([[2, new Map([[dataSymbol, "value2"]])]])],
      ]);

      it("add(syncEntries)", async () => {
        await trie.add(syncEntries1);
        await trie.add(syncEntries2);
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(1);
      });

      it("add(asyncEntries)", async () => {
        await trie.add(asyncEntriesGenerator1());
        await trie.add(asyncEntriesGenerator2());
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(1);
      });

      it("add(asyncPathsEntries)", async () => {
        await trie.add(asyncPathsEntriesGenerator1());
        await trie.add(asyncPathsEntriesGenerator2());
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(1);
      });

      it("addSync(syncEntries)", () => {
        trie.addSync(syncEntries1);
        trie.addSync(syncEntries2);
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(1);
      });
    });

    describe("chaining", () => {
      const syncEntries1 = [[[1, 2], "value1"]] as [number[], string][];
      const syncEntries2 = [[[3, 4], "value2"]] as [number[], string][];

      const asyncEntriesGenerator1 = async function* () {
        yield [[1, 2], "value1"] as [number[], string];
      };
      const asyncEntriesGenerator2 = async function* () {
        yield [[3, 4], "value2"] as [number[], string];
      };

      const asyncPathsEntriesGenerator1 = async function* () {
        const g = async function* () {
          yield 1;
          yield 2;
        };
        yield [g(), "value1"] as [AsyncIterable<number>, string];
      };
      const asyncPathsEntriesGenerator2 = async function* () {
        const g = async function* () {
          yield 3;
          yield 4;
        };
        yield [g(), "value2"] as [AsyncIterable<number>, string];
      };

      const root = new Map([
        [1, new Map([[2, new Map([[dataSymbol, "value1"]])]])],
        [3, new Map([[4, new Map([[dataSymbol, "value2"]])]])],
      ]);

      it("add(syncEntries)", async () => {
        await (await trie.add(syncEntries1)).add(syncEntries2);
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(2);
      });

      it("add(asyncEntries)", async () => {
        await (
          await trie.add(asyncEntriesGenerator1())
        ).add(asyncEntriesGenerator2());
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(2);
      });

      it("add(asyncPathsEntries)", async () => {
        await (
          await trie.add(asyncPathsEntriesGenerator1())
        ).add(asyncPathsEntriesGenerator2());
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(2);
      });

      it("addSync(syncEntries)", () => {
        trie.addSync(syncEntries1).addSync(syncEntries2);
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(2);
      });
    });
  });

  describe("set and setSync method", () => {
    let trie: Trie<number, string | undefined>;

    beforeEach(() => {
      trie = new Trie<number, string | undefined>();
    });

    describe("setting a value for a new path", () => {
      const syncPath = [1, 2];

      const asyncPathGenerator = async function* () {
        yield 1;
        yield 2;
      };

      const value = "value1";

      const root = new Map([
        [1, new Map([[2, new Map([[dataSymbol, value]])]])],
      ]);

      it("set(syncPath, value)", async () => {
        await trie.set(syncPath, value);
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(1);
      });

      it("set(asyncPath, value)", async () => {
        await trie.set(asyncPathGenerator(), value);
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(1);
      });

      it("setSync(syncPath, value)", () => {
        trie.setSync(syncPath, value);
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(1);
      });
    });

    describe("setting undefined for a new path", () => {
      const syncPath = [1, 2];

      const asyncPathGenerator = async function* () {
        yield 1;
        yield 2;
      };

      const value = undefined;

      const root = new Map([
        [1, new Map([[2, new Map([[dataSymbol, value]])]])],
      ]);

      it("set(syncPath, value)", async () => {
        await trie.set(syncPath, value);
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(1);
      });

      it("set(asyncPath, value)", async () => {
        await trie.set(asyncPathGenerator(), value);
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(1);
      });

      it("setSync(syncPath, value)", () => {
        trie.setSync(syncPath, value);
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(1);
      });
    });

    describe("setting a value for an existing path", () => {
      const syncPath = [1, 2];

      const asyncPathGenerator = async function* () {
        yield 1;
        yield 2;
      };

      const value1 = "value1";
      const value2 = "value1";

      const root = new Map([
        [1, new Map([[2, new Map([[dataSymbol, value2]])]])],
      ]);

      it("set(syncPath, value)", async () => {
        await trie.set(syncPath, value1);
        await trie.set(syncPath, value2);
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(1);
      });

      it("set(asyncPath, value)", async () => {
        await trie.set(asyncPathGenerator(), value1);
        await trie.set(asyncPathGenerator(), value2);
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(1);
      });

      it("setSync(syncPath, value)", () => {
        trie.setSync(syncPath, value1);
        trie.setSync(syncPath, value2);
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(1);
      });
    });

    describe("setting a value for a path with a wildcard", () => {
      const syncPath = [1, w()];

      const asyncPathGenerator = async function* () {
        yield 1;
        yield w();
      };

      const value = "value1";

      const root = new Map([
        [
          1,
          new Map([
            [
              wildcardSymbol,
              new Map<unknown, unknown>([
                [wildcardCountSymbol, 1],
                [dataSymbol, value],
              ]),
            ],
          ]),
        ],
      ]);

      it("set(syncPath, value)", async () => {
        await trie.set(syncPath, value);
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(1);
      });

      it("set(asyncPath, value)", async () => {
        await trie.set(asyncPathGenerator(), value);
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(1);
      });

      it("setSync(syncPath, value)", () => {
        trie.setSync(syncPath, value);
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(1);
      });
    });

    describe("setting a value for a path with multiple wildcards (count)", () => {
      const wildcardCount = 5;

      const syncPath = [1, w(wildcardCount)];

      const asyncPathGenerator = async function* () {
        yield 1;
        yield w(wildcardCount);
      };

      const value = "value1";

      const root = new Map([
        [
          1,
          new Map([
            [
              wildcardSymbol,
              new Map<unknown, unknown>([
                [wildcardCountSymbol, wildcardCount],
                [dataSymbol, value],
              ]),
            ],
          ]),
        ],
      ]);

      it("set(syncPath, value)", async () => {
        await trie.set(syncPath, value);
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(1);
      });

      it("set(asyncPath, value)", async () => {
        await trie.set(asyncPathGenerator(), value);
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(1);
      });

      it("setSync(syncPath, value)", () => {
        trie.setSync(syncPath, value);
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(1);
      });
    });

    describe("setting a value for a path with multiple wildcards (literal)", () => {
      const syncPath = [1, w(), w(), w(), w(), w()];

      const asyncPathGenerator = async function* () {
        yield 1;
        yield w();
        yield w();
        yield w();
        yield w();
        yield w();
      };

      const value = "value1";

      const root = new Map([
        [
          1,
          new Map([
            [
              wildcardSymbol,
              new Map<unknown, unknown>([
                [wildcardCountSymbol, 5],
                [dataSymbol, value],
              ]),
            ],
          ]),
        ],
      ]);

      it("set(syncPath, value)", async () => {
        await trie.set(syncPath, value);
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(1);
      });

      it("set(asyncPath, value)", async () => {
        await trie.set(asyncPathGenerator(), value);
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(1);
      });

      it("setSync(syncPath, value)", () => {
        trie.setSync(syncPath, value);
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(1);
      });
    });

    describe("setting a value for a path with an equivalent wildcard count", () => {
      const syncPath1 = [1, w(5)];
      const syncPath2 = [1, w(), w(), w(), w(), w()];

      const asyncPathGenerator1 = async function* () {
        yield 1;
        yield w(5);
      };

      const asyncPathGenerator2 = async function* () {
        yield 1;
        yield w();
        yield w();
        yield w();
        yield w();
        yield w();
      };

      const value1 = "value1";
      const value2 = "value2";

      const root = new Map([
        [
          1,
          new Map([
            [
              wildcardSymbol,
              new Map<unknown, unknown>([
                [wildcardCountSymbol, 5],
                [dataSymbol, value2],
              ]),
            ],
          ]),
        ],
      ]);

      it("set(syncPath, value)", async () => {
        await trie.set(syncPath1, value1);
        await trie.set(syncPath2, value2);
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(1);
      });

      it("set(asyncPath, value)", async () => {
        await trie.set(asyncPathGenerator1(), value1);
        await trie.set(asyncPathGenerator2(), value2);
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(1);
      });

      it("setSync(syncPath, value)", () => {
        trie.setSync(syncPath1, value1);
        trie.setSync(syncPath2, value2);
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(1);
      });
    });

    describe("setting values for paths with common wildcard branches, short branch then long branch", () => {
      const syncPath1 = [1, w(2)];
      const syncPath2 = [1, w(5)];

      const asyncPathGenerator1 = async function* () {
        yield 1;
        yield w(2);
      };
      const asyncPathGenerator2 = async function* () {
        yield 1;
        yield w(5);
      };

      const value1 = "value1";
      const value2 = "value2";

      const root = new Map([
        [
          1,
          new Map([
            [
              wildcardSymbol,
              new Map<unknown, unknown>([
                [wildcardCountSymbol, 2],
                [dataSymbol, "value1"],
                [
                  wildcardSymbol,
                  new Map<unknown, unknown>([
                    [wildcardCountSymbol, 3],
                    [dataSymbol, "value2"],
                  ]),
                ],
              ]),
            ],
          ]),
        ],
      ]);

      it("set(syncPath, value)", async () => {
        await trie.set(syncPath1, value1);
        await trie.set(syncPath2, value2);
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(2);
      });

      it("set(asyncPath, value)", async () => {
        await trie.set(asyncPathGenerator1(), value1);
        await trie.set(asyncPathGenerator2(), value2);
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(2);
      });

      it("setSync(syncPath, value)", () => {
        trie.setSync(syncPath1, value1);
        trie.setSync(syncPath2, value2);
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(2);
      });
    });

    describe("setting values for paths with common wildcard branches, long branch then short branch", () => {
      const syncPath1 = [1, w(2)];
      const syncPath2 = [1, w(5)];

      const asyncPathGenerator1 = async function* () {
        yield 1;
        yield w(2);
      };
      const asyncPathGenerator2 = async function* () {
        yield 1;
        yield w(5);
      };

      const value1 = "value1";
      const value2 = "value2";

      const root = new Map([
        [
          1,
          new Map([
            [
              wildcardSymbol,
              new Map<unknown, unknown>([
                [wildcardCountSymbol, 2],
                [dataSymbol, "value1"],
                [
                  wildcardSymbol,
                  new Map<unknown, unknown>([
                    [wildcardCountSymbol, 3],
                    [dataSymbol, "value2"],
                  ]),
                ],
              ]),
            ],
          ]),
        ],
      ]);

      it("set(syncPath, value)", async () => {
        await trie.set(syncPath2, value2);
        await trie.set(syncPath1, value1);
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(2);
      });

      it("set(asyncPath, value)", async () => {
        await trie.set(asyncPathGenerator2(), value2);
        await trie.set(asyncPathGenerator1(), value1);
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(2);
      });

      it("setSync(syncPath, value)", () => {
        trie.setSync(syncPath2, value2);
        trie.setSync(syncPath1, value1);
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(2);
      });
    });

    describe("chaining", () => {
      const syncPath1 = [1, 2];
      const syncPath2 = [3, 4];

      const asyncPathGenerator1 = async function* () {
        yield 1;
        yield 2;
      };

      const asyncPathGenerator2 = async function* () {
        yield 3;
        yield 4;
      };

      const value1 = "value1";
      const value2 = "value2";

      const root = new Map([
        [1, new Map([[2, new Map([[dataSymbol, value1]])]])],
        [3, new Map([[4, new Map([[dataSymbol, value2]])]])],
      ]);

      it("set(syncPath, value)", async () => {
        await (await trie.set(syncPath1, value1)).set(syncPath2, value2);
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(2);
      });

      it("set(asyncPath, value)", async () => {
        await (
          await trie.set(asyncPathGenerator1(), value1)
        ).set(asyncPathGenerator2(), value2);
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(2);
      });

      it("setSync(syncPath, value)", () => {
        trie.setSync(syncPath1, value1).setSync(syncPath2, value2);
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(2);
      });
    });
  });

  describe("setCallback and setCallbackSync method", () => {
    let trie: Trie<number, number>;

    beforeEach(() => {
      trie = new Trie<number, number>();
    });

    describe("setting a value for a new path", () => {
      const syncPath = [1, 2];

      const asyncPathGenerator = async function* () {
        yield 1;
        yield 2;
      };

      const syncValueCallback = (prev: number | undefined) =>
        prev === undefined ? -1 : prev + 1;
      const asyncValueCallback = async (prev: number | undefined) =>
        prev === undefined ? -1 : prev + 1;

      const root = new Map([[1, new Map([[2, new Map([[dataSymbol, -1]])]])]]);

      it("setCallback(syncPath, syncValueCallback)", async () => {
        await trie.setCallback(syncPath, syncValueCallback);
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(1);
      });

      it("setCallback(syncPath, asyncValueCallback)", async () => {
        await trie.setCallback(syncPath, asyncValueCallback);
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(1);
      });

      it("setCallback(asyncPath, syncValueCallback)", async () => {
        await trie.setCallback(asyncPathGenerator(), syncValueCallback);
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(1);
      });

      it("setCallback(asyncPath, asyncValueCallback)", async () => {
        await trie.setCallback(asyncPathGenerator(), asyncValueCallback);
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(1);
      });

      it("setCallbackSync(syncPath, syncValueCallback)", () => {
        trie.setCallbackSync(syncPath, syncValueCallback);
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(1);
      });
    });

    describe("updating a value for an existing path", () => {
      beforeEach(() => {
        trie.setSync([1, 3], 1);
      });

      const syncPath = [1, 3];

      const asyncPathGenerator = async function* () {
        yield 1;
        yield 3;
      };

      const syncValueCallback = (prev: number | undefined) =>
        prev === undefined ? -1 : prev + 1;
      const asyncValueCallback = async (prev: number | undefined) =>
        prev === undefined ? -1 : prev + 1;

      const root = new Map([[1, new Map([[3, new Map([[dataSymbol, 2]])]])]]);

      it("setCallback(syncPath, syncValueCallback)", async () => {
        await trie.setCallback(syncPath, syncValueCallback);
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(1);
      });

      it("setCallback(syncPath, asyncValueCallback)", async () => {
        await trie.setCallback(syncPath, asyncValueCallback);
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(1);
      });

      it("setCallback(asyncPath, syncValueCallback)", async () => {
        await trie.setCallback(asyncPathGenerator(), syncValueCallback);
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(1);
      });

      it("setCallback(asyncPath, asyncValueCallback)", async () => {
        await trie.setCallback(asyncPathGenerator(), asyncValueCallback);
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(1);
      });

      it("setCallbackSync(syncPath, syncValueCallback)", () => {
        trie.setCallbackSync(syncPath, syncValueCallback);
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(1);
      });
    });

    describe("updating a value for an existing path with wildcards", () => {
      beforeEach(() => {
        trie.setSync([1, w(5)], 1);
      });

      const syncPath = [1, w(2), w(3)];

      const asyncPathGenerator = async function* () {
        yield 1;
        yield w(2);
        yield w(3);
      };

      const syncValueCallback = (prev: number | undefined) =>
        prev === undefined ? -1 : prev + 1;
      const asyncValueCallback = async (prev: number | undefined) =>
        prev === undefined ? -1 : prev + 1;

      const root = new Map([
        [
          1,
          new Map([
            [
              wildcardSymbol,
              new Map([
                [wildcardCountSymbol, 5],
                [dataSymbol, 2],
              ]),
            ],
          ]),
        ],
      ]);

      it("setCallback(syncPath, syncValueCallback)", async () => {
        await trie.setCallback(syncPath, syncValueCallback);
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(1);
      });

      it("setCallback(syncPath, asyncValueCallback)", async () => {
        await trie.setCallback(syncPath, asyncValueCallback);
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(1);
      });

      it("setCallback(asyncPath, syncValueCallback)", async () => {
        await trie.setCallback(asyncPathGenerator(), syncValueCallback);
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(1);
      });

      it("setCallback(asyncPath, asyncValueCallback)", async () => {
        await trie.setCallback(asyncPathGenerator(), asyncValueCallback);
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(1);
      });

      it("setCallbackSync(syncPath, syncValueCallback)", () => {
        trie.setCallbackSync(syncPath, syncValueCallback);
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(1);
      });
    });

    describe("chaining", () => {
      const syncPath1 = [1, 2];
      const syncPath2 = [3, 4];

      const asyncPathGenerator1 = async function* () {
        yield 1;
        yield 2;
      };

      const asyncPathGenerator2 = async function* () {
        yield 3;
        yield 4;
      };

      const value1 = 1;
      const value2 = 2;

      const syncValueCallback1 = () => value1;
      const syncValueCallback2 = () => value2;

      const asyncValueCallback1 = async () => value1;
      const asyncValueCallback2 = async () => value2;

      const root = new Map([
        [1, new Map([[2, new Map([[dataSymbol, value1]])]])],
        [3, new Map([[4, new Map([[dataSymbol, value2]])]])],
      ]);

      it("setCallback(syncPath, syncValueCallback)", async () => {
        await (
          await trie.setCallback(syncPath1, syncValueCallback1)
        ).setCallback(syncPath2, syncValueCallback2);
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(2);
      });

      it("setCallback(asyncPath, asyncValueCallback)", async () => {
        await (
          await trie.setCallback(asyncPathGenerator1(), asyncValueCallback1)
        ).setCallback(asyncPathGenerator2(), asyncValueCallback2);
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(2);
      });

      it("setCallbackSync(syncPath, syncValueCallback)", () => {
        trie
          .setCallbackSync(syncPath1, syncValueCallback1)
          .setCallbackSync(syncPath2, syncValueCallback2);
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(2);
      });
    });
  });

  describe("has and hasSync method", () => {
    let trie: Trie<number, string | undefined>;

    beforeEach(() => {
      trie = new Trie<number, string | undefined>([
        [[1, 2], "value1"],
        [[2, 2], undefined],
        [[1, w(5), 2], "value2"],
        [[1, w(10)], "value3"],
      ]);
    });

    describe("checking an existing path", () => {
      const syncPath = [1, 2];

      const asyncPathGenerator = async function* () {
        yield 1;
        yield 2;
      };

      it("has(syncPath)", async () => {
        expect(await trie.has(syncPath)).toBe(true);
      });

      it("has(asyncPath)", async () => {
        expect(await trie.has(asyncPathGenerator())).toBe(true);
      });

      it("hasSync(syncPath)", () => {
        expect(trie.hasSync(syncPath)).toBe(true);
      });
    });

    describe("checking an existing path with an undefined value", () => {
      const syncPath = [2, 2];

      const asyncPathGenerator = async function* () {
        yield 2;
        yield 2;
      };

      it("has(syncPath)", async () => {
        expect(await trie.has(syncPath)).toBe(true);
      });

      it("has(asyncPath)", async () => {
        expect(await trie.has(asyncPathGenerator())).toBe(true);
      });

      it("hasSync(syncPath)", () => {
        expect(trie.hasSync(syncPath)).toBe(true);
      });
    });

    describe("checking a non-existing path", () => {
      const syncPath = [1, 3];

      const asyncPathGenerator = async function* () {
        yield 1;
        yield 3;
      };

      it("has(syncPath)", async () => {
        expect(await trie.has(syncPath)).toBe(false);
      });

      it("has(asyncPath)", async () => {
        expect(await trie.has(asyncPathGenerator())).toBe(false);
      });

      it("hasSync(syncPath)", () => {
        expect(trie.hasSync(syncPath)).toBe(false);
      });
    });

    describe("checking a non-existing path with wildcards (partial match)", () => {
      const syncPath = [1, w(5)];

      const asyncPathGenerator = async function* () {
        yield 1;
        yield w(5);
      };

      it("has(syncPath)", async () => {
        expect(await trie.has(syncPath)).toBe(false);
      });

      it("has(asyncPath)", async () => {
        expect(await trie.has(asyncPathGenerator())).toBe(false);
      });

      it("hasSync(syncPath)", () => {
        expect(trie.hasSync(syncPath)).toBe(false);
      });
    });

    describe("checking a non-existing path with wildcards (unmatched count)", () => {
      const syncPath = [1, w(6), 2];

      const asyncPathGenerator = async function* () {
        yield 1;
        yield w(6);
        yield 2;
      };

      it("has(syncPath)", async () => {
        expect(await trie.has(syncPath)).toBe(false);
      });

      it("has(asyncPath)", async () => {
        expect(await trie.has(asyncPathGenerator())).toBe(false);
      });

      it("hasSync(syncPath)", () => {
        expect(trie.hasSync(syncPath)).toBe(false);
      });
    });

    describe("checking an existing path with wildcards (count)", () => {
      const syncPath = [1, w(5), 2];

      const asyncPathGenerator = async function* () {
        yield 1;
        yield w(5);
        yield 2;
      };

      it("has(syncPath)", async () => {
        expect(await trie.has(syncPath)).toBe(true);
      });

      it("has(asyncPath)", async () => {
        expect(await trie.has(asyncPathGenerator())).toBe(true);
      });

      it("hasSync(syncPath)", () => {
        expect(trie.hasSync(syncPath)).toBe(true);
      });
    });

    describe("checking an existing path with wildcards (literal)", () => {
      const syncPath = [1, w(), w(), w(), w(), w(), 2];

      const asyncPathGenerator = async function* () {
        yield 1;
        yield w();
        yield w();
        yield w();
        yield w();
        yield w();
        yield 2;
      };

      it("has(syncPath)", async () => {
        expect(await trie.has(syncPath)).toBe(true);
      });

      it("has(asyncPath)", async () => {
        expect(await trie.has(asyncPathGenerator())).toBe(true);
      });

      it("hasSync(syncPath)", () => {
        expect(trie.hasSync(syncPath)).toBe(true);
      });
    });

    describe("checking an existing path with splitted wildcard paths", () => {
      const syncPath = [1, w(10)];

      const asyncPathGenerator = async function* () {
        yield 1;
        yield w(10);
      };

      it("has(syncPath)", async () => {
        expect(await trie.has(syncPath)).toBe(true);
      });

      it("has(asyncPath)", async () => {
        expect(await trie.has(asyncPathGenerator())).toBe(true);
      });

      it("hasSync(syncPath)", () => {
        expect(trie.hasSync(syncPath)).toBe(true);
      });
    });

    describe("having no side effects", () => {
      let root1: Map<unknown, unknown>;

      beforeEach(() => {
        root1 = clone(trie.root);
      });

      const syncPath1 = [1, 2];
      const syncPath2 = [2, 2];
      const syncPath3 = [1, w(5), 2];
      const syncPath4 = [1, w(10)];
      const syncPath5 = [1, 3];
      const syncPath6 = [1, w(5)];
      const syncPath7 = [1, w(6), 2];

      const asyncPathGenerator1 = async function* () {
        yield 1;
        yield 2;
      };
      const asyncPathGenerator2 = async function* () {
        yield 2;
        yield 2;
      };
      const asyncPathGenerator3 = async function* () {
        yield 1;
        yield w(5);
        yield 2;
      };
      const asyncPathGenerator4 = async function* () {
        yield 1;
        yield w(10);
      };
      const asyncPathGenerator5 = async function* () {
        yield 1;
        yield 3;
      };
      const asyncPathGenerator6 = async function* () {
        yield 1;
        yield w(5);
      };
      const asyncPathGenerator7 = async function* () {
        yield 1;
        yield w(6);
        yield 2;
      };

      it("has(syncPath)", async () => {
        await trie.has(syncPath1);
        await trie.has(syncPath2);
        await trie.has(syncPath3);
        await trie.has(syncPath4);
        await trie.has(syncPath5);
        await trie.has(syncPath6);
        await trie.has(syncPath7);
        expect(trie.root).toStrictEqual(root1);
      });

      it("has(asyncPath)", async () => {
        await trie.has(asyncPathGenerator1());
        await trie.has(asyncPathGenerator2());
        await trie.has(asyncPathGenerator3());
        await trie.has(asyncPathGenerator4());
        await trie.has(asyncPathGenerator5());
        await trie.has(asyncPathGenerator6());
        await trie.has(asyncPathGenerator7());
        expect(trie.root).toStrictEqual(root1);
      });

      it("hasSync(syncPath)", () => {
        trie.has(syncPath1);
        trie.has(syncPath2);
        trie.has(syncPath3);
        trie.has(syncPath4);
        trie.has(syncPath5);
        trie.has(syncPath6);
        trie.has(syncPath7);
        expect(trie.root).toStrictEqual(root1);
      });
    });
  });

  describe("get and getSync method", () => {
    let trie: Trie<number, string | undefined>;

    beforeEach(() => {
      trie = new Trie<number, string | undefined>([
        [[1, 2], "value1"],
        [[2, 2], undefined],
        [[1, w(5), 2], "value2"],
        [[1, w(10)], "value3"],
      ]);
    });

    describe("getting an existing path", () => {
      const syncPath = [1, 2];

      const asyncPathGenerator = async function* () {
        yield 1;
        yield 2;
      };

      const value = "value1";

      it("get(syncPath)", async () => {
        expect(await trie.get(syncPath)).toBe(value);
      });

      it("get(asyncPath)", async () => {
        expect(await trie.get(asyncPathGenerator())).toBe(value);
      });

      it("getSync(syncPath)", () => {
        expect(trie.getSync(syncPath)).toBe(value);
      });
    });

    describe("getting an existing path with an undefined value", () => {
      const syncPath = [2, 2];

      const asyncPathGenerator = async function* () {
        yield 2;
        yield 2;
      };

      it("get(syncPath)", async () => {
        expect(await trie.get(syncPath)).toBe(undefined);
      });

      it("get(asyncPath)", async () => {
        expect(await trie.get(asyncPathGenerator())).toBe(undefined);
      });

      it("getSync(syncPath)", () => {
        expect(trie.getSync(syncPath)).toBe(undefined);
      });
    });

    describe("getting a non-existing path", () => {
      const syncPath = [1, 3];

      const asyncPathGenerator = async function* () {
        yield 1;
        yield 3;
      };

      it("get(syncPath)", async () => {
        expect(await trie.get(syncPath)).toBe(undefined);
      });

      it("get(asyncPath)", async () => {
        expect(await trie.get(asyncPathGenerator())).toBe(undefined);
      });

      it("getSync(syncPath)", () => {
        expect(trie.getSync(syncPath)).toBe(undefined);
      });
    });

    describe("getting a non-existing path with wildcards (partial match)", () => {
      const syncPath = [1, w(5)];

      const asyncPathGenerator = async function* () {
        yield 1;
        yield w(5);
      };

      it("get(syncPath)", async () => {
        expect(await trie.get(syncPath)).toBe(undefined);
      });

      it("get(asyncPath)", async () => {
        expect(await trie.get(asyncPathGenerator())).toBe(undefined);
      });

      it("getSync(syncPath)", () => {
        expect(trie.getSync(syncPath)).toBe(undefined);
      });
    });

    describe("getting a non-existing path with wildcards (unmatched count)", () => {
      const syncPath = [1, w(6), 2];

      const asyncPathGenerator = async function* () {
        yield 1;
        yield w(6);
        yield 2;
      };

      it("get(syncPath)", async () => {
        expect(await trie.get(syncPath)).toBe(undefined);
      });

      it("get(asyncPath)", async () => {
        expect(await trie.get(asyncPathGenerator())).toBe(undefined);
      });

      it("getSync(syncPath)", () => {
        expect(trie.getSync(syncPath)).toBe(undefined);
      });
    });

    describe("getting an existing path with wildcards (count)", () => {
      const syncPath = [1, w(5), 2];

      const asyncPathGenerator = async function* () {
        yield 1;
        yield w(5);
        yield 2;
      };

      it("get(syncPath)", async () => {
        expect(await trie.get(syncPath)).toBe("value2");
      });

      it("get(asyncPath)", async () => {
        expect(await trie.get(asyncPathGenerator())).toBe("value2");
      });

      it("getSync(syncPath)", () => {
        expect(trie.getSync(syncPath)).toBe("value2");
      });
    });

    describe("getting an existing path with wildcards (literal)", () => {
      const syncPath = [1, w(), w(), w(), w(), w(), 2];

      const asyncPathGenerator = async function* () {
        yield 1;
        yield w();
        yield w();
        yield w();
        yield w();
        yield w();
        yield 2;
      };

      it("get(syncPath)", async () => {
        expect(await trie.get(syncPath)).toBe("value2");
      });

      it("get(asyncPath)", async () => {
        expect(await trie.get(asyncPathGenerator())).toBe("value2");
      });

      it("getSync(syncPath)", () => {
        expect(trie.getSync(syncPath)).toBe("value2");
      });
    });

    describe("getting an existing path with splitted wildcard paths", () => {
      const syncPath = [1, w(10)];

      const asyncPathGenerator = async function* () {
        yield 1;
        yield w(10);
      };

      it("get(syncPath)", async () => {
        expect(await trie.get(syncPath)).toBe("value3");
      });

      it("get(asyncPath)", async () => {
        expect(await trie.get(asyncPathGenerator())).toBe("value3");
      });

      it("getSync(syncPath)", () => {
        expect(trie.getSync(syncPath)).toBe("value3");
      });
    });

    describe("having no side effects", () => {
      let root1: Map<unknown, unknown>;

      beforeEach(() => {
        root1 = clone(trie.root);
      });

      const syncPath1 = [1, 2];
      const syncPath2 = [2, 2];
      const syncPath3 = [1, w(5), 2];
      const syncPath4 = [1, w(10)];
      const syncPath5 = [1, 3];
      const syncPath6 = [1, w(5)];
      const syncPath7 = [1, w(6), 2];

      const asyncPathGenerator1 = async function* () {
        yield 1;
        yield 2;
      };
      const asyncPathGenerator2 = async function* () {
        yield 2;
        yield 2;
      };
      const asyncPathGenerator3 = async function* () {
        yield 1;
        yield w(5);
        yield 2;
      };
      const asyncPathGenerator4 = async function* () {
        yield 1;
        yield w(10);
      };
      const asyncPathGenerator5 = async function* () {
        yield 1;
        yield 3;
      };
      const asyncPathGenerator6 = async function* () {
        yield 1;
        yield w(5);
      };
      const asyncPathGenerator7 = async function* () {
        yield 1;
        yield w(6);
        yield 2;
      };

      it("get(syncPath)", async () => {
        await trie.get(syncPath1);
        await trie.get(syncPath2);
        await trie.get(syncPath3);
        await trie.get(syncPath4);
        await trie.get(syncPath5);
        await trie.get(syncPath6);
        await trie.get(syncPath7);
        expect(trie.root).toStrictEqual(root1);
      });

      it("get(asyncPath)", async () => {
        await trie.get(asyncPathGenerator1());
        await trie.get(asyncPathGenerator2());
        await trie.get(asyncPathGenerator3());
        await trie.get(asyncPathGenerator4());
        await trie.get(asyncPathGenerator5());
        await trie.get(asyncPathGenerator6());
        await trie.get(asyncPathGenerator7());
        expect(trie.root).toStrictEqual(root1);
      });

      it("getSync(syncPath)", () => {
        trie.get(syncPath1);
        trie.get(syncPath2);
        trie.get(syncPath3);
        trie.get(syncPath4);
        trie.get(syncPath5);
        trie.get(syncPath6);
        trie.get(syncPath7);
        expect(trie.root).toStrictEqual(root1);
      });
    });
  });

  describe("delete and deleteSync method", () => {
    let trie: Trie<number, string | undefined>;

    beforeEach(() => {
      trie = new Trie<number, string | undefined>([
        [[1, 2], "value1"],
        [[2, 2], undefined],
        [[1, w(5), 2], "value2"],
        [[1, w(10)], "value3"],
        [[3, w(3)], "value4"],
      ]);
    });

    describe("deleting an existing path", () => {
      const syncPath = [1, 2];

      const asyncPathGenerator = async function* () {
        yield 1;
        yield 2;
      };

      const root = new Map([
        [
          1,
          new Map<unknown, unknown>([
            [
              wildcardSymbol,
              new Map<unknown, unknown>([
                [wildcardCountSymbol, 5],
                [2, new Map([[dataSymbol, "value2"]])],
                [
                  wildcardSymbol,
                  new Map<unknown, unknown>([
                    [wildcardCountSymbol, 5],
                    [dataSymbol, "value3"],
                  ]),
                ],
              ]),
            ],
          ]),
        ],
        [2, new Map([[2, new Map([[dataSymbol, undefined]])]])],
        [
          3,
          new Map([
            [
              wildcardSymbol,
              new Map<unknown, unknown>([
                [wildcardCountSymbol, 3],
                [dataSymbol, "value4"],
              ]),
            ],
          ]),
        ],
      ]);

      it("delete(syncPath)", async () => {
        expect(await trie.delete(syncPath)).toBe(true);
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(4);
      });

      it("delete(asyncPath)", async () => {
        expect(await trie.delete(asyncPathGenerator())).toBe(true);
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(4);
      });

      it("deleteSync(syncPath)", () => {
        expect(trie.deleteSync(syncPath)).toBe(true);
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(4);
      });
    });

    describe("deleting an existing path to an undefined value", () => {
      const syncPath = [2, 2];

      const asyncPathGenerator = async function* () {
        yield 2;
        yield 2;
      };

      const root = new Map([
        [
          1,
          new Map<unknown, unknown>([
            [2, new Map([[dataSymbol, "value1"]])],
            [
              wildcardSymbol,
              new Map<unknown, unknown>([
                [wildcardCountSymbol, 5],
                [2, new Map([[dataSymbol, "value2"]])],
                [
                  wildcardSymbol,
                  new Map<unknown, unknown>([
                    [wildcardCountSymbol, 5],
                    [dataSymbol, "value3"],
                  ]),
                ],
              ]),
            ],
          ]),
        ],
        [
          3,
          new Map([
            [
              wildcardSymbol,
              new Map<unknown, unknown>([
                [wildcardCountSymbol, 3],
                [dataSymbol, "value4"],
              ]),
            ],
          ]),
        ],
      ]);

      it("delete(syncPath)", async () => {
        expect(await trie.delete(syncPath)).toBe(true);
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(4);
      });

      it("delete(asyncPath)", async () => {
        expect(await trie.delete(asyncPathGenerator())).toBe(true);
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(4);
      });

      it("deleteSync(syncPath)", () => {
        expect(trie.deleteSync(syncPath)).toBe(true);
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(4);
      });
    });

    describe("deleting a non-existing path", () => {
      let root1: Map<unknown, unknown>;
      const syncPath = [1, 3];

      const asyncPathGenerator = async function* () {
        yield 1;
        yield 3;
      };

      const root = new Map([
        [
          1,
          new Map<unknown, unknown>([
            [2, new Map([[dataSymbol, "value1"]])],
            [
              wildcardSymbol,
              new Map<unknown, unknown>([
                [wildcardCountSymbol, 5],
                [2, new Map([[dataSymbol, "value2"]])],
                [
                  wildcardSymbol,
                  new Map<unknown, unknown>([
                    [wildcardCountSymbol, 5],
                    [dataSymbol, "value3"],
                  ]),
                ],
              ]),
            ],
          ]),
        ],
        [2, new Map([[2, new Map([[dataSymbol, undefined]])]])],
        [
          3,
          new Map([
            [
              wildcardSymbol,
              new Map<unknown, unknown>([
                [wildcardCountSymbol, 3],
                [dataSymbol, "value4"],
              ]),
            ],
          ]),
        ],
      ]);

      beforeEach(() => {
        root1 = clone(trie.root);
      });

      it("delete(syncPath)", async () => {
        expect(await trie.delete(syncPath)).toBe(false);
        expect(trie.root).toStrictEqual(root);
        expect(trie.root).toStrictEqual(root1);
        expect(trie.size).toBe(5);
      });

      it("delete(asyncPath)", async () => {
        expect(await trie.delete(asyncPathGenerator())).toBe(false);
        expect(trie.root).toStrictEqual(root);
        expect(trie.root).toStrictEqual(root1);
        expect(trie.size).toBe(5);
      });

      it("deleteSync(syncPath)", () => {
        expect(trie.deleteSync(syncPath)).toBe(false);
        expect(trie.root).toStrictEqual(root);
        expect(trie.root).toStrictEqual(root1);
        expect(trie.size).toBe(5);
      });
    });

    describe("deleting a non-existing path with wildcards (partial match)", () => {
      let root1: Map<unknown, unknown>;
      const syncPath = [1, w(5)];

      const asyncPathGenerator = async function* () {
        yield 1;
        yield w(5);
      };

      const root = new Map([
        [
          1,
          new Map<unknown, unknown>([
            [2, new Map([[dataSymbol, "value1"]])],
            [
              wildcardSymbol,
              new Map<unknown, unknown>([
                [wildcardCountSymbol, 5],
                [2, new Map([[dataSymbol, "value2"]])],
                [
                  wildcardSymbol,
                  new Map<unknown, unknown>([
                    [wildcardCountSymbol, 5],
                    [dataSymbol, "value3"],
                  ]),
                ],
              ]),
            ],
          ]),
        ],
        [2, new Map([[2, new Map([[dataSymbol, undefined]])]])],
        [
          3,
          new Map([
            [
              wildcardSymbol,
              new Map<unknown, unknown>([
                [wildcardCountSymbol, 3],
                [dataSymbol, "value4"],
              ]),
            ],
          ]),
        ],
      ]);

      beforeEach(() => {
        root1 = clone(trie.root);
      });

      it("delete(syncPath)", async () => {
        expect(await trie.delete(syncPath)).toBe(false);
        expect(trie.root).toStrictEqual(root);
        expect(trie.root).toStrictEqual(root1);
        expect(trie.size).toBe(5);
      });

      it("delete(asyncPath)", async () => {
        expect(await trie.delete(asyncPathGenerator())).toBe(false);
        expect(trie.root).toStrictEqual(root);
        expect(trie.root).toStrictEqual(root1);
        expect(trie.size).toBe(5);
      });

      it("deleteSync(syncPath)", () => {
        expect(trie.deleteSync(syncPath)).toBe(false);
        expect(trie.root).toStrictEqual(root);
        expect(trie.root).toStrictEqual(root1);
        expect(trie.size).toBe(5);
      });
    });

    describe("deleting a non-existing path with wildcards (unmatched count)", () => {
      let root1: Map<unknown, unknown>;
      const syncPath = [1, w(6), 2];

      const asyncPathGenerator = async function* () {
        yield 1;
        yield w(6);
        yield 2;
      };

      const root = new Map([
        [
          1,
          new Map<unknown, unknown>([
            [2, new Map([[dataSymbol, "value1"]])],
            [
              wildcardSymbol,
              new Map<unknown, unknown>([
                [wildcardCountSymbol, 5],
                [2, new Map([[dataSymbol, "value2"]])],
                [
                  wildcardSymbol,
                  new Map<unknown, unknown>([
                    [wildcardCountSymbol, 5],
                    [dataSymbol, "value3"],
                  ]),
                ],
              ]),
            ],
          ]),
        ],
        [2, new Map([[2, new Map([[dataSymbol, undefined]])]])],
        [
          3,
          new Map([
            [
              wildcardSymbol,
              new Map<unknown, unknown>([
                [wildcardCountSymbol, 3],
                [dataSymbol, "value4"],
              ]),
            ],
          ]),
        ],
      ]);

      beforeEach(() => {
        root1 = clone(trie.root);
      });

      it("delete(syncPath)", async () => {
        expect(await trie.delete(syncPath)).toBe(false);
        expect(trie.root).toStrictEqual(root);
        expect(trie.root).toStrictEqual(root1);
        expect(trie.size).toBe(5);
      });

      it("delete(asyncPath)", async () => {
        expect(await trie.delete(asyncPathGenerator())).toBe(false);
        expect(trie.root).toStrictEqual(root);
        expect(trie.root).toStrictEqual(root1);
        expect(trie.size).toBe(5);
      });

      it("deleteSync(syncPath)", () => {
        expect(trie.deleteSync(syncPath)).toBe(false);
        expect(trie.root).toStrictEqual(root);
        expect(trie.root).toStrictEqual(root1);
        expect(trie.size).toBe(5);
      });
    });

    describe("deleting an existing path with multiple wildcards (count)", () => {
      const syncPath = [3, w(3)];

      const asyncPathGenerator = async function* () {
        yield 3;
        yield w(3);
      };

      const root = new Map([
        [
          1,
          new Map<unknown, unknown>([
            [2, new Map([[dataSymbol, "value1"]])],
            [
              wildcardSymbol,
              new Map<unknown, unknown>([
                [wildcardCountSymbol, 5],
                [2, new Map([[dataSymbol, "value2"]])],
                [
                  wildcardSymbol,
                  new Map<unknown, unknown>([
                    [wildcardCountSymbol, 5],
                    [dataSymbol, "value3"],
                  ]),
                ],
              ]),
            ],
          ]),
        ],
        [2, new Map([[2, new Map([[dataSymbol, undefined]])]])],
      ]);

      it("delete(syncPath)", async () => {
        expect(await trie.delete(syncPath)).toBe(true);
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(4);
      });

      it("delete(asyncPath)", async () => {
        expect(await trie.delete(asyncPathGenerator())).toBe(true);
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(4);
      });

      it("deleteSync(syncPath)", () => {
        expect(trie.deleteSync(syncPath)).toBe(true);
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(4);
      });
    });

    describe("deleting an existing path with multiple wildcards (literal)", () => {
      const syncPath = [3, w(), w(), w()];

      const asyncPathGenerator = async function* () {
        yield 3;
        yield w();
        yield w();
        yield w();
      };

      const root = new Map([
        [
          1,
          new Map<unknown, unknown>([
            [2, new Map([[dataSymbol, "value1"]])],
            [
              wildcardSymbol,
              new Map<unknown, unknown>([
                [wildcardCountSymbol, 5],
                [2, new Map([[dataSymbol, "value2"]])],
                [
                  wildcardSymbol,
                  new Map<unknown, unknown>([
                    [wildcardCountSymbol, 5],
                    [dataSymbol, "value3"],
                  ]),
                ],
              ]),
            ],
          ]),
        ],
        [2, new Map([[2, new Map([[dataSymbol, undefined]])]])],
      ]);

      it("delete(syncPath)", async () => {
        expect(await trie.delete(syncPath)).toBe(true);
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(4);
      });

      it("delete(asyncPath)", async () => {
        expect(await trie.delete(asyncPathGenerator())).toBe(true);
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(4);
      });

      it("deleteSync(syncPath)", () => {
        expect(trie.deleteSync(syncPath)).toBe(true);
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(4);
      });
    });

    describe("deleting an existing path with a short branch of wildcards", () => {
      const syncPath = [1, w(5), 2];

      const asyncPathGenerator = async function* () {
        yield 1;
        yield w(5);
        yield 2;
      };

      const root = new Map([
        [
          1,
          new Map<unknown, unknown>([
            [2, new Map([[dataSymbol, "value1"]])],
            [
              wildcardSymbol,
              new Map<unknown, unknown>([
                [wildcardCountSymbol, 10],
                [dataSymbol, "value3"],
              ]),
            ],
          ]),
        ],
        [2, new Map([[2, new Map([[dataSymbol, undefined]])]])],
        [
          3,
          new Map([
            [
              wildcardSymbol,
              new Map<unknown, unknown>([
                [wildcardCountSymbol, 3],
                [dataSymbol, "value4"],
              ]),
            ],
          ]),
        ],
      ]);

      it("delete(syncPath)", async () => {
        expect(await trie.delete(syncPath)).toBe(true);
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(4);
      });

      it("delete(asyncPath)", async () => {
        expect(await trie.delete(asyncPathGenerator())).toBe(true);
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(4);
      });

      it("deleteSync(syncPath)", () => {
        expect(trie.deleteSync(syncPath)).toBe(true);
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(4);
      });
    });

    describe("deleting an existing path with a long branch of wildcards", () => {
      const syncPath = [1, w(10)];

      const asyncPathGenerator = async function* () {
        yield 1;
        yield w(10);
      };

      const root = new Map([
        [
          1,
          new Map<unknown, unknown>([
            [2, new Map([[dataSymbol, "value1"]])],
            [
              wildcardSymbol,
              new Map<unknown, unknown>([
                [wildcardCountSymbol, 5],
                [2, new Map([[dataSymbol, "value2"]])],
              ]),
            ],
          ]),
        ],
        [2, new Map([[2, new Map([[dataSymbol, undefined]])]])],
        [
          3,
          new Map([
            [
              wildcardSymbol,
              new Map<unknown, unknown>([
                [wildcardCountSymbol, 3],
                [dataSymbol, "value4"],
              ]),
            ],
          ]),
        ],
      ]);

      it("delete(syncPath)", async () => {
        expect(await trie.delete(syncPath)).toBe(true);
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(4);
      });

      it("delete(asyncPath)", async () => {
        expect(await trie.delete(asyncPathGenerator())).toBe(true);
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(4);
      });

      it("deleteSync(syncPath)", () => {
        expect(trie.deleteSync(syncPath)).toBe(true);
        expect(trie.root).toStrictEqual(root);
        expect(trie.size).toBe(4);
      });
    });
  });

  describe("clear method", () => {
    let trie: Trie<number, string | undefined>;

    beforeEach(() => {
      trie = new Trie<number, string | undefined>([
        [[1, 2], "value1"],
        [[2, 2], undefined],
        [[1, w(5), 2], "value2"],
        [[1, w(10)], "value3"],
        [[3, w(3)], "value4"],
      ]);
    });

    const root = new Map([
      [
        1,
        new Map<unknown, unknown>([
          [2, new Map([[dataSymbol, "value1"]])],
          [
            wildcardSymbol,
            new Map<unknown, unknown>([
              [wildcardCountSymbol, 5],
              [2, new Map([[dataSymbol, "value2"]])],
              [
                wildcardSymbol,
                new Map<unknown, unknown>([
                  [wildcardCountSymbol, 5],
                  [dataSymbol, "value3"],
                ]),
              ],
            ]),
          ],
        ]),
      ],
      [2, new Map([[2, new Map([[dataSymbol, undefined]])]])],
      [
        3,
        new Map([
          [
            wildcardSymbol,
            new Map<unknown, unknown>([
              [wildcardCountSymbol, 3],
              [dataSymbol, "value4"],
            ]),
          ],
        ]),
      ],
    ]);

    it("clearing the Trie", () => {
      expect(trie.size).toBe(5);
      expect(trie.root).toStrictEqual(root);
      expect(trie.clear()).toBe(undefined);
      expect(trie.root).toStrictEqual(new Map());
      expect(trie.size).toBe(0);
    });
  });

  describe("match and matchSync method", () => {
    let trie: Trie<number, symbol | undefined>;
    const v1 = Symbol();
    const v2 = Symbol();
    const v3 = Symbol();

    beforeEach(() => {
      trie = new Trie<number, symbol | undefined>([
        [[1, 2], v1],
        [[2, 2], undefined],
        [[1, w(5), 2], v2],
        [[1, w(10)], v3],
        [[3, w(3)], v1],
        [[4, w()], v2],
        [[4, 0], v3],
      ]);
    });

    describe("matching against an existing path", () => {
      const syncPath = [1, 2];

      const asyncPathGenerator = async function* () {
        yield 1;
        yield 2;
      };

      const values = [v1];

      it("match(syncPath)", async () => {
        let count = 0;
        for await (const result of trie.match(syncPath)) {
          expect(result).toBe(values[count]);
          count++;
        }
        expect(count).toBe(values.length);
      });

      it("match(asyncPath)", async () => {
        let count = 0;
        for await (const result of trie.match(asyncPathGenerator())) {
          expect(result).toBe(values[count]);
          count++;
        }
        expect(count).toBe(values.length);
      });

      it("matchSync(syncPath)", () => {
        let count = 0;
        for (const result of trie.matchSync(syncPath)) {
          expect(result).toBe(values[count]);
          count++;
        }
        expect(count).toBe(values.length);
      });
    });

    describe("matching against an existing path with undefined value", () => {
      const syncPath = [2, 2];

      const asyncPathGenerator = async function* () {
        yield 2;
        yield 2;
      };

      const values = [undefined];

      it("match(syncPath)", async () => {
        let count = 0;
        for await (const result of trie.match(syncPath)) {
          expect(result).toBe(values[count]);
          count++;
        }
        expect(count).toBe(values.length);
      });

      it("match(asyncPath)", async () => {
        let count = 0;
        for await (const result of trie.match(asyncPathGenerator())) {
          expect(result).toBe(values[count]);
          count++;
        }
        expect(count).toBe(values.length);
      });

      it("matchSync(syncPath)", () => {
        let count = 0;
        for (const result of trie.matchSync(syncPath)) {
          expect(result).toBe(values[count]);
          count++;
        }
        expect(count).toBe(values.length);
      });
    });

    describe("matching against a non-existing path", () => {
      const syncPath = [1, 3];

      const asyncPathGenerator = async function* () {
        yield 1;
        yield 3;
      };

      it("match(syncPath)", async () => {
        for await (const _ of trie.match(syncPath)) {
          _;
          expect.unreachable("should be unreachable");
        }
      });

      it("match(asyncPath)", async () => {
        for await (const _ of trie.match(asyncPathGenerator())) {
          _;
          expect.unreachable("should be unreachable");
        }
      });

      it("matchSync(syncPath)", () => {
        for (const _ of trie.matchSync(syncPath)) {
          _;
          expect.unreachable("should be unreachable");
        }
      });
    });

    describe("matching against an existing path with wildcards", () => {
      const syncPath = [3, 1, 2, 3];

      const asyncPathGenerator = async function* () {
        yield 3;
        yield 1;
        yield 2;
        yield 3;
      };

      const values = [v1];

      it("match(syncPath)", async () => {
        let count = 0;
        for await (const result of trie.match(syncPath)) {
          expect(result).toBe(values[count]);
          count++;
        }
        expect(count).toBe(values.length);
      });

      it("match(asyncPath)", async () => {
        let count = 0;
        for await (const result of trie.match(asyncPathGenerator())) {
          expect(result).toBe(values[count]);
          count++;
        }
        expect(count).toBe(values.length);
      });

      it("matchSync(syncPath)", () => {
        let count = 0;
        for (const result of trie.matchSync(syncPath)) {
          expect(result).toBe(values[count]);
          count++;
        }
        expect(count).toBe(values.length);
      });
    });

    describe("matching against multiple existing paths with wildcards 1", () => {
      const syncPath = [1, 2, 3, 4, 5, 6, 2];

      const asyncPathGenerator = async function* () {
        yield 1;
        yield 2;
        yield 3;
        yield 4;
        yield 5;
        yield 6;
        yield 2;
      };

      const values = [v2, v1];

      it("match(syncPath)", async () => {
        let count = 0;
        for await (const result of trie.match(syncPath)) {
          expect(result).toBe(values[count]);
          count++;
        }
        expect(count).toBe(values.length);
      });

      it("match(asyncPath)", async () => {
        let count = 0;
        for await (const result of trie.match(asyncPathGenerator())) {
          expect(result).toBe(values[count]);
          count++;
        }
        expect(count).toBe(values.length);
      });

      it("matchSync(syncPath)", () => {
        let count = 0;
        for (const result of trie.matchSync(syncPath)) {
          expect(result).toBe(values[count]);
          count++;
        }
        expect(count).toBe(values.length);
      });
    });

    describe("matching against multiple existing paths with wildcards 2", () => {
      const syncPath = [1, 2, 0, 0, 0, 0, 2, 0, 0, 0, 0];

      const asyncPathGenerator = async function* () {
        yield 1;
        yield 2;
        yield 0;
        yield 0;
        yield 0;
        yield 0;
        yield 2;
        yield 0;
        yield 0;
        yield 0;
        yield 0;
      };

      const values = [v3, v2, v1];

      it("match(syncPath)", async () => {
        let count = 0;
        for await (const result of trie.match(syncPath)) {
          expect(result).toBe(values[count]);
          count++;
        }
        expect(count).toBe(values.length);
      });

      it(
        "match(asyncPath)",
        async () => {
          let count = 0;
          for await (const result of trie.match(asyncPathGenerator())) {
            expect(result).toBe(values[count]);
            count++;
          }
          expect(count).toBe(values.length);
        },
        { timeout: 100000 },
      );

      it("matchSync(syncPath)", () => {
        let count = 0;
        for (const result of trie.matchSync(syncPath)) {
          expect(result).toBe(values[count]);
          count++;
        }
        expect(count).toBe(values.length);
      });
    });

    describe("matching against multiple existing paths with wildcards 3", () => {
      const syncPath = [4, 0];

      const asyncPathGenerator = async function* () {
        yield 4;
        yield 0;
      };

      const values = [v2, v3];

      it("match(syncPath)", async () => {
        let count = 0;
        for await (const result of trie.match(syncPath)) {
          expect(result).toBe(values[count]);
          count++;
        }
        expect(count).toBe(values.length);
      });

      it("match(asyncPath)", async () => {
        let count = 0;
        for await (const result of trie.match(asyncPathGenerator())) {
          expect(result).toBe(values[count]);
          count++;
        }
        expect(count).toBe(values.length);
      });

      it("matchSync(syncPath)", () => {
        let count = 0;
        for (const result of trie.matchSync(syncPath)) {
          expect(result).toBe(values[count]);
          count++;
        }
        expect(count).toBe(values.length);
      });
    });

    describe("matching against a non-existing path (partial match)", () => {
      const syncPath = [1, 0, 0, 0, 0, 0];

      const asyncPathGenerator = async function* () {
        yield 1;
        yield 0;
        yield 0;
        yield 0;
        yield 0;
        yield 0;
      };

      it("match(syncPath)", async () => {
        for await (const _ of trie.match(syncPath)) {
          _;
          expect.unreachable("should be unreachable");
        }
      });

      it("match(asyncPath)", async () => {
        for await (const _ of trie.match(asyncPathGenerator())) {
          _;
          expect.unreachable("should be unreachable");
        }
      });

      it("matchSync(syncPath)", () => {
        for (const _ of trie.matchSync(syncPath)) {
          _;
          expect.unreachable("should be unreachable");
        }
      });
    });

    describe("having no side effects", () => {
      let root1: Map<unknown, unknown>;

      beforeEach(() => {
        root1 = clone(trie.root);
      });

      const syncPath1 = [1, 2];
      const syncPath2 = [2, 2];
      const syncPath3 = [1, 3];
      const syncPath4 = [3, 1, 2, 3];
      const syncPath5 = [1, 2, 3, 4, 5, 6, 2];
      const syncPath6 = [1, 2, 0, 0, 0, 0, 2, 0, 0, 0, 0];
      const syncPath7 = [4, 0];
      const syncPath8 = [1, 0, 0, 0, 0, 0];

      const asyncPathGenerator1 = async function* () {
        yield 1;
        yield 2;
      };
      const asyncPathGenerator2 = async function* () {
        yield 2;
        yield 2;
      };
      const asyncPathGenerator3 = async function* () {
        yield 1;
        yield 3;
      };
      const asyncPathGenerator4 = async function* () {
        yield 3;
        yield 1;
        yield 2;
        yield 3;
      };
      const asyncPathGenerator5 = async function* () {
        yield 1;
        yield 2;
        yield 3;
        yield 4;
        yield 5;
        yield 6;
        yield 2;
      };
      const asyncPathGenerator6 = async function* () {
        yield 1;
        yield 2;
        yield 0;
        yield 0;
        yield 0;
        yield 0;
        yield 2;
        yield 0;
        yield 0;
        yield 0;
        yield 0;
      };
      const asyncPathGenerator7 = async function* () {
        yield 4;
        yield 0;
      };
      const asyncPathGenerator8 = async function* () {
        yield 1;
        yield 0;
        yield 0;
        yield 0;
        yield 0;
        yield 0;
      };

      it("match(syncPath)", async () => {
        for await (const _ of trie.match(syncPath1)) {
          _;
        }
        for await (const _ of trie.match(syncPath2)) {
          _;
        }
        for await (const _ of trie.match(syncPath3)) {
          _;
        }
        for await (const _ of trie.match(syncPath4)) {
          _;
        }
        for await (const _ of trie.match(syncPath5)) {
          _;
        }
        for await (const _ of trie.match(syncPath6)) {
          _;
        }
        for await (const _ of trie.match(syncPath7)) {
          _;
        }
        for await (const _ of trie.match(syncPath8)) {
          _;
        }
        expect(trie.root).toStrictEqual(root1);
      });

      it("match(asyncPath)", async () => {
        for await (const _ of trie.match(asyncPathGenerator1())) {
          _;
        }
        for await (const _ of trie.match(asyncPathGenerator2())) {
          _;
        }
        for await (const _ of trie.match(asyncPathGenerator3())) {
          _;
        }
        for await (const _ of trie.match(asyncPathGenerator4())) {
          _;
        }
        for await (const _ of trie.match(asyncPathGenerator5())) {
          _;
        }
        for await (const _ of trie.match(asyncPathGenerator6())) {
          _;
        }
        for await (const _ of trie.match(asyncPathGenerator7())) {
          _;
        }
        for await (const _ of trie.match(asyncPathGenerator8())) {
          _;
        }
        expect(trie.root).toStrictEqual(root1);
      });

      it("matchSync(syncPath)", () => {
        for (const _ of trie.matchSync(syncPath1)) {
          _;
        }
        for (const _ of trie.matchSync(syncPath2)) {
          _;
        }
        for (const _ of trie.matchSync(syncPath3)) {
          _;
        }
        for (const _ of trie.matchSync(syncPath4)) {
          _;
        }
        for (const _ of trie.matchSync(syncPath5)) {
          _;
        }
        for (const _ of trie.matchSync(syncPath6)) {
          _;
        }
        for (const _ of trie.matchSync(syncPath7)) {
          _;
        }
        for (const _ of trie.matchSync(syncPath8)) {
          _;
        }
        expect(trie.root).toStrictEqual(root1);
      });
    });
  });
}
