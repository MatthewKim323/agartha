import { z } from "zod";
import { SKILL_NAMES } from "./skills.js";

/**
 * Zod schemas for MCP tool inputs. The MCP server uses these both for
 * runtime validation and to advertise JSON Schema to the voice agent.
 * Keep names + descriptions tool-call friendly — Claude reads them.
 */

export const Vec3Schema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
});

export const MoveToInput = z.object({
  target: Vec3Schema.describe("World coordinate to move toward"),
  range: z.number().optional().describe("Stop when within this many blocks (default 1)"),
  sprint: z.boolean().optional().describe("Sprint there (default false)"),
});

export const MineBlockInput = z.object({
  pos: Vec3Schema.describe("Coordinate of the block to mine"),
});

export const PlaceBlockInput = z.object({
  pos: Vec3Schema.describe("Coordinate to place the block at"),
  item: z.string().describe("Inventory item name to place, e.g. 'cobblestone'"),
});

export const DropItemInput = z.object({
  name: z.string().describe("Item to drop, e.g. 'iron_ingot'"),
  count: z.number().int().positive().optional().describe("How many (default all)"),
});

export const EquipInput = z.object({
  name: z.string().describe("Item to equip, e.g. 'diamond_sword'"),
  destination: z
    .enum(["hand", "head", "torso", "legs", "feet", "off-hand"])
    .optional()
    .describe("Where to equip it (default hand)"),
});

export const ChatInput = z.object({
  message: z.string().describe("Message to send in Minecraft chat"),
});

/**
 * `name` is an ENUM, not a string. See skills.ts — a free-form name let the
 * model invent plausible-sounding skills that didn't exist ("mine_ore",
 * "get_wood"), which failed only after it had already promised out loud to do
 * the thing. The enum reaches Gemini intact through sanitizeSchema.
 */
export const RunSkillInput = z.object({
  name: z.enum(SKILL_NAMES).describe("Which skill to run. Must be one of the listed names."),
  args: z.record(z.unknown()).optional().describe("Skill-specific arguments"),
});

// ── Perception (M1) ──

export const FindBlocksInput = z.object({
  name: z
    .string()
    .describe(
      "Block to find: concrete ('oak_log','diamond_ore','crafting_table') or a group alias ('any_log','any_ore','any_wood','any_stone','any_chest').",
    ),
  maxDistance: z.number().optional().describe("Search radius in blocks (default 32, max 64)"),
  count: z.number().int().positive().optional().describe("Max results to return (default 8)"),
});

export const LookDetectInput = z.object({
  player: z.string().optional().describe("Whose gaze to read (default the owner)"),
  maxDistance: z.number().optional().describe("Max ray distance in blocks (default 6)"),
});

export const NearbyNotableInput = z.object({
  maxDistance: z.number().optional().describe("Scan radius in blocks (default 24)"),
});

// ── Crafting + building (M2) ──

export const CraftItemInput = z.object({
  item: z.string().describe("Item to craft, e.g. 'crafting_table','stick','oak_planks','chest'"),
  count: z.number().int().positive().optional().describe("How many to craft (default 1)"),
});

export const PlacementSpecInput = z.object({
  placements: z
    .array(z.object({ pos: Vec3Schema, item: z.string() }))
    .min(1)
    .describe("Blocks to place: list of { pos, item }"),
});

/**
 * A structure described by SHAPE rather than by coordinates. A 7x7 hut is ~180
 * placements; a voice model is not going to emit 180 correct coordinates, so it
 * describes what it wants and the geometry layer expands it.
 */
