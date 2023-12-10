import { Trie, w } from "./src/index";

const trie = new Trie<number, string>();

trie.addSync([[[2, w(1), w(1), 2, w(1), w(1), w(1)], "2***"]]);
trie.addSync([[[2, w(2), 2, w(3)], "2***+"]]);

console.log(trie.getSync([2, w(2), 2, w(3)]));

console.log(trie);
