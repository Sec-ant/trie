# @sec-ant/trie

A TypeScript Trie for matching sequence prefixes with fixed-length wildcards.

- **Generic keys and values**: Store path segments and values of any type.
- **Fixed-length wildcards**: Use `w(n)` to match exactly `n` elements. Adjacent wildcard segments share a combined count.
- **Iterable inputs**: Build and query rules with synchronous or asynchronous iterables.
- **Generator results**: Receive matching values as traversal progresses, in wildcard-first order.
- **Shared prefixes**: Rules share ordinary prefixes and compressed wildcard branches.
- **Typed APIs**: Synchronous and asynchronous operations include TypeScript declarations.

<table align="center">
<tbody>
<tr align="center">
<td>When constructing a Trie like this, </td>
<td>the internal structure will be like</td>
</tr>
<tr>
<td>

```ts
new Trie([
  [[1, 2], "12"],
  [[2, w(5), 3], "2*****3"],
  [[2, w(3), 4], "2***4"],
]);
```

</td>
<td>

```
Map {
  1 => Map {
    2 => Map {
      [sym:d] => "12",
    },
  },
  2 => Map {
    [sym:*] => Map {
      [sym:c] => 3,
      [sym:*] => Map {
        [sym:c] => 2,
        3 => Map {
          [sym:d] => "2*****3",
        },
      },
      4 => Map {
        [sym:d] => "2***4",
      },
    },
  },
}
```

</td>
</tr>
</tbody>
</table>

## Installation

To install this package, use the following command:

```bash
npm install @sec-ant/trie
```

## Usage

Here's a basic example of how to use this Trie implementation:

```typescript
import { Trie, w } from "@sec-ant/trie";

// Create a new Trie
const trie = new Trie<string, string>();

// Set an exact path
trie.setSync(["path", "with", "no", "wildcard"], "value1");

// Set another path with wildcards to the Trie
trie.setSync(["path", "with", w(2), w(2), "wildcards"], "value2");

// Check if the first path exists in the Trie
console.log(trie.hasSync(["path", "with", "no", "wildcard"])); // true

// Check if the second path exists in the Trie (you can combine consecutive wildcards into one)
console.log(trie.hasSync(["path", "with", w(4), "wildcards"])); // true

// Retrieve the value of the first path
console.log(trie.getSync(["path", "with", "no", "wildcard"])); // "value1"

// Retrieve the value of the second path (you can split consecutive wildcards into multi-parts)
console.log(trie.getSync(["path", "with", w(1), w(3), "wildcards"])); // "value2"

// Match against a path and generate values
for (const value of trie.matchSync([
  "path",
  "with",
  "no",
  "wildcard",
  "or",
  "with",
  "wildcards",
])) {
  console.log(value); // "value2" then "value1" (wildcard branches are visited first)
}

// Delete a path from the Trie
trie.deleteSync(["path", "with", w(4), "wildcards"]);

// Clear all paths from the Trie
trie.clear();
```

## API

### Matching semantics

Rules match prefixes anchored at the beginning of the input. Successful matches
allow trailing input. `w(n)` consumes exactly `n` elements, and adjacent wildcard
segments are equivalent to a single segment with their combined count.

`get` and `has` look up stored rules, including their wildcard segments. Use
`match` or `matchSync` to match concrete input against those rules. Ordinary path
segments use `Map` key equality: objects match by identity, and `NaN` matches
`NaN`.

Results follow depth-first, wildcard-first order: a node's value, its wildcard
subtree, then its matching ordinary child. Each matching rule contributes one
value, including rules that store the same value. Wildcard-first traversal can
read farther into the input before yielding a shorter ordinary rule. A shared
buffer retains input needed by pending branches.

Both match methods manage the iterator obtained from the input. For an active
iterator, matching calls `return()` on completion, early consumer exit, or a read
failure. An exhausted iterator completes through its `done: true` result. Leaf
nodes finish at their matched position; pending branches can require additional
input. Resource adapters can coordinate iterator ownership, replay, and continued
consumption of the underlying data.

### Asynchronous mutations

`set`, `setCallback`, and `delete` collect finite input paths, then commit each
mutation against the current tree. The `size` property counts stored rules
across concurrent mutations.

