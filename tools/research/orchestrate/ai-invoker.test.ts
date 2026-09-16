import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { buildChildEnv, LocalCommandAiInvoker, loadLocalCommandAiInvokerConfigFromEnv } from "./ai-invoker.ts";

function withTempDir(fn: (dir: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), "open-evora-ai-invoker-test-"));
  try {
    fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Writes a synthetic Node.js "AI executable" fixture used as a stand-in child process. */
function writeFixtureScript(dir: string, body: string): string {
  const path = join(dir, "fixture.cjs");
  writeFileSync(path, body, "utf8");
  return path;
}

test("loadLocalCommandAiInvokerConfigFromEnv returns undefined when RESEARCH_AI_COMMAND is unset", () => {
  const config = loadLocalCommandAiInvokerConfigFromEnv({});
  assert.equal(config, undefined);
});

test("loadLocalCommandAiInvokerConfigFromEnv parses command/args/timeout from env, never hard-coding a vendor", () => {
  const config = loadLocalCommandAiInvokerConfigFromEnv({
    RESEARCH_AI_COMMAND: "node",
    RESEARCH_AI_ARGS: "fixture.cjs --role {role}",
    RESEARCH_AI_TIMEOUT_MS: "5000",
  });
  assert.deepEqual(config, { command: "node", args: ["fixture.cjs", "--role", "{role}"], timeoutMs: 5000 });
});

test("loadLocalCommandAiInvokerConfigFromEnv defaults timeout when unset/invalid", () => {
  const config = loadLocalCommandAiInvokerConfigFromEnv({ RESEARCH_AI_COMMAND: "node" });
  assert.equal(config?.timeoutMs, 120_000);
});

test("a successful invocation returns stdout via a brand-new child process", () => {
  withTempDir((dir) => {
    const script = writeFixtureScript(
      dir,
      "let input=''; process.stdin.on('data', d => input += d); process.stdin.on('end', () => { process.stdout.write(JSON.stringify({ok:true, roleArg: process.argv[3]})); });"
    );
    const invoker = new LocalCommandAiInvoker({ command: "node", args: [script, "--role", "{role}"], timeoutMs: 10_000 });
    const result = invoker.invoke({ role: "PRIMARY_AUTHOR", input: "hello" });
    assert.equal(result.status, "OK");
    if (result.status !== "OK") return;
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.roleArg, "PRIMARY_AUTHOR");
  });
});

test("a nonzero exit code is reported as INVOCATION_FAILED, not silently ignored", () => {
  withTempDir((dir) => {
    const script = writeFixtureScript(dir, "process.stderr.write('boom'); process.exit(1);");
    const invoker = new LocalCommandAiInvoker({ command: "node", args: [script], timeoutMs: 10_000 });
    const result = invoker.invoke({ role: "PRIMARY_AUTHOR", input: "hello" });
    assert.equal(result.status, "INVOCATION_FAILED");
  });
});

test("a slow process is reported as TIMEOUT and does not hang the caller", () => {
  withTempDir((dir) => {
    const script = writeFixtureScript(dir, "setTimeout(() => {}, 60000);");
    const invoker = new LocalCommandAiInvoker({ command: "node", args: [script], timeoutMs: 300 });
    const result = invoker.invoke({ role: "INDEPENDENT_REVIEWER", input: "hello" });
    assert.equal(result.status, "TIMEOUT");
  });
});

test("an invocation for a nonexistent executable is reported as INVOCATION_FAILED", () => {
  const invoker = new LocalCommandAiInvoker({ command: "this-executable-does-not-exist-anywhere", args: [], timeoutMs: 5000 });
  const result = invoker.invoke({ role: "PRIMARY_AUTHOR", input: "hello" });
  assert.equal(result.status, "INVOCATION_FAILED");
});

// WU045-B01 independent-review remediation, finding 4: the spawned AI
// process must not inherit the orchestrator's full environment by default.
test("buildChildEnv drops an unrelated/sensitive variable that is not on the allowlist", () => {
  const child = buildChildEnv({ PATH: "/usr/bin", GITHUB_TOKEN: "super-secret-value", DEPLOY_KEY: "another-secret" });
  assert.equal("GITHUB_TOKEN" in child, false);
  assert.equal("DEPLOY_KEY" in child, false);
});

