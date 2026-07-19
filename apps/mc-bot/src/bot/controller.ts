import type { Bot } from "mineflayer";
import { goals } from "mineflayer-pathfinder";
import { Vec3 } from "vec3";
import type {
  BlockQuery,
  BotControl,
  EntityInfo,
  GameState,
  LookedAtBlock,
  NotableBlock,
  Vec3Lit,
} from "@agartha/shared";
import type { Config } from "../config.js";
import { extractGameState } from "../state/extract.js";
import { isHostile, matchesTarget, type ClassifiableEntity } from "../state/entities.js";
import { logger } from "../util/logger.js";

const log = logger("controller");

const round = (n: number) => Math.round(n * 100) / 100;
const toLit = (v: { x: number; y: number; z: number }): Vec3Lit => ({
  x: round(v.x),
  y: round(v.y),
  z: round(v.z),
});

/** Block names treated as the "any_stone" group. */
const STONE_NAMES = new Set([
  "stone", "cobblestone", "deepslate", "cobbled_deepslate", "andesite",
  "diorite", "granite", "tuff", "calcite", "blackstone", "basalt", "netherrack",
]);

/**
 * Concrete BotControl over a live Mineflayer bot. This is the ONE place that
 * touches Mineflayer's action APIs. Skills and MCP tools both go through here,
 * so behavior (and safety) stays consistent.
 */
export class BotController implements BotControl {
  /** Cache of friendly-name → block ids (the registry is static per session). */
  private blockIdCache = new Map<string, number[]>();

  constructor(
    private bot: Bot,
    private readonly cfg: Config,
  ) {}

  /**
   * Re-point this controller at a fresh Mineflayer connection after a
   * reconnect. Keeps the same controller instance (already injected into the
   * MCP server) so the brain's session survives the body swapping out.
   */
  rebind(bot: Bot): void {
    this.bot = bot;
    this.blockIdCache.clear();
  }

  // ── Smart item usage ──────────────────────────────────────────────────────

  /** Equip the fastest tool in inventory for breaking this block (axe for wood,
   * pickaxe for ore/stone, shovel for dirt). No-op if already holding it. */
  private async equipBestToolFor(block: Parameters<Bot["dig"]>[0]): Promise<void> {
    const tool = this.bot.pathfinder.bestHarvestTool(block);
    if (tool && this.bot.heldItem?.type !== tool.type) {
      await this.bot.equip(tool, "hand").catch(() => {});
    }
  }

  /** Equip the best melee weapon (sword > axe). No-op if already holding one,
   * so combat loops don't re-equip every swing. */
  private async equipBestWeapon(): Promise<void> {
    const held = this.bot.heldItem?.name ?? "";
    if (/_sword$|_axe$/.test(held)) return; // already armed
    const rank = (name: string): number => {
      const order = [
        "netherite_sword", "diamond_sword", "iron_sword", "stone_sword",
        "golden_sword", "wooden_sword", "netherite_axe", "diamond_axe",
        "iron_axe", "stone_axe", "golden_axe", "wooden_axe",
      ];
      const i = order.indexOf(name);
      return i === -1 ? -1 : order.length - i;
    };
    let best: ReturnType<Bot["inventory"]["items"]>[number] | null = null;
    let bestRank = 0;
    for (const it of this.bot.inventory.items()) {
      const r = rank(it.name);
      if (r > bestRank) {
        best = it;
        bestRank = r;
      }
    }
    if (best) await this.bot.equip(best, "hand").catch(() => {});
  }

  async moveTo(target: Vec3Lit, opts?: { range?: number; sprint?: boolean }): Promise<void> {
    const range = opts?.range ?? 1;
    const here = this.bot.entity.position;
    const dist = here.distanceTo(new Vec3(target.x, target.y, target.z));

    // Long-haul fallback: teleport instead of pathing across the world.
    if (dist > this.cfg.tuning.teleportFallbackDistance) {
      log.debug(`dist ${dist.toFixed(1)} > fallback, teleporting`);
      return this.teleportTo(target);
    }

    const goal = new goals.GoalNear(target.x, target.y, target.z, range);
    await this.bot.pathfinder.goto(goal);
  }

