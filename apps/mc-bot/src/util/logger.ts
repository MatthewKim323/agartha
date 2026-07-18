/* Dead-simple leveled logger. Swap for pino later if we want structured logs. */

const LEVELS = ["debug", "info", "warn", "error"] as const;
type Level = (typeof LEVELS)[number];

let threshold: Level = "info";

export function setLogLevel(level: string): void {
  if ((LEVELS as readonly string[]).includes(level)) threshold = level as Level;
}

function should(level: Level): boolean {
  return LEVELS.indexOf(level) >= LEVELS.indexOf(threshold);
}

function emit(level: Level, scope: string, args: unknown[]): void {
  if (!should(level)) return;
  const tag = `[${level}] ${scope}`;
  // eslint-disable-next-line no-console
  (console[level === "debug" ? "log" : level] as (...a: unknown[]) => void)(tag, ...args);
}

export function logger(scope: string) {
  return {
    debug: (...a: unknown[]) => emit("debug", scope, a),
    info: (...a: unknown[]) => emit("info", scope, a),
    warn: (...a: unknown[]) => emit("warn", scope, a),
    error: (...a: unknown[]) => emit("error", scope, a),
  };
}