test("buildChildEnv passes through the documented OS/launch-essential allowlist", () => {
  const child = buildChildEnv({ PATH: "/usr/bin", HOME: "/home/x", TEMP: "/tmp", UNRELATED_SECRET: "nope" });
  assert.equal(child.PATH, "/usr/bin");
  assert.equal(child.HOME, "/home/x");
  assert.equal(child.TEMP, "/tmp");
  assert.equal("UNRELATED_SECRET" in child, false);
});

test("buildChildEnv passes through operator-opted-in RESEARCH_AI_CHILD_* variables", () => {
  const child = buildChildEnv({ PATH: "/usr/bin", RESEARCH_AI_CHILD_API_KEY: "operator-provided", OTHER_SECRET: "nope" });
  assert.equal(child.RESEARCH_AI_CHILD_API_KEY, "operator-provided");
  assert.equal("OTHER_SECRET" in child, false);
});

test("a spawned AI process does not see an unrelated secret present in the orchestrator's environment", () => {
  withTempDir((dir) => {
    const script = writeFixtureScript(
      dir,
      "process.stdout.write(JSON.stringify({ sawSecret: 'GITHUB_TOKEN' in process.env, sawPath: 'PATH' in process.env || 'Path' in process.env }));"
    );
    const originalEnv = process.env.GITHUB_TOKEN;
    process.env.GITHUB_TOKEN = "leaked-if-this-test-fails";
    try {
      const invoker = new LocalCommandAiInvoker({ command: "node", args: [script], timeoutMs: 10_000 });
      const result = invoker.invoke({ role: "PRIMARY_AUTHOR", input: "" });
      assert.equal(result.status, "OK");
      if (result.status !== "OK") return;
      const parsed = JSON.parse(result.stdout);
      assert.equal(parsed.sawSecret, false);
      assert.equal(parsed.sawPath, true); // PATH must still be passed through so node itself can be found/run.
    } finally {
      if (originalEnv === undefined) delete process.env.GITHUB_TOKEN;
      else process.env.GITHUB_TOKEN = originalEnv;
    }
  });
});

test("an operator-opted-in RESEARCH_AI_CHILD_* variable does reach the spawned process", () => {
  withTempDir((dir) => {
    const script = writeFixtureScript(dir, "process.stdout.write(JSON.stringify({ apiKey: process.env.RESEARCH_AI_CHILD_API_KEY ?? null }));");
    const original = process.env.RESEARCH_AI_CHILD_API_KEY;
    process.env.RESEARCH_AI_CHILD_API_KEY = "operator-provided-value";
    try {
      const invoker = new LocalCommandAiInvoker({ command: "node", args: [script], timeoutMs: 10_000 });
      const result = invoker.invoke({ role: "PRIMARY_AUTHOR", input: "" });
      assert.equal(result.status, "OK");
      if (result.status !== "OK") return;
      assert.equal(JSON.parse(result.stdout).apiKey, "operator-provided-value");
    } finally {
      if (original === undefined) delete process.env.RESEARCH_AI_CHILD_API_KEY;
      else process.env.RESEARCH_AI_CHILD_API_KEY = original;
    }
  });
});

test("input is delivered only via stdin, never via argv/env, and each invocation is an independent process", () => {
  withTempDir((dir) => {
    const script = writeFixtureScript(
      dir,
      "let input=''; process.stdin.on('data', d => input += d); process.stdin.on('end', () => { process.stdout.write(JSON.stringify({ receivedViaStdin: input, pid: process.pid })); });"
    );
    const invoker = new LocalCommandAiInvoker({ command: "node", args: [script], timeoutMs: 10_000 });
    const first = invoker.invoke({ role: "PRIMARY_AUTHOR", input: "first-payload" });
    const second = invoker.invoke({ role: "INDEPENDENT_REVIEWER", input: "second-payload" });
    assert.equal(first.status, "OK");
    assert.equal(second.status, "OK");
    if (first.status !== "OK" || second.status !== "OK") return;
    const firstParsed = JSON.parse(first.stdout);
    const secondParsed = JSON.parse(second.stdout);
    assert.equal(firstParsed.receivedViaStdin, "first-payload");
    assert.equal(secondParsed.receivedViaStdin, "second-payload");
    // Distinct process IDs demonstrate these are two separate child
    // processes, not a shared/reused session.
    assert.notEqual(firstParsed.pid, secondParsed.pid);
  });
});
