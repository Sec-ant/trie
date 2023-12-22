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

Internal structure of the above code:

```
Map {
  1 => Map {
    2 => Map {
      [sym:d] => "v1",
    },
    [sym:*] => Map {
      [sym:c] => 5,
      2 => Map {
        [sym:d] => "v3",
      },
      [sym:*] => Map {
        [sym:c] => 5,
        [sym:d] => "v4",
      },
    },
  },
  2 => Map {
    2 => Map {
      [sym:d] => "v2",
    },
  },
  3 => Map {
    [sym:*] => Map {
      [sym:c] => 3,
      [sym:d] => "v5",
    },
  },
  4 => Map {
    [sym:*] => Map {
      [sym:c] => 1,
      [sym:d] => "v6",
    },
    0 => Map {
      [sym:d] => "v7",
    },
  },
}
```

# License

MIT
