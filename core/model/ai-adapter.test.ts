import { afterEach, describe, expect, it, vi } from "vitest";
import { createNoAiAdapter, type AIAdapter } from "./ai-adapter.ts";
import type { ExplanationTable } from "./rule-schema.ts";

function build(table: unknown): AIAdapter {
  const made = createNoAiAdapter(table as ExplanationTable);
  if (!made.ok) throw new Error(`adapter not created: ${JSON.stringify(made.errors)}`);
  return made.value;
}

const table = (): ExplanationTable => ({
  t1: { en: "text one", ja: "テキスト一" },
  t2: { en: "text two", ja: "テキスト二" },
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createNoAiAdapter: answers (R-RULES-15.2, 15.3)", () => {
  it("returns the stored text for a matching topic", async () => {
    const adapter = build(table());
    await expect(adapter.explain({ topic: "t1" })).resolves.toEqual({ en: "text one", ja: "テキスト一" });
  });

  it("resolves null for a missing topic", async () => {
    const adapter = build(table());
    await expect(adapter.explain({ topic: "t3" })).resolves.toBeNull();
    await expect(adapter.explain({ topic: "constructor" })).resolves.toBeNull();
  });

  it("resolves null for a blank or invalid topic without rejecting", async () => {
    const adapter = build(table());
    await expect(adapter.explain({ topic: "" })).resolves.toBeNull();
    await expect(adapter.explain({ topic: "  " })).resolves.toBeNull();
    await expect(adapter.explain({ topic: 5 } as never)).resolves.toBeNull();
    await expect(adapter.explain(null as never)).resolves.toBeNull();
    await expect(adapter.explain(undefined as never)).resolves.toBeNull();
  });
});

describe("createNoAiAdapter: repeatable answers, no network (R-RULES-15.4)", () => {
  it("gives deeply equal answers after other requests", async () => {
    const adapter = build(table());
    const first = await adapter.explain({ topic: "t1" });
    await adapter.explain({ topic: "t2" });
    await adapter.explain({ topic: "missing" });
    await adapter.explain({ topic: "" });
    expect(await adapter.explain({ topic: "t1" })).toEqual(first);
  });

  it("is not affected by changing a returned object", async () => {
    const adapter = build(table());
    const first = await adapter.explain({ topic: "t1" });
    expect(first).not.toBeNull();
    (first as { en: string }).en = "changed";
    expect(await adapter.explain({ topic: "t1" })).toEqual({ en: "text one", ja: "テキスト一" });
  });

  it("is not affected by a later change to the caller's table", async () => {
    const source = table();
    const adapter = build(source);
    source.t1.en = "changed";
    delete (source as Record<string, unknown>).t2;
    source.t3 = { en: "new", ja: "新" };
    expect(await adapter.explain({ topic: "t1" })).toEqual({ en: "text one", ja: "テキスト一" });
    expect(await adapter.explain({ topic: "t2" })).toEqual({ en: "text two", ja: "テキスト二" });
    expect(await adapter.explain({ topic: "t3" })).toBeNull();
  });

  it("makes no network request", async () => {
    const fetchStub = vi.fn(() => {
      throw new Error("fetch must not be called");
    });
    vi.stubGlobal("fetch", fetchStub);
    const adapter = build(table());
    await adapter.explain({ topic: "t1" });
    await adapter.explain({ topic: "missing" });
    await adapter.explain({ topic: 1 } as never);
    expect(fetchStub).not.toHaveBeenCalled();
  });

  it("finds a key named __proto__ as an ordinary key", async () => {
    const parsed: unknown = JSON.parse('{"__proto__": {"en": "p", "ja": "ぷ"}, "t1": {"en": "a", "ja": "あ"}}');
    const adapter = build(parsed);
    await expect(adapter.explain({ topic: "__proto__" })).resolves.toEqual({ en: "p", ja: "ぷ" });
    await expect(adapter.explain({ topic: "t1" })).resolves.toEqual({ en: "a", ja: "あ" });
  });
});

describe("createNoAiAdapter: creation errors (R-RULES-15.6)", () => {
  it("gives path `table.` for a blank key", () => {
    const made = createNoAiAdapter({ "": { en: "a", ja: "b" } });
    expect(made.ok).toBe(false);
    if (!made.ok) expect(made.errors.map((e) => e.path)).toEqual(["table."]);
  });

  it("gives path `table` for a non-object table", () => {
    for (const bad of [null, 1, "x", [], undefined]) {
      const made = createNoAiAdapter(bad as never);
      expect(made.ok).toBe(false);
      if (!made.ok) expect(made.errors.map((e) => e.path)).toEqual(["table"]);
    }
  });

  it("gives one error at `table.<key>` per bad entry", () => {
    const made = createNoAiAdapter({
      t1: { ja: "b" },
      t2: { en: "a", ja: "b" },
      t3: "text",
    } as never);
    expect(made.ok).toBe(false);
    if (!made.ok) expect(made.errors.map((e) => e.path)).toEqual(["table.t1", "table.t3"]);
  });
});
