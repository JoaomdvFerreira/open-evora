import type { DataProvider, RecordDetail, RecordSummary } from "../dataProvider/types";
import problemIndex from "../../generated/index.json";

/**
 * PRB Details Storybook fixture — real canonical PRB-0005 content, sourced from
 * the RE-01 generated read model (apps/research-explorer/generated/,
 * produced by `npm run build-data` from research/problems/PRB-0005.yaml and
 * its linked research/evidence/*.yaml, research/sources/*.yaml). No field is
 * invented or altered: every JSON module below is imported verbatim, exactly
 * as `generated/record-detail/<ID>.json` already exists on disk.
 *
 * docs/design/foundations.md's synthetic-content rule ("Synthetic design
 * content must use unmistakably synthetic identifiers... Canonical
 * identifiers may appear only with their canonical content") is why this
 * fixture carries the complete real PRB-0005 projection — all currently
 * linked EVD- records and their SRC- provenance — rather than a partial
 * or hand-authored substitute under the real PRB-0005 id.
 */
import prb0005 from "../../generated/record-detail/PRB-0005.json";
import evd000007 from "../../generated/record-detail/EVD-000007.json";
import evd000139 from "../../generated/record-detail/EVD-000139.json";
import evd000166 from "../../generated/record-detail/EVD-000166.json";
import evd000167 from "../../generated/record-detail/EVD-000167.json";
import src0017 from "../../generated/record-detail/SRC-0017.json";
import src0018 from "../../generated/record-detail/SRC-0018.json";
import src0132 from "../../generated/record-detail/SRC-0132.json";
import src0133 from "../../generated/record-detail/SRC-0133.json";
import src0134 from "../../generated/record-detail/SRC-0134.json";

const RECORDS = [
  prb0005,
  evd000007,
  evd000139,
  evd000166,
  evd000167,
  src0017,
  src0018,
  src0132,
  src0133,
  src0134,
] as unknown as RecordDetail[];

const recordsById = new Map(RECORDS.map((record) => [record.id, record]));

/**
 * `generated/index.json`'s RecordSummary rows for exactly the records this
 * fixture carries — narrowed from the full corpus index so this fixture
 * stays self-contained and does not implicitly depend on unrelated corpus
 * entries.
 */
const summariesById = new Map((problemIndex as RecordSummary[]).map((summary) => [summary.id, summary]));
const index: RecordSummary[] = RECORDS.map((record) => summariesById.get(record.id)).filter((summary): summary is RecordSummary => summary !== undefined);

/** Minimal in-memory DataProvider over the fixture records above — same shape contract as ProblemView.test.tsx's fixture provider, backed by real generated JSON instead of hand-authored objects. */
export const prb0005DataProvider: DataProvider = {
  getManifest: async () => {
    throw new Error("prb0005Fixture: getManifest is not used by PrbDetailsPresentation.stories.tsx");
  },
  listRecords: async () => index,
  getRecord: async (id: string) => {
    const record = recordsById.get(id);
    if (!record) throw new Error(`prb0005Fixture: no fixture record for ${id}`);
    return record;
  },
  getEdges: async () => [],
};
