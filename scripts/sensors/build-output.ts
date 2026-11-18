// Pure scans for check:build. File lists use paths relative to dist/ with "/" separators.

const PAGES = ["index.html", "ghost-mansion/index.html", "moodwalk/index.html", "core-demo/index.html"];

export function checkLayout(files: string[]): string[] {
  const set = new Set(files);
  const findings: string[] = [];
  for (const page of PAGES) {
    if (!set.has(page)) findings.push(`dist/${page}: page is missing`);
  }
  if (files.some((file) => file === "apps" || file.startsWith("apps/"))) {
    findings.push("dist/apps: folder must not exist");
  }
  return findings;
}

export function findBadAssetRefs(html: string, base: string, files: Set<string>): string[] {
  const findings: string[] = [];
  const attr = /\s(?:src|href)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
  for (const match of html.matchAll(attr)) {
    const value = (match[1] ?? match[2] ?? "").trim();
    if (value === "" || value.startsWith("#")) continue;
    if (/^(?:https?:)?\/\//i.test(value) || /^(?:data|mailto|javascript):/i.test(value)) continue;
    if (!value.startsWith(base)) {
      findings.push(`${value}: does not start with ${base}`);
      continue;
    }
    let rest = value.slice(base.length).split(/[?#]/)[0] ?? "";
    if (rest === "" || rest.endsWith("/")) rest += "index.html";
    if (!files.has(rest)) findings.push(`${value}: no such file in dist/`);
  }
  return findings;
}

export function findForeignUrls(
  text: string,
  origin: string,
  allow: readonly string[],
  allowExact: readonly string[],
): string[] {
  const found: string[] = [];
  for (const match of text.matchAll(/https?:\/\/[^\s"'`<>)]+/g)) {
    const url = match[0];
    if (url === origin || url.startsWith(origin + "/")) continue;
    if (allow.some((prefix) => url.startsWith(prefix))) continue;
    if (allowExact.some((entry) => url === entry)) continue;
    found.push(url);
  }
  return found;
}
