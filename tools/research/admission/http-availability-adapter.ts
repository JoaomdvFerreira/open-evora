/**
 * Real, production SourceAvailabilityAdapter (WU053 remediation of the
 * WU049 pre-Gate Safety Admission E2E gap: the normal WU045 CLI path had no
 * availability adapter wired in, so every non-private material Source
 * failed closed as SOURCE_REVALIDATION_MISSING instead of receiving a real
 * post-freeze check). Uses only Node built-ins (node:http/node:https/node:dns/
 * node:net) — no new dependency.
 *
 * Contract preserved exactly from safety-admission.ts: `check()` returns an
 * AvailabilityEvidence using only the existing AvailabilityStatus values and
 * never throws (evaluateSafetyAdmission() treats a thrown adapter error as
 * SOURCE_AVAILABILITY_UNVERIFIABLE, but this adapter reports that status
 * directly so its own summary text can never carry unsafe request/response
 * detail into a finding).
 *
 * SSRF hardening (independent-review F1): `canonical_reference` may originate
 * from pre-Gate candidate content, i.e. untrusted input. Every probe target
 * is resolved via DNS first and every resolved address is checked against
 * loopback/private/link-local/reserved ranges (IPv4 and IPv6) before any
 * socket is opened; a blocked destination never receives a request. The
 * request itself is then pinned to the exact vetted address via the
 * transport's `lookup` option, so a second DNS lookup performed by Node
 * during connect (which could return a different, rebound address) can never
 * bypass the check — this is why hostname string matching alone is
 * insufficient and is not relied on here.
 */
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import type { ClientRequest, IncomingMessage } from "node:http";
import { lookup as dnsLookup } from "node:dns/promises";
import { BlockList, isIPv4 } from "node:net";
import { getRecordField } from "../core/record-fields.ts";
import type { AvailabilityEvidence, AvailabilityStatus, SourceAvailabilityAdapter } from "./safety-admission.ts";

export interface HttpAvailabilityAdapterOptions {
  /** Per-request timeout in milliseconds. Default 10000. */
  timeoutMs?: number;
  /** Injectable clock for deterministic tests. */
  now?: () => Date;
  /**
   * Test-only override for the F1 SSRF guard's DNS resolution step. Never
   * set this in production code — omitting it (the default) resolves via
   * real DNS, which is the only mode evaluateSafetyAdmission()'s production
   * callers ever use. Exists so tests can exercise the guard's IP-range
   * logic against controlled addresses without depending on real DNS or a
   * real loopback/private network target.
   */
  resolveAddress?: AddressResolver;
}

const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Non-public IPv4/IPv6 destinations, built once from Node's own `net.BlockList`
 * (not a hand-rolled range table) so range membership — including IPv4-mapped
 * IPv6 addresses like `::ffff:127.0.0.1`, which BlockList resolves against the
 * IPv4 rules automatically — is decided by the platform's own IP-range logic
 * rather than this module's.
 */
const NON_PUBLIC_ADDRESSES = new BlockList();
for (const [subnet, prefix] of [
  ["0.0.0.0", 8], // "this network"
  ["10.0.0.0", 8], // private
  ["100.64.0.0", 10], // CGNAT
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local
  ["172.16.0.0", 12], // private
  ["192.0.0.0", 24], // IETF protocol assignments
  ["192.0.2.0", 24], // documentation (TEST-NET-1)
  ["192.88.99.0", 24], // 6to4 relay anycast
  ["192.168.0.0", 16], // private
  ["198.18.0.0", 15], // benchmarking
  ["198.51.100.0", 24], // documentation (TEST-NET-2)
  ["203.0.113.0", 24], // documentation (TEST-NET-3)
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved (includes 255.255.255.255 broadcast)
] as const) {
  NON_PUBLIC_ADDRESSES.addSubnet(subnet, prefix, "ipv4");
}
for (const [subnet, prefix] of [
  ["::", 128], // unspecified
  ["::1", 128], // loopback
  ["64:ff9b::", 96], // NAT64 well-known prefix (embeds IPv4; treated conservatively)
  ["100::", 64], // discard-only
  ["2001:db8::", 32], // documentation
  ["fc00::", 7], // unique local
  ["fe80::", 10], // link-local
  ["ff00::", 8], // multicast
] as const) {
  NON_PUBLIC_ADDRESSES.addSubnet(subnet, prefix, "ipv6");
}

/** True if `address` (a resolved IPv4 or IPv6 literal) is not a public Internet destination. */
export function isNonPublicAddress(address: string): boolean {
  return NON_PUBLIC_ADDRESSES.check(address, isIPv4(address) ? "ipv4" : "ipv6");
}

/** Resolves a hostname to every address it maps to. Overridable only for tests (see AddressResolver). */
export type AddressResolver = (hostname: string) => Promise<{ address: string; family: number }[]>;

const realDnsResolver: AddressResolver = (hostname) => dnsLookup(hostname, { all: true, verbatim: true });

