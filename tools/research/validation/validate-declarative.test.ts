/**
 * Focused tests for the five generic declarative schema capabilities added
 * for SRC-V2B (allowedFields, fieldTypes, patterns, conditionalRequired,
 * exclusiveFieldSets). These are generic validator infrastructure, not
 * SRC-v2 semantics — so every fixture here uses a synthetic "TST-" schema
 * and synthetic records, never real SRC/EVD/PRB schemas or records. That
 * keeps this slice from doubling as an (unintended) SRC-v2 migration test.
 *
 * Run with Node's built-in test runner: node --test tools/research (recursively)
 */
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";

import { validateResearchRoot } from "./validate.ts";

const DIRS = ["things", "schemas"];

function makeRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "evora-declarative-"));
  for (const d of DIRS) mkdirSync(join(root, d), { recursive: true });
  return root;
}

function writeSchema(root: string, schema: Record<string, unknown>): void {
  writeFileSync(join(root, "schemas", "thing.schema.json"), JSON.stringify(schema, null, 2), "utf8");
}

function writeThing(root: string, filename: string, content: string): void {
  writeFileSync(join(root, "things", filename), content, "utf8");
}

const BASE_SCHEMA = {
  prefix: "TST-",
  directory: "things",
  idField: "thing_id",
  requiredFields: ["thing_id"],
};

