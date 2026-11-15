// Fixture: a property that always fails. It is run only by pbt-failure.fixture.test.ts
// through vitest.fixture.config.ts. Its name does not end in .test.ts, so `npm test` skips it.
import fc from "fast-check";
import { test } from "vitest";

test("P-FND-FAIL always-failing property", () => {
  fc.assert(
    fc.property(fc.integer(), () => false),
    { numRuns: 100 },
  );
});
