import { test } from "node:test";
import assert from "node:assert/strict";
import { matchesSecret } from "../../src/lib/secret-auth";

test("worker bearer checks reject missing, incorrect and unequal UTF-8 byte lengths", () => {
  assert.equal(matchesSecret(undefined, "secret"), false);
  assert.equal(matchesSecret("secret", undefined), false);
  assert.equal(matchesSecret("", ""), false);
  assert.equal(matchesSecret("abc", "ábč"), false);
  assert.equal(matchesSecret("abc", "abd"), false);
  assert.equal(matchesSecret("abc", "abc"), true);
});
