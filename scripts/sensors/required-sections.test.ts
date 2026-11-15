import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { checkRequiredSections as check } from "./required-sections.ts";

const plainLine = fc.string().filter((s) => !/[#`~\n\r]/.test(s));
const decoyLine = fc.constantFrom(
  "#Safety",
  "## Safety notes",
  "# PBT",
  "### Other",
  "####### Safety",
  "    # Safety",
);
const join = (lines: string[]) => lines.join("\n");
const plainDoc = fc.array(fc.oneof(plainLine, decoyLine)).map(join);
const anyDoc = fc
  .array(
    fc.oneof(
      plainLine,
      decoyLine,
      fc.constantFrom("# PBT properties", "## Safety", "```", "~~~~", "   ```", "# Safety #"),
    ),
  )
  .map(join);

const runs = { numRuns: 100 };
const BOTH = ["PBT properties", "Safety"];

describe("required-sections properties", () => {
  // Feature: repo-foundation, Property 1: P-FND-1 same input gives same result
  // Validates: Requirements 5.1, 5.2
  it("P-FND-1 same input gives same result", () => {
    fc.assert(
      fc.property(fc.oneof(anyDoc, fc.string()), (t) => {
        expect(check(t)).toEqual(check(t));
      }),
      runs,
    );
  });

  // Feature: repo-foundation, Property 2: P-FND-2 adding and removing a heading
  // Validates: Requirements 5.1, 5.2, 5.7
  it("P-FND-2 adding and removing a heading", () => {
    const hashes = (n: number) => "#".repeat(n);
    fc.assert(
      fc.property(
        plainDoc,
        fc.integer({ min: 1, max: 6 }),
        fc.integer({ min: 1, max: 6 }),
        (base, a, b) => {
          const pbt = `${hashes(a)} PBT properties`;
          const safety = `${hashes(b)} Safety`;
          expect(check(`${base}\n${pbt}\n${safety}`).missing).toEqual([]);
          expect(check(`${base}\n${safety}`).missing).toEqual(["PBT properties"]);
          expect(check(`${base}\n${pbt}`).missing).toEqual(["Safety"]);
        },
      ),
      runs,
    );
  });

  // Feature: repo-foundation, Property 3: P-FND-3 headings in code blocks do not count
  // Validates: Requirements 5.6
  it("P-FND-3 headings in code blocks do not count", () => {
    fc.assert(
      fc.property(plainDoc, fc.constantFrom("```", "~~~", "````", "~~~~~"), (base, f) => {
        const body = "# PBT properties\n## Safety";
        expect(check(`${base}\n${f}\n${body}\n${f}`).missing).toEqual(BOTH);
        expect(check(`${base}\n${f}\n${body}`).missing).toEqual(BOTH);
      }),
      runs,
    );
  });
});

describe("required-sections examples", () => {
  const pbt = "# PBT properties";
  const safety = "# Safety";

  it("unclosed fence hides later headings", () => {
    expect(check(`\`\`\`\n${pbt}\n${safety}`).missing).toEqual(BOTH);
  });

  it("a shorter fence does not close a longer one", () => {
    expect(check(`\`\`\`\`\n\`\`\`\n${pbt}\n${safety}`).missing).toEqual(BOTH);
    expect(check(`\`\`\`\`\n\`\`\`\`\n${pbt}\n${safety}`).missing).toEqual([]);
  });

  it("a different fence character does not close a fence", () => {
    expect(check(`\`\`\`\n~~~\n${pbt}\n${safety}`).missing).toEqual(BOTH);
  });

  it("#Safety without a space is not a heading", () => {
    expect(check(`${pbt}\n#Safety`).missing).toEqual(["Safety"]);
  });

  it("## Safety notes is not a Required_Heading", () => {
    expect(check(`${pbt}\n## Safety notes`).missing).toEqual(["Safety"]);
  });

  it("closing # run is not part of the text", () => {
    expect(check("# PBT properties ##\n## Safety #").missing).toEqual([]);
  });

  it("headings indented up to 3 spaces count, 4 spaces do not", () => {
    expect(check("   # PBT properties\n  ## Safety").missing).toEqual([]);
    expect(check("    # PBT properties\n    ## Safety").missing).toEqual(BOTH);
  });

  it("matching is case-insensitive and trimmed", () => {
    expect(check("# pbt PROPERTIES  \n# SAFETY").missing).toEqual([]);
  });
});
