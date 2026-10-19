import { timingSafeEqual } from "node:crypto";

export function matchesSecret(
  expected: string | undefined,
  supplied: string | undefined,
) {
  if (!expected || !supplied) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(supplied);
  return a.byteLength === b.byteLength && timingSafeEqual(a, b);
}
