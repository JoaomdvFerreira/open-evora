/**
 * Regression coverage for the real, production SourceAvailabilityAdapter.
 * Uses only a local, ephemeral-port HTTP server (node:http) — no external
 * network dependency and no live third-party URL.
 *
 * Transport behavior (HEAD/GET, status codes, timeout, the 405/501-retry) is
 * tested separately from the SSRF guard: it is tested against the local
 * server via the exported `probe()` directly, since `checkAsync()`'s SSRF
 * guard fail-closes on loopback (the local test server's own address) before
 * any socket opens — as it must for a real attacker-controlled target too.
 * The guard itself (`isNonPublicAddress`/`resolvePublicAddress`) is tested
 * separately against controlled addresses via the test-only `resolveAddress`
 * override, never by weakening the guard (no NODE_ENV bypass, no loopback
 * allow-list).
 */
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import test from "node:test";
import {
  HttpSourceAvailabilityAdapter,
  isNonPublicAddress,
  parseIpv6Literal,
  probe,
  resolveAvailabilityAdapter,
  resolvePublicAddress,
} from "./http-availability-adapter.ts";

async function withServer(
  handler: (req: import("node:http").IncomingMessage, res: import("node:http").ServerResponse) => void,
  fn: (baseUrl: string, port: number) => Promise<void>
): Promise<void> {
  const server: Server = createServer(handler);
  await new Promise<void>((resolvePromise) => server.listen(0, "127.0.0.1", resolvePromise));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("expected a bound TCP address");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    await fn(baseUrl, address.port);
  } finally {
    await new Promise<void>((resolvePromise) => server.close(() => resolvePromise()));
  }
}

const NOW = () => new Date("2026-09-16T12:00:00.000Z");

// --- Transport behavior (probe()) ---------------------------------------

test("a 200 response is reported as available", async () => {
  await withServer(
    (_req, res) => {
      res.statusCode = 200;
      res.end();
    },
    async (baseUrl) => {
      const result = await probe(new URL(baseUrl), "HEAD", 10_000, "127.0.0.1");
      assert.deepEqual(result, { kind: "status", status: "available" });
    }
  );
});

test("a 404 response is reported as unavailable", async () => {
  await withServer(
    (_req, res) => {
      res.statusCode = 404;
      res.end();
    },
    async (baseUrl) => {
      const result = await probe(new URL(baseUrl), "HEAD", 10_000, "127.0.0.1");
      assert.deepEqual(result, { kind: "status", status: "unavailable" });
    }
  );
});

test("a 401/403 response is reported as authentication_required", async () => {
  await withServer(
    (_req, res) => {
      res.statusCode = 403;
      res.end();
    },
    async (baseUrl) => {
      const result = await probe(new URL(baseUrl), "HEAD", 10_000, "127.0.0.1");
      assert.deepEqual(result, { kind: "status", status: "authentication_required" });
    }
  );
});

test("a 500 response is reported as unknown", async () => {
  await withServer(
    (_req, res) => {
      res.statusCode = 500;
      res.end();
    },
    async (baseUrl) => {
      const result = await probe(new URL(baseUrl), "HEAD", 10_000, "127.0.0.1");
      assert.deepEqual(result, { kind: "status", status: "unknown" });
    }
  );
});

test("a server that rejects HEAD at the connection level signals retry-with-get", async () => {
  const methodsSeen: string[] = [];
  await withServer(
    (req, res) => {
      methodsSeen.push(req.method ?? "");
      if (req.method === "HEAD") {
        req.destroy();
        return;
      }
      res.statusCode = 200;
      res.end();
    },
    async (baseUrl) => {
      const url = new URL(baseUrl);
      let result = await probe(url, "HEAD", 10_000, "127.0.0.1");
      assert.deepEqual(result, { kind: "retry-with-get" });
      result = await probe(url, "GET", 10_000, "127.0.0.1");
      assert.deepEqual(result, { kind: "status", status: "available" });
      assert.deepEqual(methodsSeen, ["HEAD", "GET"]);
    }
  );
});

test("a HEAD response of 405 signals retry-with-get, and the retried GET succeeds", async () => {
  const methodsSeen: string[] = [];
  await withServer(
    (req, res) => {
      methodsSeen.push(req.method ?? "");
      if (req.method === "HEAD") {
        res.statusCode = 405;
        res.end();
        return;
      }
      res.statusCode = 200;
      res.end();
    },
    async (baseUrl) => {
      const url = new URL(baseUrl);
      let result = await probe(url, "HEAD", 10_000, "127.0.0.1");
      assert.deepEqual(result, { kind: "retry-with-get" });
      result = await probe(url, "GET", 10_000, "127.0.0.1");
      assert.deepEqual(result, { kind: "status", status: "available" });
      assert.deepEqual(methodsSeen, ["HEAD", "GET"]);
    }
  );
});