`setCallback` receives a snapshot of the value and existence flag at invocation.
Its returned value is committed against the current tree when the callback
resolves. Overlapping callbacks can observe the same snapshot; the last callback
to complete wins. Sequentially awaited updates let each callback observe the
preceding commit.

### `w`

This is a function to create wildcard segments that can be used in a path when constructing the Trie:

```ts
/**
 * Creates a wildcard path segment with an optional count.
 * @param count - Optional count for the wildcard. Default is 1.
 * @returns A wildcard path segment.
 */
export declare function w(count?: number): WildcardSegment;
```

### `Trie`

#### Methods

The `Trie` class provides the following methods:

- `constructor(initialEntries?: Iterable<[Iterable<I | WildcardSegment>, V]>)`: Constructs a new Trie. Optionally populates the Trie with initial entries.
- `add(initialEntries: AnyIterable<[AnyIterable<I | WildcardSegment>, V]>)`: Asynchronously adds paths to the Trie with the specified values.
- `addSync(initialEntries: Iterable<[Iterable<I | WildcardSegment>, V]>)`: Synchronously adds paths to the Trie with the specified values.
- `set(path: AnyIterable<I | WildcardSegment>, value: V)`: Asynchronously sets the value for a path in the Trie.
- `setSync(path: Iterable<I | WildcardSegment>, value: V)`: Synchronously sets the value for a path in the Trie.
- `setCallback(path, callback)`: Asynchronously computes a value from the previous value and an existence flag, then stores it. The callback may return a promise.
- `setCallbackSync(path, callback)`: Synchronously computes and stores a value using the same callback arguments.
- `has(path: AnyIterable<I | WildcardSegment>)`: Asynchronously checks if a path exists in the Trie.
- `hasSync(path: Iterable<I | WildcardSegment>)`: Synchronously checks if a path exists in the Trie.
- `get(path: AnyIterable<I | WildcardSegment>)`: Asynchronously retrieves the value associated with a path in the Trie.
- `getSync(path: Iterable<I | WildcardSegment>)`: Synchronously retrieves the value associated with a path in the Trie.
- `delete(path: AnyIterable<I | WildcardSegment>)`: Asynchronously deletes a path from the Trie.
- `deleteSync(path: Iterable<I | WildcardSegment>)`: Synchronously deletes a path from the Trie.
- `clear()`: Clears all paths from the Trie.
- `match(path: AnyIterable<I>)`: Asynchronously searches for values matching a given path. Returns an asynchronous generator.
- `matchSync(path: Iterable<I>)`: Synchronously searches for values matching a given path. Returns a generator.

#### Properties

The `Trie` class provides the following properties:

- `size`: Get the size of the Trie, i.e., the number of paths. This value is read only.

## Development

Use Node.js 24 and the pnpm version pinned in `package.json`.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm browser
pnpm build
pnpm test:ci
pnpm coverage
pnpm test:package
```

`pnpm build` validates formatting, lint, and types, then emits the ES2020 ESM
bundle and declarations. `pnpm test:ci` runs the in-source and
regression tests in Node.js, Chromium, and Firefox. `pnpm test:package` packs and
installs the actual tarball in a temporary directory, then checks runtime
behavior and TypeScript consumers using ES2020 libraries with NodeNext and
Bundler resolution.

Use `pnpm check:fix` to apply formatting and lint fixes. Biome owns code and
JSON; Prettier owns Markdown and YAML. Git hooks run lint-staged and commitlint.
CI validates Node.js 22 and 24, both browsers, coverage, and the packed package.

Run `pnpm bench` for local matching benchmarks. An optional absolute path to a
baseline ESM implementation can be passed as `pnpm bench /path/to/baseline.mjs`.
The output reports median microseconds per operation across nine rounds;
results depend on the machine, runtime, and workload.

Run `pnpm changeset` for user-facing changes and `pnpm version-packages` to
prepare release versions and changelogs.

### Releases

The release workflow creates a version pull request from changesets on `main`.
Merging that pull request builds, validates, and packs the release. A separate
publish job publishes the verified tarball to npm with OIDC authentication and
provenance, then creates the Git tag and GitHub release.

The npm trusted publisher identifies owner `Sec-ant`, repository `trie`, and
workflow `release.yml`, with direct publishing enabled. GitHub Actions has
permission to create version pull requests. Publish permissions belong to the
publish job; build and validation jobs use repository read access.

## License

MIT
