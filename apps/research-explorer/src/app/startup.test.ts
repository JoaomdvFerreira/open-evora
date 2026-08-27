import { describe, expect, it } from "vitest";
import { loadExplorerStartupState } from "./startup";
import { DataLoadError, type DataProvider, type ReadModelManifest, type RecordDetail, type RecordSummary } from "../dataProvider/types";

const VALID_MANIFEST: ReadModelManifest = {
  readModelVersion: "1.0.0",
  generatedAt: "2026-01-01T00:00:00.000Z",
  generator: "apps/research-explorer/scripts/build-data.js",
  sourceCommit: "deadbeef",
  corpusFingerprint: "abc123",
  totalRecords: 220,
  counts: { "PRB-": 10 },
  schemaPrefixes: ["PRB-"],
};

function fakeProvider(overrides: Partial<DataProvider>): DataProvider {
  return {
    getManifest: () => Promise.reject(new Error("not implemented")),
    listRecords: () => Promise.resolve([] as RecordSummary[]),
    getRecord: () => Promise.reject(new Error("not implemented")) as Promise<RecordDetail>,
    getEdges: () => Promise.resolve([]),
    ...overrides,
  };
}

describe("loadExplorerStartupState", () => {
  it("reaches ready state when the provider returns a valid manifest", async () => {
    const provider = fakeProvider({ getManifest: () => Promise.resolve(VALID_MANIFEST) });
    const result = await loadExplorerStartupState(provider);
    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.manifest.totalRecords).toBe(220);
    }
  });

  it("only calls getManifest() during startup — never listRecords()/getRecord()", async () => {
    let listRecordsCalled = false;
    const provider = fakeProvider({
      getManifest: () => Promise.resolve(VALID_MANIFEST),
      listRecords: () => {
        listRecordsCalled = true;
        return Promise.resolve([]);
      },
    });
    await loadExplorerStartupState(provider);
    expect(listRecordsCalled).toBe(false);
  });

  it("surfaces a DataLoadError from the provider as an error state", async () => {
    const provider = fakeProvider({
      getManifest: () => Promise.reject(new DataLoadError("missing generated data", "missing")),
    });
    const result = await loadExplorerStartupState(provider);
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.error.kind).toBe("missing");
    }
  });

  it("wraps an unrecognized failure rather than crashing", async () => {
    const provider = fakeProvider({ getManifest: () => Promise.reject(new Error("boom")) });
    const result = await loadExplorerStartupState(provider);
    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.error).toBeInstanceOf(DataLoadError);
      expect(result.error.message).toContain("boom");
    }
  });
});