/**
 * Resolves every address `url.hostname` maps to and rejects (fail-closed) if
 * DNS resolution fails, returns nothing, or any single resolved address is
 * non-public — a hostname that resolves to a mix of public and non-public
 * addresses (e.g. round-robin DNS, or an attacker racing records) is treated
 * as unsafe as a whole rather than trusting whichever address happens to be
 * returned first. Returns the first address on success so the caller can pin
 * the actual socket connection to it.
 *
 * `resolve` defaults to real DNS and must never be overridden in production
 * code; the only override in this codebase is test-only, to exercise this
 * guard against controlled addresses without depending on real DNS or a real
 * loopback/private target (both of which the guard itself must reject).
 */
export async function resolvePublicAddress(url: URL, resolve: AddressResolver = realDnsResolver): Promise<string | undefined> {
  let records: { address: string; family: number }[];
  try {
    records = await resolve(url.hostname);
  } catch {
    return undefined;
  }
  if (records.length === 0) return undefined;
  if (records.some((record) => isNonPublicAddress(record.address))) return undefined;
  return records[0]?.address;
}

function statusForHttpCode(code: number | undefined): AvailabilityStatus {
  if (code === undefined) return "error";
  if (code === 401 || code === 403) return "authentication_required";
  if (code >= 200 && code < 400) return "available";
  if (code === 404 || code === 410 || (code >= 400 && code < 500)) return "unavailable";
  return "unknown";
}

/**
 * Performs one HEAD request (falling back to GET when the server rejects
 * HEAD outright at the connection level, or replies 405/501 to it, since
 * some servers do not implement HEAD) against `url`, resolving to the
 * existing AvailabilityStatus vocabulary. Never follows a redirect chain
 * beyond what Node's own http(s) client does by default (i.e. it does not
 * follow redirects at all — a 3xx is reported via `statusForHttpCode`, which
 * treats any 2xx/3xx as `available`, matching "the resource is reachable at
 * its canonical reference" rather than resolving to a final destination).
 *
 * `pinnedAddress` forces the TCP connection to that exact, already-vetted IP
 * literal (via the transport's `lookup` option) rather than letting Node
 * resolve `url.hostname` again — a second, independent DNS lookup at connect
 * time could return a different (e.g. rebound) address than the one F1's
 * pre-flight check vetted, silently defeating the guard.
 */
export type ProbeResult = { kind: "status"; status: AvailabilityStatus } | { kind: "retry-with-get" };

/** Exported for transport-level tests (HEAD/GET/status-code/timeout behavior) only; production code calls it via checkAsync(). */
export function probe(url: URL, method: "HEAD" | "GET", timeoutMs: number, pinnedAddress: string): Promise<ProbeResult> {
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
        {
          method,
          timeout: timeoutMs,
          headers: { "user-agent": "open-evora-research-availability/1.0" },
          lookup: (_hostname, options, callback) => {
            const family = isIPv4(pinnedAddress) ? 4 : 6;
            if (options.all) {
              (callback as (err: null, addresses: { address: string; family: number }[]) => void)(null, [{ address: pinnedAddress, family }]);
              return;
            }
            callback(null, pinnedAddress, family);
          },
        },
        (res: IncomingMessage) => {
          res.resume();
          const statusCode = res.statusCode;
          if (method === "HEAD" && (statusCode === 405 || statusCode === 501)) {
            finish({ kind: "retry-with-get" });
            return;
          }
          finish({ kind: "status", status: statusForHttpCode(statusCode) });
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
 * a lightweight HEAD and retrying once with GET when the server refuses HEAD
 * at the connection level or replies 405/501 to it. A Source with no usable
 * canonical_reference URL, or whose hostname does not resolve to a public
 * Internet address (see resolvePublicAddress/isNonPublicAddress — DNS/socket
 * -level, not a hostname string check), reports `unsupported` — a
 * fail-closed structural finding (SOURCE_AVAILABILITY_UNVERIFIABLE), never a
 * fabricated `available` result and never a request to a non-public
 * destination.
 */
export class HttpSourceAvailabilityAdapter implements SourceAvailabilityAdapter {
  private readonly timeoutMs: number;
  private readonly now: () => Date;
  private readonly resolveAddress: AddressResolver | undefined;

  constructor(options: HttpAvailabilityAdapterOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.now = options.now ?? (() => new Date());
    this.resolveAddress = options.resolveAddress;
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

    // Fail-closed SSRF guard: DNS-resolve the hostname and reject any
    // non-public resolved address before a socket is ever opened. The
    // vetted address is then pinned for the actual connection (see probe's
    // `lookup` override) so a second, independent resolution at connect time
    // cannot return a different (e.g. DNS-rebound) address.
    const pinnedAddress = this.resolveAddress
      ? await resolvePublicAddress(url, this.resolveAddress)
      : await resolvePublicAddress(url);
    if (!pinnedAddress) return { sourceId, status: "unsupported", checkedAt };

    let result = await probe(url, "HEAD", this.timeoutMs, pinnedAddress);
    if (result.kind === "retry-with-get") {
      result = await probe(url, "GET", this.timeoutMs, pinnedAddress);
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
