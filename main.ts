import { Trie, w } from "./src/index";

const trie = new Trie<number, string>();

trie.setSync([1], "1");
trie.setSync([1, w(), 2], "1 - * - 2");
trie.setSync([1, w(3), 4], "1 - * - * - * - 4");
trie.setSync([1, w(2), 3, w()], "1 - * - * - 3 - *");

console.log("\nsize:");
console.log(trie.size);

console.log("\nget:");
console.log(trie.getSync([1]));
console.log(trie.getSync([1, w(), 2]));
console.log(trie.getSync([1, w(), w(2), 4]));
console.log(trie.getSync([1, w(), w(), 3, w()]));

console.log("\nfind:");
for (const r of trie.findSync([1, 2.5, 1, 3, 4])) {
  console.log(r);
}

trie.deleteSync([1, w(), w(), 3, w()]);

console.log("\nsize:");
console.log(trie.size);

console.log("\nget:");
console.log(trie.getSync([1]));
console.log(trie.getSync([1, w(), 2]));
console.log(trie.getSync([1, w(2), w(), 4]));
console.log(trie.getSync([1, w(), w(), 3, w()]));

console.log("\nfind:");
for (const r of trie.findSync([1, 2.5, 1, 3, 4])) {
  console.log(r);
}
