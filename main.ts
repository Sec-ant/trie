import { Trie, w } from "./src/index";

const trie = new Trie<number, string>();

trie.addSync([
  [[1, w(2)], "1**"],
  // [[1, w(), 3], "1*3"],
]);

console.log(trie.getSync([1, w(), w()]));
console.log(trie);