export const BuildInput = z.object({
  shape: z
    .enum(["floor", "wall", "box", "room", "pillar", "roof"])
    .describe(
      "What to build. 'room' is a complete little house (floor, 4 walls, roof, doorway) — use it for " +
        "'build me a house/shelter/hut'. 'box' is hollow walls with no floor or roof. 'floor' is a flat " +
        "platform. 'wall' is a single straight wall. 'pillar' is a 1-wide column. 'roof' is a cap.",
    ),
  material: z
    .string()
    .optional()
    .describe("Block to build from, e.g. 'oak_planks', 'cobblestone'. Defaults to the best building block in inventory."),
  origin: Vec3Schema.optional().describe(
    "Minimum corner (lowest x/y/z). Defaults to just in front of the bot.",
  ),
  width: z.number().int().positive().optional().describe("X extent, 1-32 (default 5)"),
  length: z.number().int().positive().optional().describe("Z extent, 1-32 (default 5)"),
  height: z.number().int().positive().optional().describe("Y extent / wall height, 1-32 (default 3)"),
  roofStyle: z.enum(["flat", "gable"]).optional().describe("Roof shape (default flat)"),
  door: z.boolean().optional().describe("For 'room': leave a doorway (default true)"),
  axis: z.enum(["x", "z"]).optional().describe("For 'wall': which way it runs (default x)"),
});

export type MoveToInputT = z.infer<typeof MoveToInput>;
export type MineBlockInputT = z.infer<typeof MineBlockInput>;
export type PlaceBlockInputT = z.infer<typeof PlaceBlockInput>;
export type DropItemInputT = z.infer<typeof DropItemInput>;
export type EquipInputT = z.infer<typeof EquipInput>;
export type ChatInputT = z.infer<typeof ChatInput>;
export type RunSkillInputT = z.infer<typeof RunSkillInput>;
export type FindBlocksInputT = z.infer<typeof FindBlocksInput>;
export type LookDetectInputT = z.infer<typeof LookDetectInput>;
export type NearbyNotableInputT = z.infer<typeof NearbyNotableInput>;
export type CraftItemInputT = z.infer<typeof CraftItemInput>;
export type PlacementSpecInputT = z.infer<typeof PlacementSpecInput>;
export type BuildInputT = z.infer<typeof BuildInput>;

// ── World memory (M3) ──

export const RememberLocationInput = z.object({
  name: z.string().describe("Short stable name, e.g. 'home_base' or 'ore_chest'"),
  pos: Vec3Schema.optional().describe("Coords; defaults to the bot's current position"),
  kind: z
    .enum(["base", "chest", "poi", "spawn", "portal"])
    .optional()
    .describe("Category (default 'poi')"),
  note: z.string().optional().describe("Freeform note about this place"),
});

export const RecallLocationsInput = z.object({
  kind: z.string().optional().describe("Filter by category"),
  near: Vec3Schema.optional().describe("Sort results by distance to this coord"),
  limit: z.number().int().positive().optional().describe("Max results (default 20)"),
});

export const IndexChestInput = z.object({
  pos: Vec3Schema.describe("Coords of the chest block to scan + remember"),
  label: z.string().optional().describe("Optional human name for the chest"),
});

export const ForgetLocationInput = z.object({
  name: z.string().describe("Name of the waypoint to forget"),
});

export type RememberLocationInputT = z.infer<typeof RememberLocationInput>;
export type RecallLocationsInputT = z.infer<typeof RecallLocationsInput>;
export type IndexChestInputT = z.infer<typeof IndexChestInput>;
export type ForgetLocationInputT = z.infer<typeof ForgetLocationInput>;

// ── Goals / intents (M4) ──

export const BotIntentSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("say"), text: z.string().describe("Line to say in MC chat") }),
  z.object({
    kind: z.literal("skill"),
    name: z.string().describe("Skill to run, e.g. 'chop_tree'"),
    args: z.record(z.unknown()).optional().describe("Skill-specific args"),
  }),
  z.object({ kind: z.literal("follow"), range: z.number().optional().describe("Follow distance in blocks") }),
  z.object({ kind: z.literal("stop") }),
]);

export const SetGoalInput = z.object({
  intent: BotIntentSchema.describe("What to pursue: run a skill, follow, say a line, or stop"),
  label: z.string().describe("Short human-readable summary of the goal, e.g. 'get wood'"),
});

export type SetGoalInputT = z.infer<typeof SetGoalInput>;

// ── Voice (jabby → spoken in the Discord call) ──

export const SpeakInput = z.object({
  text: z.string().describe("Short, casual, lowercase line to say OUT LOUD in the voice call (different from in-game chat)."),
});

export type SpeakInputT = z.infer<typeof SpeakInput>;
