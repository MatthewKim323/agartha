import { describe, expect, test } from "bun:test";
import { resultToText, sanitizeSchema, toFunctionDeclarations } from "./mc.js";

describe("toFunctionDeclarations", () => {
  test("carries name and description across", () => {
    const [d] = toFunctionDeclarations([
      { name: "chat", description: "Send an in-game chat message.", inputSchema: { properties: { message: {} } } },
    ]);
    expect(d!.name).toBe("chat");
    expect(d!.description).toBe("Send an in-game chat message.");
  });

  test("omits parameters entirely for zero-arg tools", () => {
    // Gemini rejects a parameters object with no properties, so this must be
    // absent rather than an empty object.
    const [d] = toFunctionDeclarations([{ name: "stop", description: "Stop.", inputSchema: { properties: {} } }]);
    expect(d!.parameters).toBeUndefined();
  });

  test("omits parameters when inputSchema is missing entirely", () => {
    expect(toFunctionDeclarations([{ name: "stop" }])[0]!.parameters).toBeUndefined();
  });

  test("passes required through when present", () => {
    const [d] = toFunctionDeclarations([
      { name: "move_to", inputSchema: { properties: { x: {}, y: {}, z: {} }, required: ["x", "y", "z"] } },
    ]);
    expect(d!.parameters!.required).toEqual(["x", "y", "z"]);
  });

  test("omits required when the list is empty", () => {
    const [d] = toFunctionDeclarations([{ name: "t", inputSchema: { properties: { a: {} }, required: [] } }]);
    expect(d!.parameters!.required).toBeUndefined();
  });

  test("synthesizes a description rather than shipping an empty one", () => {
    // An undescribed tool is a tool the model will misuse.
    expect(toFunctionDeclarations([{ name: "set_goal", description: "  " }])[0]!.description).toContain("set_goal");
  });

  test("excludes drain_speech, which belonged to the removed outbox loop", () => {
    const names = toFunctionDeclarations([{ name: "chat" }, { name: "drain_speech" }]).map((d) => d.name);
    expect(names).toEqual(["chat"]);
  });

  test("handles an empty tool list", () => {
    expect(toFunctionDeclarations([])).toEqual([]);
  });
});

describe("resultToText", () => {
  test("joins text blocks", () => {
    expect(resultToText({ content: [{ type: "text", text: "chopped 12 logs" }] })).toBe("chopped 12 logs");
  });

  test("ignores non-text blocks", () => {
    const res = { content: [{ type: "image" }, { type: "text", text: "ok" }] };
    expect(resultToText(res)).toBe("ok");
  });

  test("returns empty for shapes it has never seen, without throwing", () => {
    expect(resultToText(undefined)).toBe("");
    expect(resultToText(null)).toBe("");
    expect(resultToText({})).toBe("");
    expect(resultToText({ content: "nope" })).toBe("");
    expect(resultToText("string")).toBe("");
  });
});

describe("sanitizeSchema", () => {
  test("strips exclusiveMinimum, which closed the session with code 1007", () => {
    const out = sanitizeSchema({ type: "INTEGER", exclusiveMinimum: 0, description: "How many" })!;
    expect(out.exclusiveMinimum).toBeUndefined();
    // The constraint survives as prose rather than being silently lost.
    expect(String(out.description)).toContain("greater than 0");
  });

  test("keeps an existing description when appending a constraint", () => {
    const out = sanitizeSchema({ type: "INTEGER", minimum: 1, description: "Count" })!;
    expect(String(out.description)).toBe("Count (at least 1)");
  });

  test("converts const to a single-value enum", () => {
    expect(sanitizeSchema({ type: "STRING", const: "say" })!.enum).toEqual(["say"]);
  });

  test("recurses into properties", () => {
    const out = sanitizeSchema({
      type: "OBJECT",
      properties: { count: { type: "INTEGER", exclusiveMinimum: 0 } },
    })!;
    expect((out.properties as any).count.exclusiveMinimum).toBeUndefined();
  });

  test("recurses into array items", () => {
    const out = sanitizeSchema({ type: "ARRAY", items: { type: "INTEGER", minimum: 2 } })!;
    expect((out.items as any).minimum).toBeUndefined();
  });

  test("sanitizes every anyOf branch", () => {
    const out = sanitizeSchema({
      anyOf: [
        { type: "OBJECT", properties: { kind: { type: "STRING", const: "say" } } },
        { type: "OBJECT", properties: { n: { type: "INTEGER", exclusiveMinimum: 0 } } },
      ],
    })!;
    const branches = out.anyOf as any[];
    expect(branches).toHaveLength(2);
    expect(branches[0].properties.kind.enum).toEqual(["say"]);
    expect(branches[1].properties.n.exclusiveMinimum).toBeUndefined();
  });

  test("inlines a single surviving anyOf branch", () => {
    const out = sanitizeSchema({ anyOf: [{ type: "STRING" }] })!;
    expect(out.anyOf).toBeUndefined();
    expect(out.type).toBe("STRING");
  });

  test("keeps an unparseable property permissively instead of dropping it", () => {
    // Dropping it would remove the model's ability to pass that argument.
    const out = sanitizeSchema({
      type: "OBJECT",
      properties: { good: { type: "STRING" }, weird: { notASchema: true } },
      required: ["good", "weird"],
    })!;
    expect((out.properties as any).weird).toEqual({ type: "STRING" });
    expect(out.required).toEqual(["good", "weird"]);
  });

  test("returns undefined for an object with no usable properties", () => {
    // Gemini rejects an empty parameters object, so callers must omit it.
    expect(sanitizeSchema({ type: "OBJECT", properties: {} })).toBeUndefined();
  });

  test("returns undefined for non-schema input rather than throwing", () => {
    expect(sanitizeSchema(null)).toBeUndefined();
    expect(sanitizeSchema("nope")).toBeUndefined();
    expect(sanitizeSchema([1, 2])).toBeUndefined();
  });

  test("preserves the keys Gemini does accept", () => {
    const out = sanitizeSchema({
      type: "STRING",
      description: "a thing",
      enum: ["a", "b"],
      nullable: true,
      format: "date-time",
    })!;
    expect(out).toEqual({ type: "STRING", description: "a thing", enum: ["a", "b"], nullable: true, format: "date-time" });
  });
});
