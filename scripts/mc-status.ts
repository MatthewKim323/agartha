/**
 * Real Minecraft server-list ping. Zero dependencies.
 *
 * A TCP connect check is NOT sufficient: Aternos runs an info proxy that
 * accepts connections and answers status long after the server itself has
 * stopped, so `nc -z` reports healthy while every login times out at 60s with
 * no useful error. Only a real status handshake distinguishes them.
 *
 *   bun scripts/mc-status.ts            # uses MC_SERVER_HOST / MC_SERVER_PORT
 *   bun scripts/mc-status.ts host port
 *
 * Exit 0 = a real server answered. Exit 1 = asleep, starting, or unreachable.
 */
import { connect } from "node:net";

function varint(n: number): Buffer {
  const out: number[] = [];
  do {
    let b = n & 0x7f;
    n >>>= 7;
    if (n) b |= 0x80;
    out.push(b);
  } while (n);
  return Buffer.from(out);
}

function packet(id: number, payload: Buffer): Buffer {
  const body = Buffer.concat([varint(id), payload]);
  return Buffer.concat([varint(body.length), body]);
}

function mcString(s: string): Buffer {
  const b = Buffer.from(s, "utf8");
  return Buffer.concat([varint(b.length), b]);
}

function status(host: string, port: number, timeoutMs = 8000): Promise<string> {
  return new Promise((resolve, reject) => {
    const sock = connect({ host, port });
    const timer = setTimeout(() => {
      sock.destroy();
      reject(new Error(`no status within ${timeoutMs}ms`));
    }, timeoutMs);
    let buf = Buffer.alloc(0);

    sock.on("connect", () => {
      // Handshake: protocol 765 (1.20.6), next state 1 = status.
      const hs = Buffer.concat([varint(765), mcString(host), Buffer.from([port >> 8, port & 0xff]), varint(1)]);
      sock.write(packet(0x00, hs));
      sock.write(packet(0x00, Buffer.alloc(0)));
    });
    sock.on("data", (d) => {
      buf = Buffer.concat([buf, d]);
      const text = buf.toString("utf8");
      const i = text.indexOf("{");
      if (i >= 0 && text.length - i > 40) {
        clearTimeout(timer);
        sock.destroy();
        resolve(text.slice(i));
      }
    });
    sock.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    sock.on("close", () => {
      clearTimeout(timer);
      reject(new Error("closed with no status (server is stopped)"));
    });
  });
}

const host = process.argv[2] ?? process.env.MC_SERVER_HOST;
const port = Number(process.argv[3] ?? process.env.MC_SERVER_PORT ?? 25565);

if (!host) {
  console.error("no host (set MC_SERVER_HOST or pass one)");
  process.exit(1);
}

try {
  const raw = await status(host, port);
  const j = JSON.parse(raw) as {
    version?: { name?: string };
    players?: { online?: number; max?: number };
    description?: unknown;
  };
  const motd = typeof j.description === "string" ? j.description : JSON.stringify(j.description ?? "");

  // Aternos's proxy answers with a "Connect to host:port" MOTD and 0/0 slots.
  // That is not the server, and logging in against it hangs.
  if (/connect to/i.test(motd) || (j.players?.max ?? 0) === 0) {
    console.error(`${host}:${port} is the Aternos info proxy, not the server.`);
    console.error(`  motd: ${motd.replace(/§./g, "").slice(0, 120)}`);
    console.error(`  find the real port: dig +short SRV _minecraft._tcp.${host}`);
    process.exit(1);
  }

  console.log(`${host}:${port} UP — ${j.version?.name} — ${j.players?.online}/${j.players?.max} players`);
  process.exit(0);
} catch (e) {
  console.error(`${host}:${port} is NOT up — ${(e as Error).message}`);
  console.error("  Aternos stops the server when it is empty. Start it at https://aternos.org");
  console.error("  and wait for the panel to say Online (it takes a minute or two).");
  process.exit(1);
}