  async teleportTo(target: Vec3Lit): Promise<void> {
    // Requires op. If the bot isn't op this is a no-op the server rejects;
    // the slow loop should know whether teleport is available.
    this.bot.chat(`/tp ${this.bot.username} ${target.x} ${target.y} ${target.z}`);
  }

  async lookAt(target: Vec3Lit): Promise<void> {
    await this.bot.lookAt(new Vec3(target.x, target.y + 1.6, target.z), true);
  }

  async mineBlock(pos: Vec3Lit): Promise<void> {
    const block = this.bot.blockAt(new Vec3(pos.x, pos.y, pos.z));
    if (!block) throw new Error("no block at that position");
    await this.equipBestToolFor(block);
    await this.bot.dig(block);
  }

  async placeBlock(pos: Vec3Lit, item: string): Promise<void> {
    const ref = this.bot.blockAt(new Vec3(pos.x, pos.y - 1, pos.z));
    if (!ref) throw new Error("no reference block to place against");
    await this.equip(item);
    await this.bot.placeBlock(ref, new Vec3(0, 1, 0));
  }

  async dropItem(name: string, count?: number): Promise<void> {
    const item = this.bot.inventory.items().find((i) => i.name === name);
    if (!item) throw new Error(`no ${name} in inventory`);
    await this.bot.toss(item.type, null, count ?? item.count);
  }

  async equip(name: string, destination: "hand" | "head" | "torso" | "legs" | "feet" | "off-hand" = "hand"): Promise<void> {
    const item = this.bot.inventory.items().find((i) => i.name === name);
    if (!item) throw new Error(`no ${name} to equip`);
    await this.bot.equip(item, destination);
  }

  async attack(entityId: number): Promise<void> {
    const entity = this.bot.entities[entityId];
    if (!entity) throw new Error("entity gone");

    // Last line of defence. Targeting already excludes the owner, but attack()
    // is reachable directly over MCP with an arbitrary id, so it re-checks.
    if ((entity as { username?: string }).username === this.cfg.mc.ownerUsername) {
      throw new Error("refusing to attack the owner");
    }

    await this.equipBestWeapon();

    // The server validates a hit against where our head is actually pointing,
    // so a swing without this looks like a hit client-side and does nothing.
    const height = (entity as { height?: number }).height ?? 1.6;
    await this.bot.lookAt(entity.position.offset(0, height * 0.5, 0), true);

    // Vanilla entity interaction range is 3 blocks. Swinging from further is a
    // silent no-op, so fail loudly and let the caller path in instead.
    const dist = this.bot.entity.position.distanceTo(entity.position);
    if (dist > 3.5) throw new Error(`too far to hit (${dist.toFixed(1)} blocks)`);

    this.bot.attack(entity);
  }

  async chat(message: string): Promise<void> {
    this.bot.chat(message);
  }

  getState(): GameState {
    return extractGameState(this.bot, this.cfg.mc.ownerUsername);
  }

  stop(): void {
    this.bot.pathfinder.stop();
    this.bot.clearControlStates();
  }

  // ── Perception ───────────────────────────────────────────────────────────

  async findBlocks(query: BlockQuery): Promise<Vec3Lit[]> {
    const ids = this.resolveBlockIds(query.name);
    if (ids.length === 0) return [];
    const found = this.bot.findBlocks({
      matching: ids,
      maxDistance: Math.min(query.maxDistance ?? 32, 64),
      count: query.count ?? 8,
      point: this.bot.entity.position,
    });
    return found.map(toLit);
  }

  async lookingAt(opts?: { player?: string; maxDistance?: number }): Promise<LookedAtBlock | null> {
    const username = opts?.player ?? this.cfg.mc.ownerUsername;
    const ent = this.bot.players[username]?.entity;
    if (!ent) return null;
    const block = this.bot.blockAtEntityCursor(ent, opts?.maxDistance ?? 6);
    if (!block || block.name === "air") return null;
    return { name: block.name, pos: toLit(block.position) };
  }

