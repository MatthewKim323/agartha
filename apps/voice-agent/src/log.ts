/* Minimal leveled logger (mirrors apps/mc-bot/src/util/logger.ts). */

const LEVELS = ["debug", "info", "warn", "error"] as const;
type Level = (typeof LEVELS)[number];

let threshold: Level = (process.env.LOG_LEVEL as Level) ?? "info";
if (!LEVELS.includes(threshold)) threshold = "info";

function should(level: Level): boolean {
  return LEVELS.indexOf(level) >= LEVELS.indexOf(threshold);
}

export function logger(scope: string) {
  const emit = (level: Level, args: unknown[]) => {
    if (!should(level)) return;
    (console[level === "debug" ? "log" : level] as (...a: unknown[]) => void)(`[${level}] ${scope}`, ...args);
  };
  return {
    debug: (...a: unknown[]) => emit("debug", a),
    info: (...a: unknown[]) => emit("info", a),
    warn: (...a: unknown[]) => emit("warn", a),
    error: (...a: unknown[]) => emit("error", a),
  };
}
