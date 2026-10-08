import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StaticDataProvider } from "./StaticDataProvider";

const VALID_MANIFEST = {
  readModelVersion: "1.0.0",
  generatedAt: "2026-01-01T00:00:00.000Z",
  generator: "apps/research-explorer/scripts/build-data.js",
  sourceCommit: "deadbeef",
  corpusFingerprint: "abc123",
  totalRecords: 2,
  counts: { "PRB-": 1, "WID-": 1 },
  schemaPrefixes: ["PRB-", "WID-"],
};

const VALID_INDEX = [
  { id: "PRB-0005", type: "PRB-", label: "Fixture problem", file: "research/problems/PRB-0005.yaml", summaryFields: {} },
  { id: "WID-0001", type: "WID-", label: "WID-0001", file: "research/widgets/WID-0001.yaml", summaryFields: {} },
];

const VALID_DETAIL = {
  corpusFingerprint: VALID_MANIFEST.corpusFingerprint,
  id: "WID-0001",
  type: "WID-",
  file: "research/widgets/WID-0001.yaml",
  record: { widget_id: "WID-0001", problem: "PRB-0005" },
  outgoingEdges: [{ field: "problem", ordinal: null, to: "PRB-0005" }],
  incomingEdges: [],
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function notFoundResponse(): Response {
  return new Response(null, { status: 404 });
}

function invalidJsonResponse(): Response {
  return new Response("not valid json {{{", { status: 200 });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("StaticDataProvider.getManifest", () => {
  it("loads a valid, compatible manifest", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(VALID_MANIFEST));
    const provider = new StaticDataProvider();
    const manifest = await provider.getManifest();
    expect(manifest.readModelVersion).toBe("1.0.0");
    expect(manifest.totalRecords).toBe(2);
  });

  it("fetches manifest.json only, relative to BASE_URL, encapsulated in the provider", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(VALID_MANIFEST));
    const provider = new StaticDataProvider();
    await provider.getManifest();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestedUrl = String(fetchMock.mock.calls[0][0]);
    expect(requestedUrl.endsWith("manifest.json")).toBe(true);
  });

  it("rejects an incompatible major readModelVersion explicitly", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...VALID_MANIFEST, readModelVersion: "2.0.0" }));
    const provider = new StaticDataProvider();
    await expect(provider.getManifest()).rejects.toMatchObject({ kind: "incompatible" });
  });

  it("accepts a compatible minor/patch version difference", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...VALID_MANIFEST, readModelVersion: "1.4.2" }));
    const provider = new StaticDataProvider();
    const manifest = await provider.getManifest();
    expect(manifest.readModelVersion).toBe("1.4.2");
  });

  it("produces a localized error when generated data is missing (404)", async () => {
    fetchMock.mockResolvedValueOnce(notFoundResponse());
    const provider = new StaticDataProvider();
    await expect(provider.getManifest()).rejects.toThrow("Não foi possível encontrar o manifesto do Explorer.");
    fetchMock.mockResolvedValueOnce(notFoundResponse());
    await expect(new StaticDataProvider().getManifest()).rejects.toMatchObject({ kind: "missing" });
  });

  it("rejects a manifest missing a required field", async () => {
    const { readModelVersion, ...withoutVersion } = VALID_MANIFEST;
    void readModelVersion;
    fetchMock.mockResolvedValueOnce(jsonResponse(withoutVersion));
    const provider = new StaticDataProvider();
    await expect(provider.getManifest()).rejects.toMatchObject({ kind: "malformed" });
  });

  it("rejects a manifest with the wrong type for totalRecords", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...VALID_MANIFEST, totalRecords: "220" }));
    const provider = new StaticDataProvider();
    await expect(provider.getManifest()).rejects.toMatchObject({ kind: "malformed" });
  });

  it("rejects a response body that is not valid JSON", async () => {
    fetchMock.mockResolvedValueOnce(invalidJsonResponse());
    const provider = new StaticDataProvider();
    await expect(provider.getManifest()).rejects.toMatchObject({ kind: "malformed" });
  });

  it("reports a network error when fetch() itself rejects (e.g. offline), not just a bad response", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const provider = new StaticDataProvider();
    await expect(provider.getManifest()).rejects.toMatchObject({ kind: "network", message: "Não foi possível carregar o manifesto do Explorer." });
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(new StaticDataProvider().getManifest()).rejects.not.toThrow(/Failed to fetch/);
  });

  it("does not cache a failed load — a subsequent call retries the network", async () => {
    fetchMock.mockResolvedValueOnce(notFoundResponse());
    const provider = new StaticDataProvider();
    await expect(provider.getManifest()).rejects.toMatchObject({ kind: "missing" });

    fetchMock.mockResolvedValueOnce(jsonResponse(VALID_MANIFEST));
    const manifest = await provider.getManifest();
    expect(manifest.readModelVersion).toBe("1.0.0");
  });
});

