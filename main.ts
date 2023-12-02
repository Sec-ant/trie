import { Trie, w } from "./src/index";

const trie = new Trie<number, string>();

trie.addSync([[[1, w(1), w(1), w(1)], "1***"]]);

console.log(trie.getSync([1, w(1), w(1), w(1)]));
console.log(trie.getSync([1, w(2), w(1)]));
console.log(trie.getSync([1, w(1), w(2)]));
console.log(trie.getSync([1, w(3)]));

console.log(trie);
