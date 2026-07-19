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
 * Gemini's Schema is a SUBSET of JSON Schema, and it rejects the whole session
 * (websocket close 1007) if any declaration contains a keyword it doesn't know.
 * One bad tool kills all 22.
 *
 * Zod emits several such keywords. Observed rejections: `exclusiveMinimum`,
 * `const`, and `anyOf` branches carrying them.
 *
 * Rather than silently dropping constraints, we fold them into the description,
 * so the model still learns "count must be at least 1" even though it can no
 * longer be expressed structurally.
 */
const SCHEMA_KEYS = new Set([
  "type",
  "format",
  "description",
  "nullable",
  "enum",
  "items",
  "properties",
  "required",
  "anyOf",
]);

/** Numeric/string constraints Gemini drops, rendered into prose instead. */
function constraintNote(schema: Record<string, unknown>): string {
  const bits: string[] = [];
  const n = (v: unknown) => (typeof v === "number" ? v : undefined);
  const exMin = n(schema.exclusiveMinimum);
  const exMax = n(schema.exclusiveMaximum);
  const min = n(schema.minimum);
  const max = n(schema.maximum);
  if (exMin !== undefined) bits.push(`greater than ${exMin}`);
  if (min !== undefined) bits.push(`at least ${min}`);
  if (exMax !== undefined) bits.push(`less than ${exMax}`);
  if (max !== undefined) bits.push(`at most ${max}`);
  if (typeof schema.minLength === "number") bits.push(`min length ${schema.minLength}`);
  return bits.join(", ");
}

/**
 * Recursively narrow a JSON Schema to what Gemini accepts.
 *
 * Returns undefined for a schema that reduces to nothing, so callers can omit
 * the field rather than send an empty object (which Gemini also rejects).
 */
export function sanitizeSchema(input: unknown): Record<string, unknown> | undefined {
  if (input === null || typeof input !== "object" || Array.isArray(input)) return undefined;
  const schema = input as Record<string, unknown>;
  const out: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(schema)) {
    if (!SCHEMA_KEYS.has(key)) continue;

    if (key === "properties" && value && typeof value === "object") {
      const props: Record<string, unknown> = {};
      for (const [name, sub] of Object.entries(value as Record<string, unknown>)) {
        // Dropping a property removes the model's ability to pass that argument
        // at all, which is worse than typing it loosely. If nothing survives
        // sanitizing, keep the name with a permissive string type.
        props[name] = sanitizeSchema(sub) ?? { type: "STRING" };
      }
      if (Object.keys(props).length > 0) out.properties = props;
      continue;
    }

    if (key === "items") {
      const cleaned = sanitizeSchema(value);
      if (cleaned) out.items = cleaned;
      continue;
    }

    if (key === "anyOf" && Array.isArray(value)) {
      const branches = value.map(sanitizeSchema).filter((b): b is Record<string, unknown> => b !== undefined);
      // A single surviving branch is better expressed inline than as a
      // one-element union.
      if (branches.length === 1) Object.assign(out, branches[0]);
      else if (branches.length > 1) out.anyOf = branches;
      continue;
    }

    out[key] = value;
  }

  // `const` has no Gemini equivalent; a single-value enum says the same thing.
  if (schema.const !== undefined && out.enum === undefined) out.enum = [schema.const];

  const note = constraintNote(schema);
  if (note) {
    const existing = typeof out.description === "string" ? out.description : "";
    out.description = existing ? `${existing} (${note})` : note;
  }

  // Gemini requires `required` entries to exist in `properties`; a stale name
  // left behind by pruning would be rejected.
  if (Array.isArray(out.required)) {
    const props = (out.properties ?? {}) as Record<string, unknown>;
    const kept = (out.required as unknown[]).filter((r) => typeof r === "string" && r in props);
    if (kept.length > 0) out.required = kept;
    else delete out.required;
  }

  // An object with no properties is meaningless to Gemini and rejected.
  if (out.type === "OBJECT" || out.type === "object") {
    if (!out.properties && !out.anyOf) return undefined;
  }

  return Object.keys(out).length > 0 ? out : undefined;
}

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
      const decl: FunctionDeclaration = {
        name: t.name,
        // A tool with no description is a tool the model will misuse.
        description: t.description?.trim() || `Call the ${t.name} tool.`,
      };

      const cleaned = sanitizeSchema({
        type: "object",
        properties: t.inputSchema?.properties ?? {},
        ...(t.inputSchema?.required?.length ? { required: t.inputSchema.required } : {}),
      });
      if (cleaned) {
        decl.parameters = cleaned as FunctionDeclaration["parameters"];
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
