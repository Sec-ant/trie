import { Trie } from "./src/index";

const trie = new Trie<number, string>();

trie.initSync([
  [[], "root"],
  [[1], "1"],
  [[Trie.wildcard], "*"],
  [[1, 2], "12"],
  [[1, 2, 3], "123"],
  [[1, Trie.wildcard, 3], "1*3"],
  [[1, Trie.wildcard, Trie.wildcard], "1**"],
]);

for (const value of trie.findSync([1, 2, 3])) {
  console.log(value);
}

console.log(trie.size);
