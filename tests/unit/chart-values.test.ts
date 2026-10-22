import { test } from "node:test";
import assert from "node:assert/strict";
import { chartInteger, utilization } from "../../src/lib/chart-values";
import { brandStyle } from "../../src/lib/branding";
import { totp } from "../e2e/mfa-helper";
test("TOTP fixture generator matches the RFC SHA1 vector without logging secrets", () => {
  assert.equal(totp("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", 59000), "287082");
});
test("charts preserve unknowns and reject rounded, malformed or unsafe integer money", () => {
  for (const v of [
    null,
    undefined,
    "",
    false,
    "1.2",
    "1e4",
    9007199254740992,
    "9007199254740993",
    NaN,
  ])
    assert.equal(chartInteger(v), null);
  assert.equal(chartInteger("-12001"), -12001);
  assert.equal(chartInteger(0), 0);
  assert.equal(utilization(50, null), null);
  assert.equal(utilization(50, 0), null);
  assert.equal(utilization(25, 80), 31.3);
});
test("brand accents retain contrast against light surfaces without altering the brand", () => {
  function luminance(hex: string) {
    const c = hex
      .slice(1)
      .match(/../g)!
      .map((v) => parseInt(v, 16) / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
  }
  for (const color of ["#ffffff", "#000000", "#c6a456", "#6fe2ff", "#ff0000"]) {
    const style = brandStyle(color) as Record<string, string>;
    assert.equal(style["--brand"], color);
    assert.ok(1.05 / (luminance(style["--accent"]) + 0.05) >= 4.5);
    assert.ok(
      (luminance(style["--sidebar-accent"]) + 0.05) /
        (luminance("#30291C") + 0.05) >=
        4.5,
    );
    const a = luminance(style["--brand"]),
      b = luminance(style["--on-brand"]);
    assert.ok((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) >= 4.5);
  }
});
