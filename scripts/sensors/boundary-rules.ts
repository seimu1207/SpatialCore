import type { Linter } from "eslint";

// Separator class: "/" or "\" written with hex escapes so the same text works
// inside a RegExp source and inside an esquery regex literal.
const S = "[\\x2F\\x5C]";

const segment = (name: string): string => `(^|${S})${name}(${S}|$)`;

const APPS_SEGMENT = segment("apps");
const VIEW_SEGMENT = segment("view");
const MOODWALK_SEGMENT = segment("moodwalk");
const GHOST_MANSION_SEGMENT = segment("ghost-mansion");

const MODEL_PACKAGES = [
  `^(three|react|react-dom)(${S}|$)`,
  `^@react-three(${S}|$)`,
  `^three-`,
  `^\\.\\.?${S}(.*${S})?node_modules(${S}|$)`,
];

type Ban = { regex: string; message: string };

const ban = (regex: string, message: string): Ban => ({
  regex,
  message: `[boundary] ${message}`,
});

type Selector = { selector: string; message: string };

// Selectors for forms that no-restricted-imports does not inspect, one set per forbidden regex.
function specifierSelectors(regex: string, message: string): Selector[] {
  const m = `[boundary] ${message}`;
  return [
    { selector: `ImportExpression[source.type='Literal'][source.value=/${regex}/]`, message: m },
    {
      selector: `ImportExpression[source.type='TemplateLiteral'][source.expressions.length=0][source.quasis.0.value.cooked=/${regex}/]`,
      message: m,
    },
    {
      selector: `CallExpression[callee.name='require'][arguments.0.type='Literal'][arguments.0.value=/${regex}/]`,
      message: m,
    },
    {
      selector: `CallExpression[callee.name='require'][arguments.0.type='TemplateLiteral'][arguments.0.expressions.length=0][arguments.0.quasis.0.value.cooked=/${regex}/]`,
      message: m,
    },
    { selector: `TSImportType Literal[value=/${regex}/]`, message: m },
  ];
}

// R-FND-04.10: forms whose target cannot be checked statically. Added to every scope.
const DYNAMIC_FORM_SELECTORS: Selector[] = [
  {
    selector: "ImportExpression[source.type!='Literal'][source.type!='TemplateLiteral']",
    message: "[boundary] dynamic-import: import() needs a string literal argument.",
  },
  {
    selector: "ImportExpression[source.type='TemplateLiteral'][source.expressions.length>0]",
    message: "[boundary] dynamic-import: import() must not use a template literal with substitutions.",
  },
  {
    selector: "CallExpression[callee.name='require'][arguments.0.type!='Literal'][arguments.0.type!='TemplateLiteral']",
    message: "[boundary] dynamic-require: require() needs a string literal argument.",
  },
  {
    selector: "CallExpression[callee.name='require'][arguments.0.type='TemplateLiteral'][arguments.0.expressions.length>0]",
    message: "[boundary] dynamic-require: require() must not use a template literal with substitutions.",
  },
  {
    selector: "MemberExpression[object.type='MetaProperty'][property.name='glob']",
    message: "[boundary] import.meta.glob is not allowed.",
  },
  {
    selector: "MemberExpression[object.name='require'][property.name='resolve']",
    message: "[boundary] require.resolve is not allowed.",
  },
  {
    selector: "CallExpression[callee.name='createRequire']",
    message: "[boundary] createRequire(...) is not allowed.",
  },
  {
    selector: "MemberExpression[property.name='createRequire']",
    message: "[boundary] createRequire is not allowed.",
  },
  {
    selector: "CallExpression[callee.object.name='module'][callee.property.name='require']",
    message: "[boundary] module.require(...) is not allowed.",
  },
  {
    selector: "CallExpression[callee.name='eval']",
    message: "[boundary] eval(...) is not allowed.",
  },
  {
    selector:
      "Identifier[name='Function']:not(TSTypeReference > Identifier):not(MemberExpression[computed=false] > Identifier.property):not(Property > Identifier.key)",
    message: "[boundary] The Function constructor (new Function / Function(...)) is not allowed.",
  },
  {
    selector: "MemberExpression[property.name='Function']",
    message: "[boundary] The Function constructor (for example globalThis.Function) is not allowed.",
  },
];

