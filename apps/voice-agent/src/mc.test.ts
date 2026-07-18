import { describe, expect, test } from "bun:test";
import { resultToText, toFunctionDeclarations } from "./mc.js";

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