test("a HEAD response of 501 signals retry-with-get, and the retried GET succeeds", async () => {
  const methodsSeen: string[] = [];
  await withServer(
    (req, res) => {
      methodsSeen.push(req.method ?? "");
      if (req.method === "HEAD") {
        res.statusCode = 501;
        res.end();
        return;
      }
      res.statusCode = 200;
      res.end();
    },
    async (baseUrl) => {
      const url = new URL(baseUrl);
      let result = await probe(url, "HEAD", 10_000, "127.0.0.1");
      assert.deepEqual(result, { kind: "retry-with-get" });
      result = await probe(url, "GET", 10_000, "127.0.0.1");
      assert.deepEqual(result, { kind: "status", status: "available" });
      assert.deepEqual(methodsSeen, ["HEAD", "GET"]);
    }
  );
});

test("a GET response of 405/501 is reported directly, never retried again", async () => {
  const methodsSeen: string[] = [];
  await withServer(
    (req, res) => {
      methodsSeen.push(req.method ?? "");
      res.statusCode = 501;
      res.end();
    },
    async (baseUrl) => {
      const result = await probe(new URL(baseUrl), "GET", 10_000, "127.0.0.1");
      assert.deepEqual(result, { kind: "status", status: "unknown" });
      assert.deepEqual(methodsSeen, ["GET"]);
    }
  );
});

test("a request exceeding the timeout is reported as timeout", async () => {
  await withServer(
    () => {
      // Never respond — the client-side timeout must fire.
    },
    async (baseUrl) => {
      const result = await probe(new URL(baseUrl), "HEAD", 100, "127.0.0.1");
      assert.deepEqual(result, { kind: "status", status: "timeout" });
    }
  );
});

test("probe pins the connection to the given address rather than re-resolving the hostname", async () => {
  await withServer(
    (_req, res) => {
      res.statusCode = 200;
      res.end();
    },
    async (_baseUrl, port) => {
      // A hostname that would not resolve on its own; only the pinned
      // address determines where the socket actually connects.
      const url = new URL(`http://this-host-does-not-exist.invalid.:${port}`);
      const result = await probe(url, "HEAD", 2000, "127.0.0.1");
      assert.deepEqual(result, { kind: "status", status: "available" });
    }
  );
});

// --- SSRF guard (isNonPublicAddress / resolvePublicAddress) -------------

test("isNonPublicAddress blocks loopback, private, link-local, and reserved IPv4 ranges", () => {
  for (const address of ["127.0.0.1", "10.1.2.3", "172.16.0.5", "172.31.255.255", "192.168.1.1", "169.254.1.1", "0.0.0.0", "100.64.0.1", "192.0.2.1", "255.255.255.255"]) {
    assert.equal(isNonPublicAddress(address), true, `expected ${address} to be blocked`);
  }
});

test("isNonPublicAddress blocks loopback, unique-local, link-local, and reserved IPv6 ranges, including IPv4-mapped addresses", () => {
  for (const address of ["::1", "::", "fc00::1", "fd12:3456:789a::1", "fe80::1", "ff02::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1", "2001:db8::1"]) {
    assert.equal(isNonPublicAddress(address), true, `expected ${address} to be blocked`);
  }
});

test("isNonPublicAddress allows public IPv4 and IPv6 addresses", () => {
  for (const address of ["8.8.8.8", "1.1.1.1", "93.184.216.34"]) {
    assert.equal(isNonPublicAddress(address), false, `expected ${address} to be allowed`);
  }
  for (const address of ["2606:4700:4700::1111", "2001:4860:4860::8888"]) {
    assert.equal(isNonPublicAddress(address), false, `expected ${address} to be allowed`);
  }
});

test("resolvePublicAddress rejects (fail-closed) when the resolver reports a private address", async () => {
  const url = new URL("https://internal.example.invalid/doc");
  const result = await resolvePublicAddress(url, async () => [{ address: "10.0.0.5", family: 4 }]);
  assert.equal(result, undefined);
});

test("resolvePublicAddress rejects when any one of several resolved addresses is non-public, even if others are public", async () => {
  const url = new URL("https://mixed.example.invalid/doc");
  const result = await resolvePublicAddress(url, async () => [
    { address: "8.8.8.8", family: 4 },
    { address: "127.0.0.1", family: 4 },
  ]);
  assert.equal(result, undefined);
});

test("resolvePublicAddress rejects (fail-closed) when DNS resolution throws", async () => {
  const url = new URL("https://this-host-does-not-exist.invalid./doc");
  const result = await resolvePublicAddress(url, async () => {
    throw new Error("ENOTFOUND");
  });
  assert.equal(result, undefined);
});

test("resolvePublicAddress rejects (fail-closed) when DNS resolution returns no records", async () => {
  const url = new URL("https://no-records.example.invalid/doc");
  const result = await resolvePublicAddress(url, async () => []);
  assert.equal(result, undefined);
});