  async nearbyNotable(maxDistance = 24): Promise<NotableBlock[]> {
    const cats: Array<[string, NotableBlock["category"]]> = [
      ["any_log", "log"],
      ["any_ore", "ore"],
      ["water", "water"],
      ["any_chest", "chest"],
    ];
    const here = this.bot.entity.position;
    const out: NotableBlock[] = [];
    for (const [query, category] of cats) {
      const ids = this.resolveBlockIds(query);
      if (ids.length === 0) continue;
      const found = this.bot.findBlocks({ matching: ids, maxDistance, count: 3, point: here });
      for (const v of found) {
        const b = this.bot.blockAt(v);
        out.push({ name: b?.name ?? query, pos: toLit(v), distance: round(here.distanceTo(v)), category });
      }
    }
    return out.sort((a, b) => a.distance - b.distance).slice(0, 8);
  }

  playerHeading(player?: string): Vec3Lit | null {
    const username = player ?? this.cfg.mc.ownerUsername;
    const ent = this.bot.players[username]?.entity;
    if (!ent) return null;
    // Minecraft view direction (matches mineflayer's getViewDirection).
    const yaw = ent.yaw;
    const pitch = ent.pitch;
    const cp = Math.cos(pitch);
    return { x: -Math.sin(yaw) * cp, y: Math.sin(pitch), z: -Math.cos(yaw) * cp };
  }

  // ── Mid-level action primitives ──────────────────────────────────────────

