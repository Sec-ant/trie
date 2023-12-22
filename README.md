# @sec-ant/trie

A simple Trie structure with wildcard support to match streams.

```ts
import { Trie, w } from "@sec-ant/trie";

const trie = new Trie([
  [[1, 2], "v1"],
  [[2, 2], "v2"],
  [[1, w(5), 2], "v3"],
  [[1, w(10)], "v4"],
  [[3, w(3)], "v5"],
  [[4, w()], "v6"],
  [[4, 0], "v7"],
]);
```

yields to

```
Map {
  1 => Map {
    2 => Map {
      :d => "v1",
    },
    :* => Map {
      :c => 5,
      2 => Map {
        :d => "v3",
      },
      :* => Map {
        :c => 5,
        :d => "v4",
      },
    },
  },
  2 => Map {
    2 => Map {
      :d => "v2",
    },
  },
  3 => Map {
    :* => Map {
      :c => 3,
      :d => "v5",
    },
  },
  4 => Map {
    :* => Map {
      :c => 1,
      :d => "v6",
    },
    0 => Map {
      :d => "v7",
    },
  },
}
```

# License

MIT