test("resolvePublicAddress returns the first address when every resolved address is public", async () => {
  const url = new URL("https://public.example.invalid/doc");
  const result = await resolvePublicAddress(url, async () => [
    { address: "93.184.216.34", family: 4 },
    { address: "8.8.8.8", family: 4 },
  ]);
  assert.equal(result, "93.184.216.34");
});

// --- end-to-end via checkAsync / resolveAvailabilityAdapter -------------

test("a Source whose canonical_reference is loopback is reported unsupported and never receives a real request, even against a live local server", async () => {
  let requestReceived = false;
  await withServer(
    (_req, res) => {
      requestReceived = true;
      res.statusCode = 200;
      res.end();
    },
    async (baseUrl) => {
      const adapter = new HttpSourceAvailabilityAdapter({ now: NOW });
      const evidence = await adapter.checkAsync("SRC-1", { canonical_reference: baseUrl });
      assert.equal(evidence.status, "unsupported");
      assert.equal(requestReceived, false);
    }
  );
});

test("a Source whose canonical_reference resolves (via the injected resolver) to a private address is reported unsupported and never opens a socket", async () => {
  const adapter = new HttpSourceAvailabilityAdapter({
    now: NOW,
    resolveAddress: async () => [{ address: "10.1.2.3", family: 4 }],
  });
  const evidence = await adapter.checkAsync("SRC-1", { canonical_reference: "https://internal.example.invalid/doc" });
  assert.equal(evidence.status, "unsupported");
});

test("a Source with no canonical_reference reports unsupported, never a fabricated available result", async () => {
  const adapter = new HttpSourceAvailabilityAdapter({ now: NOW });
  const evidence = await adapter.checkAsync("SRC-1", {});
  assert.equal(evidence.status, "unsupported");
});

test("a non-http(s) canonical_reference reports unsupported", async () => {
  const adapter = new HttpSourceAvailabilityAdapter({ now: NOW });
  const evidence = await adapter.checkAsync("SRC-1", { canonical_reference: "ftp://example.invalid/file" });
  assert.equal(evidence.status, "unsupported");
});

test("an unresolvable host reports unsupported (DNS resolution failure fails closed, before any request)", async () => {
  const adapter = new HttpSourceAvailabilityAdapter({ now: NOW, timeoutMs: 2000 });
  const evidence = await adapter.checkAsync("SRC-1", { canonical_reference: "https://this-host-does-not-exist.invalid./doc" });
  assert.equal(evidence.status, "unsupported");
});

test("resolveAvailabilityAdapter resolves every material Source's guard decision in parallel via the injected resolver, and reports unsupported for any Source outside the resolved set", async () => {
  const sources = new Map<string, Record<string, unknown>>([
    ["SRC-A", { canonical_reference: "http://a.example.invalid/doc" }],
    ["SRC-B", { canonical_reference: "http://b.example.invalid/other" }],
  ]);
  const resolved: string[] = [];
  const resolveAddress = async (hostname: string) => {
    resolved.push(hostname);
    return [{ address: "10.1.2.3", family: 4 }]; // private: blocked before any socket opens
  };
  const adapter = await resolveAvailabilityAdapter(sources, { now: NOW, resolveAddress });
  assert.equal(adapter.check("SRC-A", {}).status, "unsupported");
  assert.equal(adapter.check("SRC-B", {}).status, "unsupported");
  assert.equal(adapter.check("SRC-UNRELATED", {}).status, "unsupported");
  assert.deepEqual(new Set(resolved), new Set(["a.example.invalid", "b.example.invalid"]));
});

// --- complete IANA special-purpose IPv6 classification -------------------

test("isNonPublicAddress blocks every IANA special-purpose IPv6 range", () => {
  const addresses = [
    "64:ff9b:1::1", // IPv4-IPv6 Translation (64:ff9b:1::/48)
    "100:0:0:1::1", // AMT (100:0:0:1::/64)
    "2001:2::1", // Benchmarking (2001:2::/48)
    "2002::1", // 6to4 (2002::/16)
    "3fff::1", // IETF Protocol Assignments, second block (3fff::/20)
    "5f00::1", // Segment Routing (SRv6) SIDs (5f00::/16)
  ];
  for (const address of addresses) {
    assert.equal(isNonPublicAddress(address), true, `expected ${address} to be blocked`);
  }
});

