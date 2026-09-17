/**
 * Provider-neutral local AI invocation boundary (research automation
 * contract OD-A, OD-B §9/§11). This
 * module defines the AiInvoker abstraction used for both required
 * invocation roles — PRIMARY_AUTHOR and INDEPENDENT_REVIEWER — and a
 * production LocalCommandAiInvoker that spawns an operator-configured local
 * command/process per invocation.
 *
 * This module never selects a vendor/model. The executable, its arguments,
 * and its timeout are runtime configuration (env vars), never a hard-coded
 * SDK or hosted-API call. Each `invoke()` call spawns a brand-new child
 * process — there is no session/conversation identifier carried between
 * calls, and the two roles never share a process, environment, or any other
 * form of hidden continuity.
 *
 * Environment minimization (WU045-B01 independent-review remediation,
 * finding 4): the spawned process does NOT inherit the orchestrator's full
 * environment by default. Only a small, documented allowlist of variables
 * needed to actually launch and run a typical local command/interpreter is
 * passed through — see ENV_PASSTHROUGH_PREFIXES/ENV_PASSTHROUGH_EXACT below
 * — plus any `RESEARCH_AI_CHILD_*`-prefixed variable, an explicit
 * operator-controlled channel for anything a specific configured command
 * additionally needs (e.g. an API key for a hosted model the local command
 * itself wraps). This is a trust-boundary choice, not an attempt at a
 * zero-environment sandbox: PATH and OS-required variables are still passed
 * so ordinary executables (a shell script, a Python/Node entry point, a
 * platform binary) still resolve and run normally on Windows, macOS, and
 * Linux.
 */
import { spawnSync } from "node:child_process";

/**
 * Exact-name variables passed through unmodified when present in the
 * orchestrator's own environment. Chosen because omitting them routinely
 * breaks ordinary process launch/execution, not because they are
 * AI-specific:
 *   PATH / Path              executable resolution (POSIX / Windows)
 *   HOME                     POSIX user home (many interpreters/tools need it)
 *   USERPROFILE / HOMEDRIVE / HOMEPATH   Windows user home equivalents
 *   TEMP / TMP / TMPDIR      scratch-file locations many tools assume exist
 *   SystemRoot / windir      required for Windows process creation itself
 *   ProgramFiles / ProgramFiles(x86) / ProgramData   common Windows tool locations
 *   COMSPEC                  Windows command interpreter path
 *   LANG / LC_ALL            locale, avoids encoding surprises in tool output
 */
const ENV_PASSTHROUGH_EXACT: readonly string[] = [
  "PATH",
  "Path",
  "HOME",
  "USERPROFILE",
  "HOMEDRIVE",
  "HOMEPATH",
  "TEMP",
  "TMP",
  "TMPDIR",
  "SystemRoot",
  "windir",
  "ProgramFiles",
  "ProgramFiles(x86)",
  "ProgramData",
  "COMSPEC",
  "LANG",
  "LC_ALL",
];

/**
 * Variables whose NAME starts with this prefix are passed through
 * unmodified. This is the operator's explicit, opt-in channel for anything
 * a specific configured AI command additionally needs (an API key, a model
 * name, a config path) without exposing the orchestrator's unrelated
 * environment (CI secrets, deployment credentials, unrelated tokens) by
 * default.
 */
const ENV_PASSTHROUGH_PREFIX = "RESEARCH_AI_CHILD_";

/**
 * Builds the minimal environment passed to the spawned AI process from the
 * orchestrator's own `process.env` (or an injected env for testing):
 * `ENV_PASSTHROUGH_EXACT` names plus anything prefixed with
 * `ENV_PASSTHROUGH_PREFIX`, dropping every other inherited variable.
 * Exported for direct unit testing of the allowlist itself.
 */
export function buildChildEnv(sourceEnv: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const child: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(sourceEnv)) {
    if (value === undefined) continue;
    if (ENV_PASSTHROUGH_EXACT.includes(key) || key.startsWith(ENV_PASSTHROUGH_PREFIX)) {
      child[key] = value;
    }
  }
  return child;
}

export type AiInvocationRole = "PRIMARY_AUTHOR" | "INDEPENDENT_REVIEWER";