describe("StaticDataProvider startup scope", () => {
  it("getManifest() never fetches edges.json or record-detail files", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(VALID_MANIFEST));
    const provider = new StaticDataProvider();
    await provider.getManifest();
    const urls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(urls.some((u) => u.includes("edges.json"))).toBe(false);
    expect(urls.some((u) => u.includes("record-detail"))).toBe(false);
  });
});

describe("StaticDataProvider.getRecord — record-ID safety", () => {
  it("rejects a syntactically unsafe ID before issuing any fetch", async () => {
    const provider = new StaticDataProvider();
    await expect(provider.getRecord("../../etc/passwd")).rejects.toMatchObject({ kind: "invalid_id", message: '"../../etc/passwd" não é um identificador de registo válido.' });
    await expect(provider.getRecord("PRB-0005/../secret")).rejects.toMatchObject({ kind: "invalid_id" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a well-formed but unknown ID without fetching its record-detail asset", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(VALID_MANIFEST));
    fetchMock.mockResolvedValueOnce(jsonResponse(VALID_INDEX));
    const provider = new StaticDataProvider();
    await expect(provider.getRecord("PRB-9999")).rejects.toMatchObject({ kind: "not_found" });
    const urls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(urls.some((u) => u.includes("record-detail"))).toBe(false);
  });

  it("resolves a future generic record type (WID-) present in the index", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(VALID_MANIFEST));
    fetchMock.mockResolvedValueOnce(jsonResponse(VALID_INDEX));
    fetchMock.mockResolvedValueOnce(jsonResponse(VALID_DETAIL));

    const provider = new StaticDataProvider();
    const result = await provider.getRecord("WID-0001");
    expect(result.id).toBe("WID-0001");
    expect(result.outgoingEdges[0].to).toBe("PRB-0005");

    const lastUrl = String(fetchMock.mock.calls[2][0]);
    expect(lastUrl.endsWith("record-detail/WID-0001.json")).toBe(true);
  });

  it("returns a detail only when its generated corpus identity matches the session manifest", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(VALID_MANIFEST));
    fetchMock.mockResolvedValueOnce(jsonResponse(VALID_INDEX));
    fetchMock.mockResolvedValueOnce(jsonResponse(VALID_DETAIL));
    await expect(new StaticDataProvider().getRecord("WID-0001")).resolves.toMatchObject({ corpusFingerprint: "abc123" });

    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce(jsonResponse(VALID_MANIFEST));
    fetchMock.mockResolvedValueOnce(jsonResponse(VALID_INDEX));
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...VALID_DETAIL, corpusFingerprint: "new-corpus" }));
    await expect(new StaticDataProvider().getRecord("WID-0001")).rejects.toMatchObject({ kind: "version_mismatch" });
  });

  it("allows a transient detail fetch failure to be retried", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(VALID_MANIFEST));
    fetchMock.mockResolvedValueOnce(jsonResponse(VALID_INDEX));
    fetchMock.mockRejectedValueOnce(new TypeError("offline"));
    fetchMock.mockResolvedValueOnce(jsonResponse(VALID_DETAIL));
    const provider = new StaticDataProvider();
    await expect(provider.getRecord("WID-0001")).rejects.toMatchObject({ kind: "network" });
    await expect(provider.getRecord("WID-0001")).resolves.toMatchObject({ id: "WID-0001" });
  });

  it("rejects a malformed (invalid JSON) record-detail response with an actionable error", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(VALID_MANIFEST));
    fetchMock.mockResolvedValueOnce(jsonResponse(VALID_INDEX));
    fetchMock.mockResolvedValueOnce(new Response("not valid json {{{", { status: 200 })); // record-detail

    const provider = new StaticDataProvider();
    await expect(provider.getRecord("PRB-0005")).rejects.toMatchObject({ kind: "malformed" });
  });
});