  /** pathfinder.goto with a hard time cap so a stuck path can't hang a skill. */
  private gotoSafe(goal: Parameters<Bot["pathfinder"]["goto"]>[0], ms: number): Promise<void> {
    return new Promise<void>((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        resolve();
      };
      const timer = setTimeout(() => {
        this.bot.pathfinder.stop();
        finish();
      }, ms);
      this.bot.pathfinder
        .goto(goal)
        .then(() => {
          clearTimeout(timer);
          finish();
        })
        .catch(() => {
          clearTimeout(timer);
          finish();
        });
    });
  }

  async digAt(pos: Vec3Lit): Promise<void> {
    const v = new Vec3(pos.x, pos.y, pos.z);
    const block = this.bot.blockAt(v);
    if (!block || block.name === "air") return;
    await this.gotoSafe(new goals.GoalGetToBlock(pos.x, pos.y, pos.z), 8000);
    const reach = this.bot.entity.position.distanceTo(v);
    if (reach > 4.5) return; // couldn't get close enough; skip rather than hang on dig
    const fresh = this.bot.blockAt(v);
    if (!fresh || fresh.name === "air") return;
    await this.equipBestToolFor(fresh);
    await this.bot.dig(fresh);
  }

  async fellTree(near: Vec3Lit): Promise<number> {
    const REACH = 4.4;
    let mined = 0;
    // get to the tree
    await this.gotoSafe(new goals.GoalNear(near.x, near.y, near.z, 2), 8000);

    for (let i = 0; i < 60; i++) {
      const here = this.bot.entity.position;
      // all logs around the original tree (incl. branches), bottom-up
      const logs = this.bot
        .findBlocks({
          matching: this.resolveBlockIds("any_log"),
          maxDistance: 6,
          count: 60,
          point: new Vec3(near.x, near.y, near.z),
        })
        .sort((a, b) => a.y - b.y);
      if (logs.length === 0) break;

      // mine the nearest reachable log straight from where we stand (no pathing
      // up — logs directly overhead are within reach once the base is cleared)
      const reachable = logs
        .filter((v) => here.distanceTo(v) <= REACH)
        .sort((a, b) => here.distanceTo(a) - here.distanceTo(b));
      if (reachable.length > 0) {
        const block = this.bot.blockAt(reachable[0]!);
        if (block && block.name !== "air") {
          await this.equipBestToolFor(block);
          try {
            await this.bot.dig(block);
            mined++;
          } catch {
            /* block changed; re-scan */
          }
        }
        continue;
      }

      // nothing in reach — stand on the ground UNDER the trunk column and mine up
      const col = logs[0]!;
      const before = here.clone();
      await this.gotoSafe(new goals.GoalNear(col.x, near.y, col.z, 1), 6000);
      if (this.bot.entity.position.distanceTo(before) < 0.5) break; // stuck; give up
    }
    return mined;
  }

  async mineStaircase(steps = 12): Promise<number> {
    let mined = 0;
    // cardinal direction the bot is facing (from view yaw), snapped to N/S/E/W
    const yaw = this.bot.entity.yaw;
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    let dx = 0;
    let dz = 0;
    if (Math.abs(fx) >= Math.abs(fz)) dx = fx >= 0 ? 1 : -1;
    else dz = fz >= 0 ? 1 : -1;

    const danger = (b: ReturnType<Bot["blockAt"]>) => !!b && /lava|fire/.test(b.name);
    const undug = (b: ReturnType<Bot["blockAt"]>) => !!b && b.name !== "air" && !/bedrock/.test(b.name);

    for (let i = 0; i < steps; i++) {
      const f = this.bot.entity.position.floored();
      // don't carve toward lava
      if (danger(this.bot.blockAt(f.offset(dx, -1, dz))) || danger(this.bot.blockAt(f.offset(dx, -2, dz)))) break;

      // dig headroom, the forward block, and the step-down (a 1-wide 2-tall stair)
      for (const p of [f.offset(dx, 1, dz), f.offset(dx, 0, dz), f.offset(dx, -1, dz)]) {
        const b = this.bot.blockAt(p);
        if (danger(b)) return mined; // hit lava — bail with what we have
        if (!undug(b)) continue;
        await this.equipBestToolFor(b!);
        try {
          await this.bot.dig(b!);
          mined++;
        } catch {
          /* skip unreachable */
        }
      }
      // walk forward into the freshly-dug step and drop one down (pathfinder is
      // unreliable in a tight 1-wide descending shaft, so drive it manually)
      await this.bot.lookAt(new Vec3(f.x + dx + 0.5, this.bot.entity.position.y, f.z + dz + 0.5), true);
      this.bot.setControlState("forward", true);
      const t0 = Date.now();
      while (Date.now() - t0 < 1800 && this.bot.entity.position.floored().y >= f.y) {
        await this.settle(100);
      }
      this.bot.setControlState("forward", false);
      await this.settle(150);
      if (this.bot.entity.position.floored().y >= f.y) break; // couldn't descend; stop
    }
    this.bot.clearControlStates();
    await this.collectNearbyDrops({ radius: 5 });
    return mined;
  }

  async mineMany(positions: Vec3Lit[]): Promise<number> {
    let mined = 0;
    for (const p of positions) {
      try {
        await this.digAt(p);
        mined++;
      } catch (e) {
        log.debug(`mineMany skip (${p.x},${p.y},${p.z}): ${(e as Error).message}`);
      }
    }
    return mined;
  }

  async collectNearbyDrops(opts?: { radius?: number; timeoutMs?: number }): Promise<number> {
    // Entity-based pickup: walk onto tracked item entities so vanilla pickup
    // fires. NOTE: some servers/protocol versions don't surface item entities
    // in bot.entities; for skills that know where they mined, sweepColumns() is
    // the reliable collector. This stays best-effort for loose loot (combat).
    const radius = opts?.radius ?? 8;
    const timeoutMs = opts?.timeoutMs ?? 8000;
    const start = Date.now();
    let collected = 0;
    let lastId = -1;
    let attempts = 0;
    while (Date.now() - start < timeoutMs) {
      const here = this.bot.entity.position;
      const drop = this.bot.nearestEntity(
        (e) => e.name === "item" && e.position.distanceTo(here) <= radius,
      );
      if (!drop) break;
      if (drop.id === lastId) {
        if (++attempts >= 3) break;
      } else {
        lastId = drop.id;
        attempts = 0;
      }
      await this.gotoSafe(new goals.GoalNear(drop.position.x, drop.position.y, drop.position.z, 0), 4000);
      await new Promise((r) => setTimeout(r, 200));
      if (!this.bot.entities[drop.id]) collected++;
    }
    return collected;
  }

  async sweepColumns(positions: Vec3Lit[]): Promise<void> {
    // Walk the X/Z column of each mined block so vanilla auto-pickup grabs the
    // drops (they fall to the ground beneath where the block was). Works even
    // when item entities aren't tracked.
    const seen = new Set<string>();
    for (const p of positions) {
      const x = Math.floor(p.x);
      const z = Math.floor(p.z);
      const key = `${x},${z}`;
      if (seen.has(key)) continue;
      seen.add(key);
      await this.gotoSafe(new goals.GoalNearXZ(x, z, 1), 4000);
      await new Promise((r) => setTimeout(r, 150));
    }
  }

  async craft(itemName: string, count = 1): Promise<void> {
    const id = this.resolveItemId(itemName);
    if (id == null) throw new Error(`unknown item: ${itemName}`);

    // NOTE: recipesFor's 3rd arg is minResultCount (recipe filter), NOT how many
    // to craft — keep it at 1. `count` is the number of craft operations.
    const inHand = this.bot.recipesFor(id, null, 1, null);
    if (inHand.length > 0) {
      await this.bot.craft(inHand[0]!, count, undefined);
      await this.settle();
      return;
    }

    // prefer a CLOSE table; only use a found one if we can actually get in reach,
    // else place a fresh adjacent one (avoids opening an unreachable far table,
    // which dead-locks on the windowOpen timeout).
    let table = this.bot.findBlock({ matching: this.resolveBlockIds("crafting_table"), maxDistance: 5 });
    if (table) {
      await this.gotoSafe(new goals.GoalNear(table.position.x, table.position.y, table.position.z, 2), 8000);
      if (this.bot.entity.position.distanceTo(table.position) > 4) table = null; // couldn't reach it
    }
    if (!table) table = await this.placeCraftingTable(); // place one if we own it
    if (!table) throw new Error("need a crafting table (none nearby, and none to place)");
    await this.gotoSafe(new goals.GoalNear(table.position.x, table.position.y, table.position.z, 2), 8000);
    // re-fetch a fresh block ref + face it (stale refs / not looking can make the
    // table window silently fail to open)
    const tableBlock = this.bot.blockAt(table.position) ?? table;
    await this.bot.lookAt(tableBlock.position.offset(0.5, 0.5, 0.5), true);
    const withTable = this.bot.recipesFor(id, null, 1, tableBlock);
    if (withTable.length === 0) throw new Error(`can't craft ${itemName} (missing materials)`);
    const had = this.bot.inventory.items().filter((i) => i.name === itemName).reduce((a, i) => a + i.count, 0);
    // Use our own table-window crafting: mineflayer's bot.craft fakes the output
    // slot locally and silently no-ops on MC 1.20.6. We place ingredients, wait
    // for the SERVER's real output, and take it.
    await this.craftAtTable(withTable[0]!, tableBlock, count);
    await this.settle();
    const now = this.bot.inventory.items().filter((i) => i.name === itemName).reduce((a, i) => a + i.count, 0);
    // bot.craft can resolve without actually crafting (table-window quirk on some
    // server/protocol combos) — fail honestly instead of reporting a phantom craft.
    if (now <= had) throw new Error(`craft of ${itemName} didn't take`);
  }

  /** Brief wait so the server's inventory update lands before the next read. */
  private settle(ms = 200): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  /**
   * Craft `count` of a recipe at an (already-reachable) crafting table by driving
   * the window directly: open it, lay the ingredients into the 3x3 grid, wait for
   * the SERVER to populate the output slot, and shift-click it out. This replaces
   * mineflayer's bot.craft for table recipes, which fakes the output locally and
   * silently produces nothing on MC 1.20.6.
   */
  private async craftAtTable(recipe: ReturnType<Bot["recipesFor"]>[number], tableBlock: { position: Vec3 }, count: number): Promise<void> {
    // open the table window (listener registered before activateBlock to avoid a race)
    const opened = new Promise<{ slots: Array<{ type: number; metadata?: number } | null>; selectedItem: { type: number } | null; inventoryStart: number; inventoryEnd: number; findInventoryItem: (id: number, meta: number | null) => { slot: number } | null }>(
      (resolve, reject) => {
        const to = setTimeout(() => reject(new Error("crafting table didn't open")), 8000);
        (this.bot as unknown as { once(e: string, h: (w: unknown) => void): void }).once("windowOpen", (w) => {
          clearTimeout(to);
          resolve(w as never);
        });
      },
    );
    this.bot.activateBlock(this.bot.blockAt(tableBlock.position)!);
    const window = await opened;

    try {
      for (let n = 0; n < count; n++) {
        // lay out the ingredients into the 3x3 grid (slot = 1 + x + 3*y)
        const r = recipe as unknown as {
          inShape?: Array<Array<{ id: number; metadata?: number | null }>>;
          ingredients?: Array<{ id: number; metadata?: number | null }>;
          result: { id: number };
        };
        if (r.inShape) {
          for (let y = 0; y < r.inShape.length; y++) {
            const row = r.inShape[y]!;
            for (let x = 0; x < row.length; x++) {
              const ing = row[x]!;
              if (!ing || ing.id == null || ing.id === -1) continue;
              await this.placeOneIntoGrid(window, ing, 1 + x + 3 * y);
            }
          }
        } else if (r.ingredients) {
          let s = 1;
          for (const ing of r.ingredients) await this.placeOneIntoGrid(window, ing, s++);
        }
        // return any leftover stack on the cursor to the inventory
        if (window.selectedItem) {
          await this.bot.putSelectedItemRange(window.inventoryStart, window.inventoryEnd, window as never, null);
        }
        // wait for the server to compute the result, then take it
        await this.settle(300);
        const out = window.slots[0];
        if (!out || out.type !== r.result.id) throw new Error("recipe output didn't appear");
        await this.bot.clickWindow(0, 0, 1); // shift-click the output -> inventory
        await this.settle(150);
      }
    } finally {
      try {
        this.bot.closeWindow(window as never);
      } catch {
        /* ignore */
      }
    }
  }

  private async placeOneIntoGrid(
    window: { selectedItem: { type: number } | null; findInventoryItem: (id: number, meta: number | null) => { slot: number } | null },
    ingredient: { id: number; metadata?: number | null },
    destSlot: number,
  ): Promise<void> {
    if (!window.selectedItem || window.selectedItem.type !== ingredient.id) {
      const src = window.findInventoryItem(ingredient.id, ingredient.metadata ?? null);
      if (!src) throw new Error("missing ingredient");
      await this.bot.clickWindow(src.slot, 0, 0); // pick up the whole stack
    }
    await this.bot.clickWindow(destSlot, 1, 0); // right-click: drop one into the grid
  }

  /**
   * Craft with prerequisites auto-resolved. Converts logs→planks and
   * planks→sticks as needed, places a crafting table when the recipe needs one,
   * then crafts the target. Handles whatever wood the bot is carrying.
   */
  async craftSmart(itemName: string, count = 1): Promise<void> {
    if (this.resolveItemId(itemName) == null) throw new Error(`unknown item: ${itemName}`);

    const countPlanks = () =>
      this.bot.inventory.items().filter((i) => /_planks$/.test(i.name)).reduce((a, i) => a + i.count, 0);
    const countSticks = () =>
      this.bot.inventory.items().filter((i) => i.name === "stick").reduce((a, i) => a + i.count, 0);

    // One multi-batch craft per call (avoids racing the server's async inventory
    // sync, which a poll-and-loop hit). 1 log -> 4 planks; 2 planks -> 4 sticks.
    const ensurePlanks = async (need: number) => {
      const have = countPlanks();
      if (have >= need) return;
      const logItem = this.bot.inventory.items().find((i) => /(_log|_wood|_stem|_hyphae)$/.test(i.name));
      if (!logItem) return;
      const planks = this.plankFor(logItem.name);
      if (!planks || this.resolveItemId(planks) == null) return;
      const batches = Math.min(Math.ceil((need - have) / 4), logItem.count);
      if (batches > 0) await this.craft(planks, batches);
    };
    const ensureSticks = async (need: number) => {
      const have = countSticks();
      if (have >= need) return;
      const batches = Math.ceil((need - have) / 4); // 4 sticks per batch
      await ensurePlanks(2 * batches); // 2 planks per batch
      await this.craft("stick", batches);
    };

    // Make sure a crafting table is reachable: reuse a nearby one, place one we
    // own, or craft + place a fresh one. Needed before any 3x3 recipe (tools).
    const ensureTable = async () => {
      // close range only — must match craft()'s reach, else we skip making one
      // because a far/unreachable table "exists".
      if (this.bot.findBlock({ matching: this.resolveBlockIds("crafting_table"), maxDistance: 4 })) return;
      if (!this.bot.inventory.items().some((i) => i.name === "crafting_table")) {
        await ensurePlanks(4);
        await this.craft("crafting_table", 1); // craft the table item (2x2, no table needed)
      }
      await this.placeCraftingTable();
    };

    if (/_planks$/.test(itemName)) {
      await ensurePlanks(4 * count);
      return;
    }
    if (itemName === "stick") {
      await ensureSticks(4 * count);
      return;
    }
    if (itemName === "crafting_table") {
      await ensurePlanks(4);
      await this.craft("crafting_table", count);
      await this.placeCraftingTable(); // craft AND set it down
      return;
    }
    // tools / general 3x3 recipes: table first, then sticks (they eat planks),
    // then top up planks for the item itself, then craft.
    await ensureTable();
    await ensureSticks(2 * count + 1);
    await ensurePlanks(3 * count + 2);
    await this.craft(itemName, count);
  }

  /** oak_log→oak_planks, crimson_stem→crimson_planks, etc. null if not wood. */
  private plankFor(name: string): string | null {
    for (const suf of ["_log", "_wood", "_stem", "_hyphae"]) {
      if (name.endsWith(suf)) return name.slice(0, -suf.length) + "_planks";
    }
    return null;
  }

  /** Place a crafting table from inventory next to the bot, if it has one. */
  private async placeCraftingTable(): Promise<ReturnType<Bot["blockAt"]>> {
    const have = this.bot.inventory.items().find((i) => i.name === "crafting_table");
    if (!have) return null;
    const base = this.bot.entity.position.floored();
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const at = base.offset(dx, 0, dz);
      const below = this.bot.blockAt(at.offset(0, -1, 0));
      const here = this.bot.blockAt(at);
      if (below && below.name !== "air" && here && here.name === "air") {
        try {
          await this.equip("crafting_table");
          await this.bot.placeBlock(below, new Vec3(0, 1, 0));
          await this.settle(150);
          const placed = this.bot.blockAt(at);
          if (placed && placed.name === "crafting_table") return placed;
        } catch {
          /* try the next spot */
        }
      }
    }
    return null;
  }

  nearestHostile(opts?: { maxDistance?: number; preferThreatTo?: Vec3Lit }): EntityInfo | null {
    return this.nearestEntity({ ...opts, match: "hostile" });
  }

  nearestEntity(opts?: {
    match?: string;
    maxDistance?: number;
    preferThreatTo?: Vec3Lit;
    allowPlayers?: boolean;
  }): EntityInfo | null {
    const maxDistance = opts?.maxDistance ?? 16;
    const here = this.bot.entity.position;
    const ref = opts?.preferThreatTo
      ? new Vec3(opts.preferThreatTo.x, opts.preferThreatTo.y, opts.preferThreatTo.z)
      : here;

    const candidates = Object.values(this.bot.entities).filter(
      (e) =>
        e.id !== this.bot.entity.id &&
        here.distanceTo(e.position) <= maxDistance &&
        matchesTarget(e as ClassifiableEntity, {
          match: opts?.match,
          owner: this.cfg.mc.ownerUsername,
          allowPlayers: opts?.allowPlayers,
        }),
    );
    if (candidates.length === 0) return null;

    candidates.sort((a, b) => ref.distanceTo(a.position) - ref.distanceTo(b.position));
    const e = candidates[0]!;
    return {
      id: e.id,
      name: e.name ?? e.username ?? "entity",
      pos: toLit(e.position),
      distance: round(here.distanceTo(e.position)),
      kind: (e as ClassifiableEntity).kind,
      hostile: isHostile(e as ClassifiableEntity),
    };
  }

  entityExists(entityId: number): boolean {
    const e = this.bot.entities[entityId];
    // Mineflayer removes entities on death/unload, but a corpse can linger a
    // tick with health 0 — treat that as gone so kill counts stay honest.
    if (!e) return false;
    const hp = (e as { health?: number }).health;
    return hp === undefined || hp > 0;
  }

  // ── Containers ───────────────────────────────────────────────────────────

  async readContainer(pos: Vec3Lit): Promise<Array<{ item: string; count: number }>> {
    const block = await this.reachContainer(pos);
    const container = await this.bot.openContainer(block);
    const items = container.containerItems().map((i) => ({ item: i.name, count: i.count }));
    container.close();
    return items;
  }

  /** Pathfind into reach of a container coord, or throw a clean error. */
  private async reachContainer(pos: Vec3Lit) {
    const v = new Vec3(pos.x, pos.y, pos.z);
    const block = this.bot.blockAt(v);
    if (!block) throw new Error("no block at that position");
    await this.gotoSafe(new goals.GoalGetToBlock(pos.x, pos.y, pos.z), 10000);
    if (this.bot.entity.position.distanceTo(v) > 4.5) {
      throw new Error(`couldn't reach the container at (${pos.x}, ${pos.y}, ${pos.z})`);
    }
    return block;
  }

  async withdrawFromContainer(pos: Vec3Lit, item: string, count?: number): Promise<number> {
    const id = this.resolveItemId(item);
    if (id == null) throw new Error(`unknown item: ${item}`);
    const block = await this.reachContainer(pos);
    const container = await this.bot.openContainer(block);
    try {
      const match = container.containerItems().find((i) => i.type === id);
      if (!match) return 0;
      const take = Math.min(count ?? match.count, match.count);
      await container.withdraw(match.type, null, take);
      return take;
    } finally {
      container.close();
    }
  }

  dimension(): string {
    return this.bot.game.dimension;
  }

  // ── Name resolution ──────────────────────────────────────────────────────

  /** Map a friendly block name or group alias to concrete block ids. */
  private resolveBlockIds(name: string): number[] {
    const key = name.toLowerCase();
    const cached = this.blockIdCache.get(key);
    if (cached) return cached;

    const reg = this.bot.registry;
    const all = reg.blocksArray as Array<{ id: number; name: string }>;
    let ids: number[];
    switch (key) {
      case "any_log":
        ids = all.filter((b) => /(_log|_wood|_stem|_hyphae)$/.test(b.name)).map((b) => b.id);
        break;
      case "any_wood":
        ids = all.filter((b) => /(_log|_wood|_stem|_hyphae|_planks)$/.test(b.name)).map((b) => b.id);
        break;
      case "any_ore":
        ids = all.filter((b) => b.name.endsWith("_ore") || b.name === "ancient_debris").map((b) => b.id);
        break;
      case "any_stone":
        ids = all.filter((b) => STONE_NAMES.has(b.name)).map((b) => b.id);
        break;
      case "any_chest":
        ids = all
          .filter((b) => b.name === "chest" || b.name === "trapped_chest" || b.name === "barrel")
          .map((b) => b.id);
        break;
      default: {
        const b = reg.blocksByName[key];
        ids = b ? [b.id] : [];
      }
    }
    this.blockIdCache.set(key, ids);
    return ids;
  }

  private resolveItemId(name: string): number | null {
    const it = this.bot.registry.itemsByName[name];
    return it ? it.id : null;
  }
}