function scope(name: string, files: string[], ignores: string[], bans: Ban[]): Linter.Config {
  const selectors: Selector[] = [
    ...bans.flatMap((b) => specifierSelectors(b.regex, b.message.replace(/^\[boundary\] /, ""))),
    ...DYNAMIC_FORM_SELECTORS,
  ];
  const config: Linter.Config = {
    name: `boundary/${name}`,
    files,
    rules: {
      "no-restricted-syntax": ["error", ...selectors],
    },
  };
  if (ignores.length > 0) config.ignores = ignores;
  if (bans.length > 0) {
    config.rules = {
      ...config.rules,
      "no-restricted-imports": ["error", { patterns: bans.map((b) => ({ regex: b.regex, message: b.message })) }],
    };
  }
  return config;
}

const appsBan = ban(APPS_SEGMENT, "import-boundary: core/ must not import from apps/.");
const viewBan = ban(VIEW_SEGMENT, "import-boundary: core/model must not import from core/view.");
const modelPackageBans = MODEL_PACKAGES.map((r) =>
  ban(r, "import-boundary: core/model must not depend on three, react, react-dom, or @react-three."),
);

// View_Helpers (core/view/helpers/) may import only zod, ../../model/*, and ./*.
const helpersEscapeBan = ban(
  `^\\.\\.${S}(?!\\.\\.${S}model${S})`,
  "import-boundary: core/view/helpers may leave its folder only into core/model.",
);
const modelDotDotBan = ban(
  `${S}model${S}(?:.*${S})?\\.\\.(?:${S}|$)`,
  "import-boundary: core/view/helpers must not use '..' after model/.",
);
const dotDotAfterDotBan = ban(
  `^\\.${S}(?:.*${S})?\\.\\.(?:${S}|$)`,
  "import-boundary: core/view/helpers must not use '..' after './'.",
);

// Ghost Mansion App files must not import the core/view demo page or any test file.
const demoBan = ban(`core${S}view${S}demo`, "import-boundary: ghost-mansion must not import core/view/demo.");
const testFileBan = ban(`\\.test\\.ts$`, "import-boundary: ghost-mansion must not import a *.test.ts file.");
const moodwalkBan = ban(MOODWALK_SEGMENT, "import-boundary: ghost-mansion must not import from moodwalk.");
// The game model may import only the two schema helpers of core/view.
const modelViewBan = ban(
  `core${S}view${S}(?!helpers${S}(?:settings|theme)-schema\\.ts$)`,
  "import-boundary: the game model may import only settings-schema.ts and theme-schema.ts from core/view.",
);

const TS = "*.{ts,tsx}";

export function boundaryConfigs(): Linter.Config[] {
  return [
    scope("core-model", [`core/model/**/${TS}`], [], [appsBan, viewBan, ...modelPackageBans]),
    scope("core-view", [`core/view/**/${TS}`], [], [appsBan]),
    // appsBan is repeated: a later flat-config entry replaces the rule options of core-view.
    scope(
      "core-view-helpers",
      [`core/view/helpers/**/${TS}`],
      [],
      [appsBan, ...modelPackageBans, helpersEscapeBan, modelDotDotBan, dotDotAfterDotBan],
    ),
    scope("core-other", [`core/**/${TS}`], ["core/model/**", "core/view/**"], [appsBan]),
    scope("app-ghost-mansion", [`apps/ghost-mansion/**/${TS}`], [], [moodwalkBan, demoBan, testFileBan]),
    // Bans are repeated: a later flat-config entry replaces the rule options of app-ghost-mansion.
    scope(
      "app-ghost-mansion-model",
      [`apps/ghost-mansion/model/**/${TS}`],
      [],
      [moodwalkBan, demoBan, testFileBan, ...modelPackageBans, modelViewBan],
    ),
    scope(
      "app-moodwalk",
      [`apps/moodwalk/**/${TS}`],
      [],
      [ban(GHOST_MANSION_SEGMENT, "import-boundary: moodwalk must not import from ghost-mansion.")],
    ),
    scope("apps-other", [`apps/**/${TS}`], ["apps/ghost-mansion/**", "apps/moodwalk/**"], []),
    scope("scripts", [`scripts/**/${TS}`], [], []),
  ];
}
