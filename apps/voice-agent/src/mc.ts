import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

/**
 * The bridge from the voice model's function calls to the bot's MCP tools.
 *
 * This is the change the whole project exists for. The predecessor routed
 * voice -> transcript -> spawn(`claude -p ...`) -> that process connects to MCP
 * -> tool call, paying a full agent cold start on every single reaction, behind
 * a 10s cooldown that dropped anything arriving too soon.
 *
 * Here the connection is persistent and the model's function call lands on the
 * bot directly. Localhost MCP is single-digit milliseconds, which is noise
 * against a 400ms speech budget, so the clean BotControl seam survives at
 * effectively no cost.
 */

/** Gemini's function-declaration shape, kept structural to avoid SDK coupling. */
export interface FunctionDeclaration {
  name: string;
  description: string;
  parameters?: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpTool {
  name: string;
  description?: string;
  inputSchema?: {
    type?: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

/**
 * Tools the voice model should NOT be handed.
 *
 * `drain_speech` belonged to the old outbox polling loop, which this design
 * removes: the model speaks directly, so exposing it would let it read its own
 * outbound queue back to itself.
 */
const EXCLUDED = new Set(["drain_speech"]);

/**
 * Convert MCP tool definitions to Gemini function declarations.
 *
 * Gemini rejects a declaration whose parameters object has no properties, so
 * zero-arg tools must omit `parameters` entirely rather than sending an empty
 * object. That distinction is the reason this is a tested pure function.
 */
export function toFunctionDeclarations(tools: McpTool[]): FunctionDeclaration[] {
  return tools
    .filter((t) => !EXCLUDED.has(t.name))
    .map((t) => {
      const props = t.inputSchema?.properties ?? {};
      const decl: FunctionDeclaration = {
        name: t.name,
        // A tool with no description is a tool the model will misuse.
        description: t.description?.trim() || `Call the ${t.name} tool.`,
      };
      if (Object.keys(props).length > 0) {
        decl.parameters = {
          type: "object",
          properties: props,
          ...(t.inputSchema?.required?.length ? { required: t.inputSchema.required } : {}),
        };
      }
      return decl;
    });
}

/** Flatten an MCP tool result to the short string a voice model can use. */
export function resultToText(res: unknown): string {
  if (res === null || typeof res !== "object") return "";
  const content = (res as { content?: unknown }).content;
  if (!Array.isArray(content)) return "";
  return content
    .map((c) => c as { type?: string; text?: string })
    .filter((c) => c.type === "text" && typeof c.text === "string")
    .map((c) => c.text!)
    .join(" ")
    .trim();
}

export class McClient {
  private client: Client | null = null;
  private tools: FunctionDeclaration[] = [];

  constructor(
    private readonly url: string,
    private readonly token?: string,
  ) {}

  get connected(): boolean {
    return this.client !== null;
  }

  /** Declarations discovered at connect. Static for the session's lifetime. */
  get functionDeclarations(): FunctionDeclaration[] {
    return this.tools;
  }

  async connect(): Promise<void> {
    const client = new Client({ name: "agartha-voice", version: "0.0.0" }, { capabilities: {} });
    const transport = new StreamableHTTPClientTransport(new URL(this.url), {
      requestInit: this.token ? { headers: { authorization: `Bearer ${this.token}` } } : undefined,
    });
    await client.connect(transport);
    this.client = client;

    const listed = await client.listTools();
    this.tools = toFunctionDeclarations(listed.tools as McpTool[]);
  }

  /**
   * Dispatch a function call. Returns a string for the model either way: a tool
   * failure is information it should speak about, not an exception that kills
   * the turn.
   */
  async call(name: string, args: Record<string, unknown>): Promise<string> {
    if (!this.client) return "the bot isn't connected right now";
    try {
      const res = await this.client.callTool({ name, arguments: args });
      return resultToText(res) || "done";
    } catch (e) {
      return `that failed: ${(e as Error).message}`;
    }
  }

  async close(): Promise<void> {
    const c = this.client;
    this.client = null;
    await c?.close().catch(() => {});
  }
}
