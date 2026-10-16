import test from "node:test";
import assert from "node:assert/strict";
import { scheduledCompanyRange } from "../src/lib/journal/schedule";

test("scheduled scan reaches companies after the first 25 and wraps without overlap", () => {
  const visited = new Set<number>();
  for (let minute = 0; minute < 3; minute++) {
    const { from, to } = scheduledCompanyRange(51, minute * 60_000);
    for (let index = from; index <= Math.min(to, 50); index++) {
      assert.equal(visited.has(index), false);
      visited.add(index);
    }
  }
  assert.equal(visited.size, 51);
  assert.deepEqual(scheduledCompanyRange(51, 180_000), { from: 0, to: 24 });
  assert.deepEqual(scheduledCompanyRange(51, 119_999), scheduledCompanyRange(51, 60_000));
});

test("scheduled scan supports empty, exact-sized and changing lists", () => {
  assert.deepEqual(scheduledCompanyRange(0, 60_000), { from: 0, to: 24 });
  assert.deepEqual(scheduledCompanyRange(25, 60_000), { from: 0, to: 24 });
  assert.deepEqual(scheduledCompanyRange(26, 60_000), { from: 25, to: 49 });
  for (const count of [-1, 1.5, NaN]) assert.throws(() => scheduledCompanyRange(count));
});
