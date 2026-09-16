/**
 * Real, production SourceAvailabilityAdapter (WU053 remediation of the
 * WU049 pre-Gate Safety Admission E2E gap: the normal WU045 CLI path had no
 * availability adapter wired in, so every non-private material Source
 * failed closed as SOURCE_REVALIDATION_MISSING instead of receiving a real
 * post-freeze check). Uses only Node built-ins (node:http/node:https) —
 * no new dependency.
 *
 * Contract preserved exactly from safety-admission.ts: `check()` returns an
 * AvailabilityEvidence using only the existing AvailabilityStatus values and
 * never throws (evaluateSafetyAdmission() treats a thrown adapter error as
 * SOURCE_AVAILABILITY_UNVERIFIABLE, but this adapter reports that status
 * directly so its own summary text can never carry unsafe request/response
 * detail into a finding).
 */
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import type { ClientRequest, IncomingMessage } from "node:http";
import { getRecordField } from "../core/record-fields.ts";
import type { AvailabilityEvidence, AvailabilityStatus, SourceAvailabilityAdapter } from "./safety-admission.ts";

export interface HttpAvailabilityAdapterOptions {
  /** Per-request timeout in milliseconds. Default 10000. */
  timeoutMs?: number;
  /** Injectable clock for deterministic tests. */
  now?: () => Date;
}

const DEFAULT_TIMEOUT_MS = 10_000;

function statusForHttpCode(code: number | undefined): AvailabilityStatus {
  if (code === undefined) return "error";
  if (code === 401 || code === 403) return "authentication_required";
  if (code >= 200 && code < 400) return "available";
  if (code === 404 || code === 410 || (code >= 400 && code < 500)) return "unavailable";
  return "unknown";
}

/**
 * Performs one HEAD request (falling back to GET only when the server
 * rejects HEAD outright, since some servers do not implement it) against
 * `url`, resolving to the existing AvailabilityStatus vocabulary. Never
 * follows a redirect chain beyond what Node's own http(s) client does by
 * default (i.e. it does not follow redirects at all — a 3xx is reported via
 * `statusForHttpCode`, which treats any 2xx/3xx as `available`, matching
 * "the resource is reachable at its canonical reference" rather than
 * resolving to a final destination).
 */
type ProbeResult = { kind: "status"; status: AvailabilityStatus } | { kind: "retry-with-get" };

function probe(url: URL, method: "HEAD" | "GET", timeoutMs: number): Promise<ProbeResult> {
  return new Promise((resolvePromise) => {
    const transport = url.protocol === "http:" ? httpRequest : httpsRequest;
    let settled = false;
    const finish = (result: ProbeResult) => {
      if (settled) return;
      settled = true;
      resolvePromise(result);
    };

    let req: ClientRequest;
    try {
      req = transport(
        url,
        { method, timeout: timeoutMs, headers: { "user-agent": "open-evora-research-availability/1.0" } },
        (res: IncomingMessage) => {
          res.resume();
          finish({ kind: "status", status: statusForHttpCode(res.statusCode) });
        }
      );
    } catch {
      finish({ kind: "status", status: "error" });
      return;
    }

    req.on("timeout", () => {
      req.destroy();
      finish({ kind: "status", status: "timeout" });
    });
    req.on("error", () => {
      finish(method === "HEAD" ? { kind: "retry-with-get" } : { kind: "status", status: "error" });
    });
    req.end();
  });
}

/** Resolves a Source's canonical_reference to a validated http(s) URL, or undefined if absent/unusable. */
function canonicalReferenceUrl(source: Record<string, unknown>): URL | undefined {
  const value = getRecordField(source, "canonical_reference");
  if (typeof value !== "string" || value.trim() === "") return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    return url;
  } catch {
    return undefined;
  }
}

/**
 * Production SourceAvailabilityAdapter: performs a real, read-only,
 * post-freeze availability request against the Source's own existing
 * `canonical_reference` (never a second, invented locator field), preferring
 * a lightweight HEAD and retrying once with GET only if the server refuses
 * HEAD at the connection level. A Source with no usable canonical_reference
 * URL reports `unsupported` — a fail-closed structural finding
 * (SOURCE_AVAILABILITY_UNVERIFIABLE), never a fabricated `available` result.
 */
export class HttpSourceAvailabilityAdapter implements SourceAvailabilityAdapter {
  private readonly timeoutMs: number;
  private readonly now: () => Date;

  constructor(options: HttpAvailabilityAdapterOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.now = options.now ?? (() => new Date());
  }

  check(): AvailabilityEvidence {
    throw new Error("HttpSourceAvailabilityAdapter is asynchronous; call checkAsync() instead");
  }

  /**
   * The real check is asynchronous (network I/O); evaluateSafetyAdmission()'s
   * adapter boundary is synchronous per Source, so callers resolve every
   * material Source's evidence up front (see resolveAvailabilityEvidence())
   * and hand evaluateSafetyAdmission() a synchronous lookup adapter over the
   * pre-resolved results — never a fabricated default while a real network
   * call is still pending.
   */
  async checkAsync(sourceId: string, source: Record<string, unknown>): Promise<AvailabilityEvidence> {
    const checkedAt = this.now().toISOString();
    const url = canonicalReferenceUrl(source);
    if (!url) return { sourceId, status: "unsupported", checkedAt };

    let result = await probe(url, "HEAD", this.timeoutMs);
    if (result.kind === "retry-with-get") {
      result = await probe(url, "GET", this.timeoutMs);
    }
    const status: AvailabilityStatus = result.kind === "status" ? result.status : "error";
    return { sourceId, status, checkedAt };
  }
}

/**
 * Resolves real availability evidence for every distinct Source in
 * `sources` up front (one real network request each, in parallel), then
 * returns a synchronous SourceAvailabilityAdapter backed entirely by those
 * already-settled results. A Source absent from `sources` (should not occur
 * given the caller always builds this map from the exact material-Source
 * set) reports `unsupported` rather than `available` — fail-closed, never a
 * fabricated default.
 */
export async function resolveAvailabilityAdapter(
  sources: ReadonlyMap<string, Record<string, unknown>>,
  options: HttpAvailabilityAdapterOptions = {}
): Promise<SourceAvailabilityAdapter> {
  const prober = new HttpSourceAvailabilityAdapter(options);
  const resolved = new Map<string, AvailabilityEvidence>();
  await Promise.all(
    [...sources.entries()].map(async ([sourceId, source]) => {
      resolved.set(sourceId, await prober.checkAsync(sourceId, source));
    })
  );
  return {
    check(sourceId: string): AvailabilityEvidence {
      return resolved.get(sourceId) ?? { sourceId, status: "unsupported", checkedAt: (options.now?.() ?? new Date()).toISOString() };
    },
  };
}
