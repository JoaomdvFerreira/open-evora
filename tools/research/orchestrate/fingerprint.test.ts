import assert from "node:assert/strict";
import test from "node:test";

import { canonicalJsonStringify, sha256Hex } from "./fingerprint.ts";

test("object key ordering does not affect the canonical serialization", () => {
  const a = { b: 1, a: 2, c: { z: 1, y: 2 } };
  const b = { a: 2, c: { y: 2, z: 1 }, b: 1 };
  assert.equal(canonicalJsonStringify(a), canonicalJsonStringify(b));
});

test("array order is preserved as significant", () => {
  const a = { list: [1, 2, 3] };
  const b = { list: [3, 2, 1] };
  assert.notEqual(canonicalJsonStringify(a), canonicalJsonStringify(b));
});

test("sha256Hex is deterministic for identical logical input regardless of key order", () => {
  const a = { b: 1, a: 2 };
  const b = { a: 2, b: 1 };
  assert.equal(sha256Hex(a), sha256Hex(b));
});

test("sha256Hex differs for different logical input", () => {
  assert.notEqual(sha256Hex({ a: 1 }), sha256Hex({ a: 2 }));
});

test("sha256Hex produces a lowercase 64-character hex string", () => {
  const hash = sha256Hex({ a: 1 });
  assert.match(hash, /^[0-9a-f]{64}$/);
});