describe("allowedFields", () => {
  test("unknown top-level field is rejected when allowedFields is declared", () => {
    const root = makeRoot();
    try {
      writeSchema(root, { ...BASE_SCHEMA, allowedFields: ["thing_id", "name"] });
      writeThing(root, "TST-0001.yaml", "thing_id: TST-0001\nname: Foo\nbogus_field: true\n");
      const result = validateResearchRoot(root);
      assert.ok(result.errors.some((e) => e.includes('field "bogus_field" is not an allowed field')));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("unknown nested field is rejected", () => {
    const root = makeRoot();
    try {
      writeSchema(root, { ...BASE_SCHEMA, allowedFields: ["thing_id", "scope", "scope.geography"] });
      writeThing(root, "TST-0001.yaml", "thing_id: TST-0001\nscope:\n  geography: municipality\n  bogus: 1\n");
      const result = validateResearchRoot(root);
      assert.ok(result.errors.some((e) => e.includes('field "scope.bogus" is not an allowed field')));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("declared parent object path is allowed without enumerating every leaf", () => {
    const root = makeRoot();
    try {
      writeSchema(root, { ...BASE_SCHEMA, allowedFields: ["thing_id", "scope", "scope.geography"] });
      writeThing(root, "TST-0001.yaml", "thing_id: TST-0001\nscope:\n  geography: municipality\n");
      const result = validateResearchRoot(root);
      assert.deepEqual(result.errors, []);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("existing behavior unchanged when allowedFields is absent", () => {
    const root = makeRoot();
    try {
      writeSchema(root, BASE_SCHEMA);
      writeThing(root, "TST-0001.yaml", "thing_id: TST-0001\nanything_goes: true\nnested:\n  whatever: 1\n");
      const result = validateResearchRoot(root);
      assert.deepEqual(result.errors, []);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("fieldTypes", () => {
  test("value matching one of the declared types passes", () => {
    const root = makeRoot();
    try {
      writeSchema(root, { ...BASE_SCHEMA, fieldTypes: { publisher: ["string"], licence: ["string", "null"] } });
      writeThing(root, "TST-0001.yaml", "thing_id: TST-0001\npublisher: Acme\nlicence: null\n");
      const result = validateResearchRoot(root);
      assert.deepEqual(result.errors, []);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("value not matching any declared type is rejected", () => {
    const root = makeRoot();
    try {
      writeSchema(root, { ...BASE_SCHEMA, fieldTypes: { publisher: ["string"] } });
      writeThing(root, "TST-0001.yaml", "thing_id: TST-0001\npublisher: 42\n");
      const result = validateResearchRoot(root);
      assert.ok(result.errors.some((e) => e.includes('field "publisher" has type "number"')));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("multiple allowed types: boolean or string, both pass", () => {
    const root = makeRoot();
    try {
      writeSchema(root, { ...BASE_SCHEMA, fieldTypes: { machine_readable: ["boolean", "string"] } });
      writeThing(root, "TST-0001.yaml", "thing_id: TST-0001\nmachine_readable: unknown\n");
      const result = validateResearchRoot(root);
      assert.deepEqual(result.errors, []);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("missing optional field is not a type error", () => {
    const root = makeRoot();
    try {
      writeSchema(root, { ...BASE_SCHEMA, fieldTypes: { publisher: ["string"] } });
      writeThing(root, "TST-0001.yaml", "thing_id: TST-0001\n");
      const result = validateResearchRoot(root);
      assert.deepEqual(result.errors, []);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("patterns", () => {
  test("string value matching the pattern passes", () => {
    const root = makeRoot();
    try {
      writeSchema(root, { ...BASE_SCHEMA, patterns: { checked_at: "\\d{4}-\\d{2}-\\d{2}" } });
      writeThing(root, "TST-0001.yaml", "thing_id: TST-0001\nchecked_at: \"2026-08-11\"\n");
      const result = validateResearchRoot(root);
      assert.deepEqual(result.errors, []);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("string value not matching the pattern is rejected", () => {
    const root = makeRoot();
    try {
      writeSchema(root, { ...BASE_SCHEMA, patterns: { checked_at: "\\d{4}-\\d{2}-\\d{2}" } });
      writeThing(root, "TST-0001.yaml", "thing_id: TST-0001\nchecked_at: \"2026-08\"\n");
      const result = validateResearchRoot(root);
      assert.ok(result.errors.some((e) => e.includes('field "checked_at" value "2026-08" does not match required pattern')));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("pattern is only applied when the field is present", () => {
    const root = makeRoot();
    try {
      writeSchema(root, { ...BASE_SCHEMA, patterns: { checked_at: "\\d{4}-\\d{2}-\\d{2}" } });
      writeThing(root, "TST-0001.yaml", "thing_id: TST-0001\n");
      const result = validateResearchRoot(root);
      assert.deepEqual(result.errors, []);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("an invalid declared pattern fails deterministically rather than silently disabling validation", () => {
    const root = makeRoot();
    try {
      writeSchema(root, { ...BASE_SCHEMA, patterns: { checked_at: "(unclosed" } });
      writeThing(root, "TST-0001.yaml", "thing_id: TST-0001\nchecked_at: \"anything\"\n");
      const result = validateResearchRoot(root);
      assert.ok(result.errors.some((e) => e.includes('field "checked_at" declares an invalid pattern')));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("conditionalRequired", () => {
  const IN_SCHEMA = {
    ...BASE_SCHEMA,
    conditionalRequired: [
      {
        field: "acquisition.method",
        in: ["direct_contact", "direct_submission", "archive"],
        requires: ["acquisition.obtained_at"],
      },
    ],
  };

  test("'in' condition matches: required field missing is rejected", () => {
    const root = makeRoot();
    try {
      writeSchema(root, IN_SCHEMA);
      writeThing(root, "TST-0001.yaml", "thing_id: TST-0001\nacquisition:\n  method: archive\n");
      const result = validateResearchRoot(root);
      assert.ok(
        result.errors.some((e) =>
          e.includes('field "acquisition.obtained_at" is required when "acquisition.method" is "archive"')
        )
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("'in' condition matches: required field present passes", () => {
    const root = makeRoot();
    try {
      writeSchema(root, IN_SCHEMA);
      writeThing(
        root,
        "TST-0001.yaml",
        'thing_id: TST-0001\nacquisition:\n  method: archive\n  obtained_at: "2026-08-11"\n'
      );
      const result = validateResearchRoot(root);
      assert.deepEqual(result.errors, []);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("'in' condition does not match: no requirement triggered", () => {
    const root = makeRoot();
    try {
      writeSchema(root, IN_SCHEMA);
      writeThing(root, "TST-0001.yaml", "thing_id: TST-0001\nacquisition:\n  method: public_web\n");
      const result = validateResearchRoot(root);
      assert.deepEqual(result.errors, []);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  const NOT_IN_SCHEMA = {
    ...BASE_SCHEMA,
    conditionalRequired: [
      {
        field: "scope.geography.level",
        notIn: ["non_geographic", "unknown"],
        requires: ["scope.geography.area"],
      },
    ],
  };

  test("'notIn' condition matches: required field missing is rejected", () => {
    const root = makeRoot();
    try {
      writeSchema(root, NOT_IN_SCHEMA);
      writeThing(root, "TST-0001.yaml", "thing_id: TST-0001\nscope:\n  geography:\n    level: municipality\n");
      const result = validateResearchRoot(root);
      assert.ok(
        result.errors.some((e) =>
          e.includes('field "scope.geography.area" is required when "scope.geography.level" is "municipality"')
        )
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("'notIn' condition does not match (value is in the notIn list): no requirement triggered", () => {
    const root = makeRoot();
    try {
      writeSchema(root, NOT_IN_SCHEMA);
      writeThing(root, "TST-0001.yaml", "thing_id: TST-0001\nscope:\n  geography:\n    level: non_geographic\n");
      const result = validateResearchRoot(root);
      assert.deepEqual(result.errors, []);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("exclusiveFieldSets", () => {
  const SCHEMA = {
    ...BASE_SCHEMA,
    exclusiveFieldSets: [
      {
        path: "scope.temporal",
        sets: [["as_of"], ["start", "end"]],
      },
    ],
  };

  test("valid 'as_of' form passes", () => {
    const root = makeRoot();
    try {
      writeSchema(root, SCHEMA);
      writeThing(root, "TST-0001.yaml", 'thing_id: TST-0001\nscope:\n  temporal:\n    as_of: "2026"\n');
      const result = validateResearchRoot(root);
      assert.deepEqual(result.errors, []);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("valid 'start + end' form passes", () => {
    const root = makeRoot();
    try {
      writeSchema(root, SCHEMA);
      writeThing(
        root,
        "TST-0001.yaml",
        'thing_id: TST-0001\nscope:\n  temporal:\n    start: "2020"\n    end: "2024"\n'
      );
      const result = validateResearchRoot(root);
      assert.deepEqual(result.errors, []);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("both forms present is rejected", () => {
    const root = makeRoot();
    try {
      writeSchema(root, SCHEMA);
      writeThing(
        root,
        "TST-0001.yaml",
        'thing_id: TST-0001\nscope:\n  temporal:\n    as_of: "2026"\n    start: "2020"\n    end: "2024"\n'
      );
      const result = validateResearchRoot(root);
      assert.ok(result.errors.some((e) => e.includes('field "scope.temporal" must author exactly one of')));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("partial interval (only 'start') is rejected", () => {
    const root = makeRoot();
    try {
      writeSchema(root, SCHEMA);
      writeThing(root, "TST-0001.yaml", 'thing_id: TST-0001\nscope:\n  temporal:\n    start: "2020"\n');
      const result = validateResearchRoot(root);
      assert.ok(result.errors.some((e) => e.includes('field "scope.temporal" must author exactly one of')));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("empty object is rejected", () => {
    const root = makeRoot();
    try {
      writeSchema(root, SCHEMA);
      writeThing(root, "TST-0001.yaml", "thing_id: TST-0001\nscope:\n  temporal: {}\n");
      const result = validateResearchRoot(root);
      assert.ok(result.errors.some((e) => e.includes('field "scope.temporal" must author exactly one of')));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("absent optional parent object is accepted (rule not applied)", () => {
    const root = makeRoot();
    try {
      writeSchema(root, SCHEMA);
      writeThing(root, "TST-0001.yaml", "thing_id: TST-0001\nscope:\n  geography: municipality\n");
      const result = validateResearchRoot(root);
      assert.deepEqual(result.errors, []);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