test("isNonPublicAddress blocks the wider IETF Protocol Assignments umbrella (2001::/23) while still allowing public addresses outside it", () => {
  for (const address of ["2001::1", "2001:1::1", "2001:3::1", "2001:4:112::1", "2001:20::1", "2001:1ff::1"]) {
    assert.equal(isNonPublicAddress(address), true, `expected ${address} to be blocked`);
  }
  // 2001:db8::/32 (documentation) sits outside 2001::/23 and must remain
  // blocked by its own separate rule, not merely by the umbrella above.
  assert.equal(isNonPublicAddress("2001:db8::1"), true);
  // A public address just outside every IANA special-purpose block must
  // remain allowed — the umbrella must not over-block unrelated space.
  assert.equal(isNonPublicAddress("2606:4700:4700::1111"), false);
});

test("resolvePublicAddress fails closed when one of several resolved addresses falls in an IANA special-purpose range, even if another is public", async () => {
  const url = new URL("https://mixed-special-purpose.example.invalid/doc");
  const result = await resolvePublicAddress(url, async () => [
    { address: "2606:4700:4700::1111", family: 6 },
    { address: "2002::1", family: 6 }, // 6to4
  ]);
  assert.equal(result, undefined);
});

// --- IPv6 literals in canonical_reference URLs ----------------------------

test("parseIpv6Literal extracts the address from a bracketed IPv6 literal hostname", () => {
  assert.equal(parseIpv6Literal("[::1]"), "::1");
  assert.equal(parseIpv6Literal("[2606:4700:4700::1111]"), "2606:4700:4700::1111");
  assert.equal(parseIpv6Literal("[2001:db8::1]"), "2001:db8::1");
});

test("parseIpv6Literal returns undefined for a plain hostname (not bracketed)", () => {
  assert.equal(parseIpv6Literal("example.invalid"), undefined);
  assert.equal(parseIpv6Literal("127.0.0.1"), undefined);
  assert.equal(parseIpv6Literal("::1"), undefined); // unbracketed — not a valid URL authority form
});

test("parseIpv6Literal returns undefined for bracketed-but-invalid content, never trusting bracket syntax alone", () => {
  assert.equal(parseIpv6Literal("[not-an-address]"), undefined);
  assert.equal(parseIpv6Literal("[127.0.0.1]"), undefined); // IPv4 literal is never a valid bracketed IPv6 form
  assert.equal(parseIpv6Literal("[]"), undefined);
  assert.equal(parseIpv6Literal("[::1"), undefined); // missing closing bracket
});

test("resolvePublicAddress allows a public IPv6 literal canonical_reference without ever calling the resolver", async () => {
  const url = new URL("https://[2606:4700:4700::1111]/doc");
  let resolverCalled = false;
  const result = await resolvePublicAddress(url, async () => {
    resolverCalled = true;
    return [];
  });
  assert.equal(result, "2606:4700:4700::1111");
  assert.equal(resolverCalled, false);
});

test("resolvePublicAddress blocks a loopback IPv6 literal canonical_reference without ever calling the resolver", async () => {
  const url = new URL("https://[::1]/doc");
  let resolverCalled = false;
  const result = await resolvePublicAddress(url, async () => {
    resolverCalled = true;
    return [];
  });
  assert.equal(result, undefined);
  assert.equal(resolverCalled, false);
});

test("resolvePublicAddress blocks a non-public IPv6 literal canonical_reference from each named IANA special-purpose range", async () => {
  for (const literal of ["[fc00::1]", "[fe80::1]", "[2001:db8::1]", "[2002::1]", "[3fff::1]", "[5f00::1]"]) {
    const url = new URL(`https://${literal}/doc`);
    const result = await resolvePublicAddress(url, async () => []);
    assert.equal(result, undefined, `expected ${literal} to be blocked`);
  }
});

test("end-to-end: a Source whose canonical_reference is a loopback IPv6 literal is reported unsupported and never receives a real request, even against a live IPv6-loopback server", async () => {
  const server = createServer((_req, res) => {
    res.statusCode = 200;
    res.end();
  });
  await new Promise<void>((resolvePromise) => server.listen(0, "::1", resolvePromise));
  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("expected a bound TCP address");
    const adapter = new HttpSourceAvailabilityAdapter({ now: NOW });
    const evidence = await adapter.checkAsync("SRC-1", { canonical_reference: `http://[::1]:${address.port}/` });
    assert.equal(evidence.status, "unsupported");
  } finally {
    await new Promise<void>((resolvePromise) => server.close(() => resolvePromise()));
  }
});

test("probe() connects correctly given a URL whose authority is a bracketed IPv6 literal (transport layer, kept separate from guard tests)", async () => {
  const server = createServer((_req, res) => {
    res.statusCode = 200;
    res.end();
  });
  await new Promise<void>((resolvePromise) => server.listen(0, "::1", resolvePromise));
  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("expected a bound TCP address");
    const url = new URL(`http://[::1]:${address.port}/`);
    const result = await probe(url, "HEAD", 10_000, "::1");
    assert.deepEqual(result, { kind: "status", status: "available" });
  } finally {
    await new Promise<void>((resolvePromise) => server.close(() => resolvePromise()));
  }
});
