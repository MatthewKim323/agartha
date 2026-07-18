import type { ToolResult } from "@agartha/shared";

/**
 * MCP tool handlers must return `{ content: [...] }`. These wrappers keep a
 * consistent shape: a human-readable text line plus a structured payload so
 * Claude can both read the result and parse it.
 */
type McpToolReturn = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

function envelope(result: ToolResult): McpToolReturn {
  return {
    content: [{ type: "text", text: JSON.stringify(result) }],
    isError: !result.ok,
  };
}

export function ok(message: string, data?: unknown): McpToolReturn {
  return envelope({ ok: true, message, data });
}

export function fail(message: string, data?: unknown): McpToolReturn {
  return envelope({ ok: false, message, data });
}
