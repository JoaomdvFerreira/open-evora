import { describe, expect, it } from "vitest";
import { DEFAULT_URL_STATE, parseUrlState, serializeUrlState } from "./urlState";
import { ALL_TYPES } from "../records/recordIndex";

describe("parseUrlState", () => {
  it("returns defaults for an empty search string", () => {
    expect(parseUrlState("")).toEqual(DEFAULT_URL_STATE);
  });

  it("parses view, id, q, and type", () => {
    expect(parseUrlState("?view=overview&id=PRB-0005&q=parking&type=PRB-")).toEqual({
      view: "overview",
      selectedId: "PRB-0005",
      query: "parking",
      typeFilter: "PRB-",
      graphDepth: 1,
    });
  });

  it("degrades an invalid view to the default rather than crashing", () => {
    expect(parseUrlState("?view=not-a-real-view").view).toBe("overview");
  });

  it("recognizes the RE-03 'problem' view", () => {
    expect(parseUrlState("?view=problem&id=PRB-0005")).toEqual({
      view: "problem",
      selectedId: "PRB-0005",
      query: "",
      typeFilter: ALL_TYPES,
      graphDepth: 1,
    });
  });

  it("UX-F: a graph-depth param round-trips even though 'graph' itself is normalized away below", () => {
    expect(parseUrlState("?d=2").graphDepth).toBe(2);
  });

  describe("UX-F: Graph Availability Gate — view=graph is normalized away", () => {
    it("a graph URL with a PRB-shaped id normalizes to the Problem view for that id", () => {
      expect(parseUrlState("?view=graph&id=PRB-0005&d=2")).toEqual({
        view: "problem",
        selectedId: "PRB-0005",
        query: "",
        typeFilter: ALL_TYPES,
        graphDepth: 2,
      });
    });

    it("a graph URL without a usable PRB selection normalizes to Overview, dropping the id", () => {
      expect(parseUrlState("?view=graph")).toEqual(DEFAULT_URL_STATE);
      expect(parseUrlState("?view=graph&id=EVD-000105")).toEqual({ ...DEFAULT_URL_STATE });
      expect(parseUrlState("?view=graph&id=EVD-000105").selectedId).toBeNull();
    });

    it("a stale/non-existent PRB-shaped id still normalizes to Problem view (existence is validated downstream)", () => {
      expect(parseUrlState("?view=graph&id=PRB-STALE").view).toBe("problem");
      expect(parseUrlState("?view=graph&id=PRB-STALE").selectedId).toBe("PRB-STALE");
    });

    it("preserves q and type alongside the normalized view/id", () => {
      const state = parseUrlState("?view=graph&id=PRB-0005&q=parking&type=PRB-");
      expect(state.view).toBe("problem");
      expect(state.query).toBe("parking");
      expect(state.typeFilter).toBe("PRB-");
    });
  });

  it("clamps an out-of-range graph depth to the nearest valid value", () => {
    expect(parseUrlState("?d=5").graphDepth).toBe(2);
    expect(parseUrlState("?d=0").graphDepth).toBe(1);
    expect(parseUrlState("?d=not-a-number").graphDepth).toBe(1);
  });

  it("treats an empty id param as no selection", () => {
    expect(parseUrlState("?id=").selectedId).toBeNull();
  });

  it("does not validate selectedId syntax/existence here — that is the DataProvider's job", () => {
    // Deliberately a value that would fail StaticDataProvider's safety check
    // (contains a path separator) — parseUrlState must still return it
    // as-is; StaticDataProvider.getRecord() is what rejects it safely.
    expect(parseUrlState("?id=../secret").selectedId).toBe("../secret");
  });
});

describe("serializeUrlState", () => {
  it("serializes to an empty string for the default state", () => {
    expect(serializeUrlState(DEFAULT_URL_STATE)).toBe("");
  });

  it("only includes non-default fields", () => {
    const qs = serializeUrlState({ ...DEFAULT_URL_STATE, query: "evora" });
    expect(qs).toBe("?q=evora");
  });

  it("round-trips a full state", () => {
    const state = { view: "overview" as const, selectedId: "EVD-000105", query: "via verde", typeFilter: "EVD-", graphDepth: 2 as const };
    expect(parseUrlState(serializeUrlState(state))).toEqual(state);
  });

  it("omits typeFilter when it equals ALL_TYPES", () => {
    const qs = serializeUrlState({ ...DEFAULT_URL_STATE, typeFilter: ALL_TYPES });
    expect(qs).not.toContain("type=");
  });

  it("omits the depth param at the default depth, and includes it otherwise", () => {
    expect(serializeUrlState({ ...DEFAULT_URL_STATE, graphDepth: 1 })).not.toContain("d=");
    expect(serializeUrlState({ ...DEFAULT_URL_STATE, view: "graph", graphDepth: 2 })).toBe("?view=graph&d=2");
  });
});
