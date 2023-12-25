# @sec-ant/trie

This repository contains an implementation of a Trie data structure in TypeScript. A Trie, also known as a prefix tree, is a tree-like data structure that stores data in a way that allows for efficient retrieval, insertion, and deletion. This particular implementation, additionally, has the following features:

- **Any Type of Values**: Path segments and data can be any types of values. Not only strings or numbers.
- **Synchronous and Asynchronous Methods**: Both synchronous and asynchronous APIs are provided.
- **Unique Symbols**: The internal structure uses unique symbols to prevent collisions with user input.
- **Supports Wildcards**: The Trie implementation supports wildcard paths, allowing for flexible and powerful queries.
- **Accepts Iterables**: Accept synchronous and asynchronous iterables as paths. This makes it easy to work with iterable types other than strings or arrays.
- **Generator Results**: When using the Trie to match against a path, the result is a generator. This allows for efficient memory usage and instant outputs.
- **TypeScript Support**: This package is fully written in TypeScript and provides strong typing for better development experience.

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
<tbody>
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

// Set a path with no wildcards to the Trie
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
  console.log(value); // "value1" then "value2"
}

// Delete a path from the Trie
trie.delete(["path", "to", w(1), w(1), w(1), "wildcards"]);

// Clear all paths from the Trie
trie.clear();
```

## API

### `w`

This is a function to create wildcard segments that can be used in a path when constructing the Trie:

```ts
/**
 * Creates a wildcard path segment with an optional count.
 * @param count - Optional count for the wildcard. Default is 1.
 * @returns A  wildcard path segment.
 */
export declare function w(count?: number): WildcardSegment;
```

### `r`

This is a function to create reset segments that can be used in a path when constructing the Trie:

```ts
/**
 * Creates a reset path segment.
 * @returns A reset path segment.
 */
export declare function r(): ResetSegment;
```

### `Trie`

#### Methods

The `Trie<I, V>` class provides the following methods:

- `constructor(initialEntries?: Iterable<[Iterable<Segment<I>>, V]>)`: Constructs a new Trie. Optionally populates the Trie with initial entries.
- `add(initialEntries: AnyIterable<[AnyIterable<Segment<I>>, V]>)`: Asynchronously adds paths to the Trie with the specified values.
- `addSync(initialEntries: Iterable<[Iterable<Segment<I>>, V]>)`: Synchronously adds paths to the Trie with the specified values.
- `set(path: AnyIterable<Segment<I>>, value: V)`: Asynchronously sets the value for a path in the Trie.
- `setSync(path: Iterable<Segment<I>>, value: V)`: Synchronously sets the value for a path in the Trie.
- `has(path: AnyIterable<Segment<I>>)`: Asynchronously checks if a path exists in the Trie.
- `hasSync(path: Iterable<Segment<I>>)`: Synchronously checks if a path exists in the Trie.
- `get(path: AnyIterable<Segment<I>>)`: Asynchronously retrieves the value associated with a path in the Trie.
- `getSync(path: Iterable<Segment<I>>)`: Synchronously retrieves the value associated with a path in the Trie.
- `delete(path: AnyIterable<Segment<I>>)`: Asynchronously deletes a path from the Trie.
- `deleteSync(path: Iterable<Segment<I>>)`: Synchronously deletes a path from the Trie.
- `clear()`: Clears all paths from the Trie.
- `match(path: AnyIterable<I>)`: Asynchronously searches for values matching a given path. Returns an asynchronous generator.
- `matchSync(path: Iterable<I>)`: Synchronously searches for values matching a given path. Returns a generator.

where:

```ts
/**
 * Represents either an Iterable or an AsyncIterable of type T.
 */
type AnyIterable<T> = Iterable<T> | AsyncIterable<T>;

/**
 * Represents a path segment.
 */
export type Segment<I> = I | WildcardSegment | ResetSegment;
```

#### Properties

The `Trie` class provides the following properties:

- `size`: Get the size of the Trie, i.e., the number of paths. This value is read only.

## License

MIT
