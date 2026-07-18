# Skill: follow_player

**Tool:** `run_skill` with `name: "follow_player"`, optional `args: { distance }`.

## When to use
- The player says "stay with me", "follow", "come here", "stop wandering".
- After finishing a TASK skill, to get back to the player's side.
- Default resting behavior — when in doubt, be following.

## How
- Call `run_skill follow_player`. The fast loop handles the actual pathing,
  hysteresis, prediction, and teleport-fallback; this skill just (re)enables it
  and sets the target distance.
- Pass `distance` (blocks) only if the player asks for more/less space. Default 3.

## Don't
- Don't spam this every tick. The bot follows continuously on its own; only call
  it to change state (e.g. resume after a task) or change distance.
- Don't follow into obvious death (the player jumping into the void). Use
  judgment; safety reflexes will also intervene.
