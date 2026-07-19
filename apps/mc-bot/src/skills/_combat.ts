import type { InventoryItem } from "@agartha/shared";

/** Best-to-worst weapon match order. First inventory item that matches wins. */
const WEAPON_PRIORITY = [
  /^netherite_sword$/, /^diamond_sword$/, /^iron_sword$/, /^stone_sword$/,
  /^golden_sword$/, /^wooden_sword$/, /_axe$/,
];

/**
 * Pick the best weapon in inventory. Shared by combat_assist and hunt so the
 * two can't drift on what "armed" means — and so the attack cooldown, which is
 * derived from the weapon name, is derived from the same answer.
 */
export function pickWeapon(inv: InventoryItem[]): string | null {
  for (const rx of WEAPON_PRIORITY) {
    const hit = inv.find((i) => rx.test(i.name));
    if (hit) return hit.name;
  }
  return null;
}
