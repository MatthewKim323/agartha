import type { InventoryItem } from "@agartha/shared";

/**
 * What a block actually gives you when you break it.
 *
 * Needed because "get me 32 iron" is a goal about INVENTORY, not about blocks.
 * Mining 32 `iron_ore` yields 32 `raw_iron`, so a loop that counts `iron_ore`
 * in the inventory counts zero forever and mines until it hits its iteration
 * cap. Every quantity-goal skill has to translate block → drop.
 */
const DROPS: Record<string, string> = {
  iron_ore: "raw_iron",
  deepslate_iron_ore: "raw_iron",
  gold_ore: "raw_gold",
  deepslate_gold_ore: "raw_gold",
  nether_gold_ore: "gold_nugget",
  copper_ore: "raw_copper",
  deepslate_copper_ore: "raw_copper",
  coal_ore: "coal",
  deepslate_coal_ore: "coal",
  diamond_ore: "diamond",
  deepslate_diamond_ore: "diamond",
  emerald_ore: "emerald",
  deepslate_emerald_ore: "emerald",
  lapis_ore: "lapis_lazuli",
  deepslate_lapis_ore: "lapis_lazuli",
  redstone_ore: "redstone",
  deepslate_redstone_ore: "redstone",
  nether_quartz_ore: "quartz",
  stone: "cobblestone",
  deepslate: "cobbled_deepslate",
  grass_block: "dirt",
};

/** The item name a block drops. Identity for logs, planks, ancient_debris, etc. */
export function dropOf(blockName: string): string {
  return DROPS[blockName] ?? blockName;
}

/**
 * Friendly resource words → the block to go find. Lets "get me some iron" work
 * without the model knowing that the block is `iron_ore` and the drop is
 * `raw_iron`, which is exactly the kind of detail it gets wrong over voice.
 */
const RESOURCE_BLOCKS: Record<string, string> = {
  iron: "iron_ore",
  gold: "gold_ore",
  copper: "copper_ore",
  coal: "coal_ore",
  diamond: "diamond_ore",
  diamonds: "diamond_ore",
  emerald: "emerald_ore",
  lapis: "lapis_ore",
  redstone: "redstone_ore",
  quartz: "nether_quartz_ore",
  wood: "any_log",
  log: "any_log",
  logs: "any_log",
  stone: "any_stone",
  cobble: "any_stone",
  cobblestone: "any_stone",
  ore: "any_ore",
  ores: "any_ore",
};

/** Normalize whatever the model said into a block name findBlocks understands. */
export function resolveResource(input: string): string {
  const s = input.toLowerCase().trim().replace(/\s+/g, "_");
  return RESOURCE_BLOCKS[s] ?? s;
}

/** How many of `item` are in the inventory right now. */
export function countItem(inv: InventoryItem[], item: string): number {
  let n = 0;
  for (const i of inv) if (i.name === item) n += i.count;
  return n;
}

/**
 * Total count of anything that could satisfy a resource goal. `any_ore` and
 * friends resolve to a group, so a goal of "32 ore" can't count a single item
 * name — it counts everything the group could have dropped.
 */
export function countResource(inv: InventoryItem[], block: string): number {
  if (block === "any_log") return inv.filter((i) => /_log$/.test(i.name)).reduce((a, i) => a + i.count, 0);
  if (block === "any_stone") return countItem(inv, "cobblestone") + countItem(inv, "cobbled_deepslate");
  if (block === "any_ore") {
    const ores = new Set(Object.values(DROPS));
    return inv.filter((i) => ores.has(i.name)).reduce((a, i) => a + i.count, 0);
  }
  return countItem(inv, dropOf(block));
}