it("rejects fetchable index and detail entries that lack the fields consumers dereference", async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse([{ id: "PRB-0005" }]));
  await expect(new StaticDataProvider().listRecords()).rejects.toMatchObject({ kind: "malformed" });

  fetchMock.mockResolvedValueOnce(jsonResponse(VALID_MANIFEST));
  fetchMock.mockResolvedValueOnce(jsonResponse(VALID_INDEX));
  fetchMock.mockResolvedValueOnce(jsonResponse({ id: "PRB-0005", corpusFingerprint: "abc123", type: "PRB-", file: "research/problems/PRB-0005.yaml", record: {}, outgoingEdges: [], incomingEdges: [{}] }));
  await expect(new StaticDataProvider().getRecord("PRB-0005")).rejects.toMatchObject({ kind: "malformed" });

  fetchMock.mockReset();
  fetchMock.mockResolvedValueOnce(jsonResponse(VALID_MANIFEST));
  fetchMock.mockResolvedValueOnce(jsonResponse(VALID_INDEX));
  const { corpusFingerprint: omittedFingerprint, ...detailWithoutFingerprint } = VALID_DETAIL;
  void omittedFingerprint;
  fetchMock.mockResolvedValueOnce(jsonResponse(detailWithoutFingerprint));
  await expect(new StaticDataProvider().getRecord("WID-0001")).rejects.toMatchObject({ kind: "malformed" });
});

const VALID_EDGES = [
  { id: "PRB-0005::evidence::0::EVD-0001", from: "PRB-0005", to: "EVD-0001", field: "evidence", ordinal: 0, required: false },
];

describe("StaticDataProvider.getEdges — RE-04 lazy loading", () => {
  it("does not fetch edges.json as a side effect of getManifest() or listRecords()", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(VALID_MANIFEST));
    fetchMock.mockResolvedValueOnce(jsonResponse(VALID_INDEX));
    const provider = new StaticDataProvider();
    await provider.getManifest();
    await provider.listRecords();
    const urls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(urls.some((u) => u.includes("edges.json"))).toBe(false);
  });

  it("loads edges.json only when getEdges() is explicitly called, and caches the result", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(VALID_EDGES));
    const provider = new StaticDataProvider();
    const edges = await provider.getEdges();
    expect(edges).toEqual(VALID_EDGES);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await provider.getEdges();
    expect(fetchMock).toHaveBeenCalledTimes(1); // cached, no second fetch
  });

  it("rejects a malformed (non-array) edges.json", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ not: "an array" }));
    const provider = new StaticDataProvider();
    await expect(provider.getEdges()).rejects.toMatchObject({ kind: "malformed" });
  });

  it("rejects fetchable edges missing Graph-consumed identity or endpoint fields", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([{ id: "edge-1", from: "PRB-0005", field: "evidence", ordinal: 0, required: false }]));
    await expect(new StaticDataProvider().getEdges()).rejects.toMatchObject({ kind: "malformed" });
  });

  it("does not cache a failed edges.json load — a subsequent call retries the network", async () => {
    fetchMock.mockResolvedValueOnce(notFoundResponse());
    const provider = new StaticDataProvider();
    await expect(provider.getEdges()).rejects.toMatchObject({ kind: "missing" });

    fetchMock.mockResolvedValueOnce(jsonResponse(VALID_EDGES));
    const edges = await provider.getEdges();
    expect(edges).toEqual(VALID_EDGES);
  });
});
