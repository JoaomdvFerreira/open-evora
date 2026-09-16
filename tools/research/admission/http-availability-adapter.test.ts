/**
 * WU053 remediation regression coverage: the real, production
 * SourceAvailabilityAdapter. Uses only a local, ephemeral-port HTTP server
 * (node:http) — no external network dependency and no live third-party URL.
 */
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import test from "node:test";
import { HttpSourceAvailabilityAdapter, resolveAvailabilityAdapter } from "./http-availability-adapter.ts";

async function withServer(
  handler: (req: import("node:http").IncomingMessage, res: import("node:http").ServerResponse) => void,
  fn: (baseUrl: string) => Promise<void>
): Promise<void> {
  const server: Server = createServer(handler);
  await new Promise<void>((resolvePromise) => server.listen(0, "127.0.0.1", resolvePromise));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("expected a bound TCP address");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    await fn(baseUrl);
  } finally {
    await new Promise<void>((resolvePromise) => server.close(() => resolvePromise()));
  }
}

const NOW = () => new Date("2026-09-16T12:00:00.000Z");

test("a 200 response is reported as available", async () => {
  await withServer(
    (_req, res) => {
      res.statusCode = 200;
      res.end();
    },
    async (baseUrl) => {
      const adapter = new HttpSourceAvailabilityAdapter({ now: NOW });
      const evidence = await adapter.checkAsync("SRC-1", { canonical_reference: baseUrl });
      assert.equal(evidence.status, "available");
      assert.equal(evidence.sourceId, "SRC-1");
      assert.equal(evidence.checkedAt, "2026-09-16T12:00:00.000Z");
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
      const adapter = new HttpSourceAvailabilityAdapter({ now: NOW });
      const evidence = await adapter.checkAsync("SRC-1", { canonical_reference: baseUrl });
      assert.equal(evidence.status, "unavailable");
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
      const adapter = new HttpSourceAvailabilityAdapter({ now: NOW });
      const evidence = await adapter.checkAsync("SRC-1", { canonical_reference: baseUrl });
      assert.equal(evidence.status, "authentication_required");
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
      const adapter = new HttpSourceAvailabilityAdapter({ now: NOW });
      const evidence = await adapter.checkAsync("SRC-1", { canonical_reference: baseUrl });
      assert.equal(evidence.status, "unknown");
    }
  );
});

test("a server that rejects HEAD retries once with GET", async () => {
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
      const adapter = new HttpSourceAvailabilityAdapter({ now: NOW });
      const evidence = await adapter.checkAsync("SRC-1", { canonical_reference: baseUrl });
      assert.equal(evidence.status, "available");
      assert.deepEqual(methodsSeen, ["HEAD", "GET"]);
    }
  );
});

test("a request exceeding the timeout is reported as timeout", async () => {
  await withServer(
    () => {
      // Never respond — the client-side timeout must fire.
    },
    async (baseUrl) => {
      const adapter = new HttpSourceAvailabilityAdapter({ now: NOW, timeoutMs: 100 });
      const evidence = await adapter.checkAsync("SRC-1", { canonical_reference: baseUrl });
      assert.equal(evidence.status, "timeout");
    }
  );
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

test("an unresolvable host reports error, never a fabricated available result", async () => {
  const adapter = new HttpSourceAvailabilityAdapter({ now: NOW, timeoutMs: 2000 });
  const evidence = await adapter.checkAsync("SRC-1", { canonical_reference: "https://this-host-does-not-exist.invalid./doc" });
  assert.ok(evidence.status === "error" || evidence.status === "timeout");
});

test("resolveAvailabilityAdapter resolves every material Source in parallel and reports unsupported for any Source outside the resolved set", async () => {
  await withServer(
    (_req, res) => {
      res.statusCode = 200;
      res.end();
    },
    async (baseUrl) => {
      const sources = new Map<string, Record<string, unknown>>([
        ["SRC-A", { canonical_reference: baseUrl }],
        ["SRC-B", { canonical_reference: `${baseUrl}/other` }],
      ]);
      const adapter = await resolveAvailabilityAdapter(sources, { now: NOW });
      assert.equal(adapter.check("SRC-A", {}).status, "available");
      assert.equal(adapter.check("SRC-B", {}).status, "available");
      assert.equal(adapter.check("SRC-UNRELATED", {}).status, "unsupported");
    }
  );
});
