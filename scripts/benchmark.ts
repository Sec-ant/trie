import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";

type Implementation = Pick<typeof import("../src/index.ts"), "Trie" | "w">;
type Scenario = { name: string; runs: number; execute: () => number };

function scenarios(implementation: Implementation): Scenario[] {
  const { Trie: Tree, w: wildcard } = implementation;
  const exactPath = Array<number>(100).fill(1);
  const exact = new Tree<number, number>([[exactPath, 1]]);
  const branching = new Tree<number, number>(
    Array.from(
      { length: 10 },
      (_, i) =>
        [[...Array<number>(i).fill(1), wildcard(10 - i)], i] as [
          (number | ReturnType<typeof wildcard>)[],
          number,
        ],
    ),
  );
  const input = Array<number>(10).fill(1);
  return [
    {
      name: "literal path / 100 elements",
      runs: 2_000,
      execute: () => [...exact.matchSync(exactPath)].length,
    },
    {
      name: "10 overlapping wildcard alternatives",
      runs: 2_000,
      execute: () => [...branching.matchSync(input)].length,
    },
    {
      name: "early exit / first wildcard result",
      runs: 2_000,
      execute: () => {
        const matches = branching.matchSync(input);
        try {
          return Number(!matches.next().done);
        } finally {
          matches.return();
        }
      },
    },
  ];
}

function measure(implementation: Implementation) {
  return scenarios(implementation).map(({ name, runs, execute }) => {
    for (let i = 0; i < 200; i++) execute();
    const samples: number[] = [];
    let count = 0;
    for (let round = 0; round < 9; round++) {
      const start = performance.now();
      for (let i = 0; i < runs; i++) count += execute();
      samples.push(((performance.now() - start) * 1_000) / runs);
    }
    samples.sort((a, b) => a - b);
    return { scenario: name, medianMicroseconds: samples[4], results: count };
  });
}

const baseline = process.argv[2];
if (baseline) {
  console.log("Baseline", baseline);
  console.table(measure(await import(pathToFileURL(baseline).href)));
}
console.log("Current", process.version);
console.table(
  measure(await import(new URL("../dist/index.js", import.meta.url).href)),
);