export interface AiInvocationRequest {
  role: AiInvocationRole;
  /** Bounded prompt/input text delivered to the invoked process via stdin only. */
  input: string;
}

export type AiInvocationResult =
  | { status: "OK"; stdout: string }
  | { status: "INVOCATION_FAILED"; message: string }
  | { status: "TIMEOUT"; message: string };

export interface AiInvoker {
  invoke(request: AiInvocationRequest): AiInvocationResult;
}

export interface LocalCommandAiInvokerConfig {
  /** Path/name of the executable to spawn. Configuration, never a hard-coded vendor choice. */
  command: string;
  /** Fixed argument list. May reference `{role}` as a literal placeholder, replaced per invocation. */
  args: readonly string[];
  /** Milliseconds before an invocation is treated as TIMEOUT and killed. */
  timeoutMs: number;
}

/**
 * Reads the local AI runtime configuration from environment variables. No
 * default executable is assumed — if unset, WU045 must fail closed with
 * AI_RUNTIME_NOT_CONFIGURED rather than silently falling back to
 * pre-generated files (per the remediation directive).
 *
 * Env vars (all operator-supplied, never hard-coded):
 *   RESEARCH_AI_COMMAND       executable/path (required)
 *   RESEARCH_AI_ARGS          space-separated fixed args (optional; supports {role})
 *   RESEARCH_AI_TIMEOUT_MS    invocation timeout in ms (optional; default 120000)
 */
export function loadLocalCommandAiInvokerConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env
): LocalCommandAiInvokerConfig | undefined {
  const command = env.RESEARCH_AI_COMMAND;
  if (!command || command.trim() === "") return undefined;

  const rawArgs = env.RESEARCH_AI_ARGS ?? "";
  const args = rawArgs.trim() === "" ? [] : rawArgs.trim().split(/\s+/);

  const rawTimeout = env.RESEARCH_AI_TIMEOUT_MS;
  const timeoutMs = rawTimeout && /^\d+$/.test(rawTimeout) ? Number(rawTimeout) : 120_000;

  return { command, args, timeoutMs };
}

/**
 * Production AiInvoker: spawns a brand-new child process per invocation
 * using safe argument-array process spawning (never `shell: true`, never
 * string interpolation into a shell). Input is delivered exclusively via
 * stdin; structured output is read exclusively from stdout. stderr and a
 * non-zero exit code are both treated as INVOCATION_FAILED, never silently
 * ignored. No secret material is logged: only the configured command name,
 * role, and exit code are ever reported on failure — never stdin/stdout
 * content, which may include source material but is never a credential by
 * construction (no credentials flow through this module at all). The child
 * process receives only buildChildEnv()'s minimal allowlisted environment
 * (finding 4), not the orchestrator's full `process.env`.
 */
export class LocalCommandAiInvoker implements AiInvoker {
  private readonly config: LocalCommandAiInvokerConfig;

  constructor(config: LocalCommandAiInvokerConfig) {
    this.config = config;
  }

  invoke(request: AiInvocationRequest): AiInvocationResult {
    const args = this.config.args.map((arg) => (arg === "{role}" ? request.role : arg));

    const result = spawnSync(this.config.command, args, {
      input: request.input,
      encoding: "utf8",
      timeout: this.config.timeoutMs,
      shell: false,
      windowsHide: true,
      env: buildChildEnv(),
    });

    if (result.error) {
      const err = result.error as NodeJS.ErrnoException;
      if (err.code === "ETIMEDOUT") {
        return { status: "TIMEOUT", message: `AI invocation (${request.role}) exceeded ${this.config.timeoutMs}ms` };
      }
      return { status: "INVOCATION_FAILED", message: `AI invocation (${request.role}) could not be started: ${err.message}` };
    }

    if (result.signal === "SIGTERM" && result.status === null) {
      return { status: "TIMEOUT", message: `AI invocation (${request.role}) exceeded ${this.config.timeoutMs}ms and was terminated` };
    }

    if (result.status !== 0) {
      return {
        status: "INVOCATION_FAILED",
        message: `AI invocation (${request.role}) exited with code ${result.status ?? "null"} (signal ${result.signal ?? "none"})`,
      };
    }

    return { status: "OK", stdout: result.stdout ?? "" };
  }
}
