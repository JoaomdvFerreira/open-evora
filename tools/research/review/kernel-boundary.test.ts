import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const researchRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const orchestrateDir = join(researchRoot, "orchestrate");

function tsFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return tsFiles(path);
    return entry.name.endsWith(".ts") ? [path] : [];
  });
}

/** Every module specifier a file imports or re-exports, static, type-only or dynamic. */
function importSpecifiers(file: string): string[] {
  return ts.preProcessFile(readFileSync(file, "utf8"), true, true).importedFiles.map((ref) => ref.fileName);
}

function orchestrateImports(files: readonly string[]): string[] {
  return files.flatMap((file) =>
    importSpecifiers(file)
      .filter((specifier) => specifier.startsWith("."))
      .filter((specifier) => {
        const target = resolve(dirname(file), specifier);
        return target === orchestrateDir || target.startsWith(orchestrateDir + sep);
      })
      .map((specifier) => `${relative(researchRoot, file)} -> ${specifier}`)
  );
}

test("the import scan resolves relative specifiers, including type-only and dynamic imports", () => {
  const source = 'import type { A } from "../orchestrate/types.ts";\nexport * from "./x.ts";\nconst m = import("../orchestrate/run-cycle.ts");\n';
  const specifiers = ts.preProcessFile(source, true, true).importedFiles.map((ref) => ref.fileName);
  assert.deepEqual(specifiers, ["../orchestrate/types.ts", "./x.ts", "../orchestrate/run-cycle.ts"]);
});

test("the direct semantic-review path imports no orchestration or persisted lifecycle state", () => {
  const files = [
    join(researchRoot, "review", "cli.ts"),
    join(researchRoot, "review", "review-unit.ts"),
    join(researchRoot, "review", "independent-review-invocation.ts"),
  ];
  assert.deepEqual(orchestrateImports(files), []);
  for (const file of files) {
    assert.doesNotMatch(importSpecifiers(file).join("\n"), /review-lifecycle/);
  }
});

test("the shared review kernel and its neutral dependencies import nothing from the orchestration namespace", () => {
  const files = [
    ...tsFiles(join(researchRoot, "review")),
    ...tsFiles(join(researchRoot, "ai")),
    ...tsFiles(join(researchRoot, "core")),
    join(researchRoot, "integration", "candidate-loader.ts"),
  ].filter((file) => !file.endsWith(".test.ts"));
  assert.ok(files.length > 0);
  assert.deepEqual(orchestrateImports(files), []);
});
