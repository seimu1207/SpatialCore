export type RequiredHeading = "PBT properties" | "Safety";

export type SectionsResult = { missing: RequiredHeading[] };

const REQUIRED: readonly RequiredHeading[] = ["PBT properties", "Safety"];

const OPEN_FENCE = /^ {0,3}(`{3,}|~{3,})/;
const HEADING = /^ {0,3}#{1,6}(?:[ \t]+(.*?))?[ \t]*$/;

/** Pure check: which Required_Headings are absent from the Markdown text. */
export function checkRequiredSections(text: string): SectionsResult {
  const found = new Set<string>();
  let fence: { char: string; len: number } | null = null;

  for (const line of text.split(/\r\n|\r|\n/)) {
    if (fence !== null) {
      const closer = new RegExp(`^ {0,3}(${fence.char}{${fence.len},})[ \\t]*$`);
      if (closer.test(line)) fence = null;
      continue;
    }
    const open = OPEN_FENCE.exec(line);
    if (open !== null) {
      const run = open[1] ?? "";
      fence = { char: run.charAt(0) === "`" ? "`" : "~", len: run.length };
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading !== null) {
      const raw = heading[1] ?? "";
      const name = raw.replace(/(?:^|[ \t]+)#+$/, "").trim().toLowerCase();
      found.add(name);
    }
  }

  return { missing: REQUIRED.filter((h) => !found.has(h.toLowerCase())) };
}

/** True when the repo-relative path names a spec requirements.md or design.md. */
export function isSpecDocumentPath(relPath: string): boolean {
  const p = relPath.replace(/\\/g, "/").replace(/^\.\//, "");
  return /^\.kiro\/specs\/[^/]+\/(requirements|design)\.md$/.test(p);
}
