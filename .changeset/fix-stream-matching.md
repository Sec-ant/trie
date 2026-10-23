---
"@sec-ant/trie": minor
---

Wildcard rule deletion retains sibling branches. Asynchronous mutations commit against the current tree once their paths and callbacks resolve, with consistent rule counts across overlapping writes and callback-driven mutations.

Matching uses an explicit traversal stack and a shared replay buffer for overlapping alternatives. It supports deep paths, string inputs, and wildcard-first result order. Leaf traversal finishes at the matched position, and active input iterators close when matching completes, stops early, or fails.

The package provides an ES2020 ESM bundle, object-keyed wildcard markers, and explicit TypeScript exports. Development uses pnpm, Biome, Vite, and Vitest, with Node.js and browser regression tests, coverage, and packed-package consumer checks.
