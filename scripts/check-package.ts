import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const temporary = mkdtempSync(join(tmpdir(), "trie-package-"));

try {
  const tarball = join(temporary, "package.tgz");
  execFileSync("pnpm", ["pack", "--out", tarball], {
    cwd: root,
    stdio: "pipe",
  });
  writeFileSync(
    join(temporary, "package.json"),
    JSON.stringify({ private: true, type: "module" }),
  );
  execFileSync(
    "npm",
    [
      "install",
      tarball,
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--package-lock=false",
    ],
    { cwd: temporary, stdio: "pipe" },
  );
  const packageRoot = join(temporary, "node_modules/@sec-ant/trie");
  assert.deepEqual(readdirSync(join(packageRoot, "dist")).sort(), [
    "index.d.ts",
    "index.js",
  ]);
  const manifest = JSON.parse(
    readFileSync(join(packageRoot, "package.json"), "utf8"),
  );
  assert.equal(manifest.exports["."].types, "./dist/index.d.ts");

  const { Trie, w } = (await import(
    pathToFileURL(join(packageRoot, "dist/index.js")).href
  )) as typeof import("../src/index.ts");
  const trie = new Trie<string, string>([
    [[w()], "short"],
    [[w(), "x"], "keep"],
    [[w(2)], "long"],
  ]);
  trie.deleteSync([w()]);
  assert.equal(trie.getSync([w(), "x"]), "keep");
  assert.equal("root" in trie, false);
  assert.equal(
    readFileSync(join(packageRoot, "dist/index.js"), "utf8").includes(
      "import.meta.vitest",
    ),
    false,
  );
  const strings = new Trie<string, string>([["abc", "value"]]);
  const matches = [];
  for await (const value of strings.match("abc")) matches.push(value);
  assert.deepEqual(matches, ["value"]);

  writeFileSync(
    join(temporary, "consumer.mts"),
    `
import { Trie, w, type WildcardSegment } from "@sec-ant/trie";
const wildcard: WildcardSegment = w(2);
const trie = new Trie<number, string>([[[1, wildcard], "value"]]);
const result: IteratorResult<string, void> = trie.matchSync([1, 2, 3]).next();
void result;
`,
  );
  const compiler = join(
    dirname(fileURLToPath(import.meta.resolve("typescript/package.json"))),
    "bin/tsc",
  );
  for (const resolution of ["NodeNext", "Bundler"]) {
    writeFileSync(
      join(temporary, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          target: "ES2020",
          lib: ["ES2020"],
          module: resolution === "Bundler" ? "ESNext" : "NodeNext",
          moduleResolution: resolution,
          strict: true,
          skipLibCheck: false,
          noEmit: true,
          types: [],
        },
        files: ["consumer.mts"],
      }),
    );
    execFileSync(
      process.execPath,
      [compiler, "-p", join(temporary, "tsconfig.json")],
      {
        cwd: temporary,
        stdio: "pipe",
      },
    );
  }
  console.log(
    "Packed package: runtime, exports, and ES2020 NodeNext/Bundler consumer checks passed.",
  );
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
