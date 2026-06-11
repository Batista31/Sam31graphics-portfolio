/**
 * Custom Next.js server + multiplayer WebSocket world.
 *
 * Every visitor becomes a Minecraft-style character in the hub world.
 * The server is authoritative for: identity, outfit colors, health,
 * sword hits, deaths and respawns. Clients stream their own position
 * and receive ~10 snapshots/sec of everyone else.
 *
 *   npm run dev   → node server.js --dev   (Next dev + HMR + multiplayer)
 *   npm run start → node server.js         (production)
 */

const { createServer } = require("http");
const next = require("next");
const { WebSocketServer } = require("ws");

const dev = process.argv.includes("--dev");
const port = parseInt(process.env.PORT || "3000", 10);
const hostname = "0.0.0.0";

const app = next({ dev });
const handle = app.getRequestHandler();

// ── Multiplayer state ─────────────────────────────────────────────────────────

const TICK_MS = 100;          // snapshot broadcast rate (10 Hz)
const HIT_RANGE = 1.7;        // world units a sword swing reaches
const HIT_DAMAGE = 20;        // per hit → 5 hits = respawn
const WORLD_LIMIT = 60;       // position clamp
const SPAWN = { x: 0, z: 7 };

/** id → { ws, x, z, yaw, m(oving), r(unning), health, name, c(olorIndex), swungAt } */
const players = new Map();
let nextId = 1;

const NAMES = [
  "Creeper", "Piglin", "Blaze", "Enderman", "Allay", "Axolotl",
  "Warden", "Strider", "Phantom", "Vex", "Sniffer", "Golem",
];

function makePlayer(ws) {
  const id = nextId++;
  return {
    ws,
    id,
    name: `${NAMES[id % NAMES.length]}-${String(id).padStart(2, "0")}`,
    c: id % 8, // outfit palette index, resolved client-side
    x: SPAWN.x + (Math.random() - 0.5) * 3,
    z: SPAWN.z + (Math.random() - 0.5) * 3,
    yaw: Math.PI,
    m: false,
    r: false,
    health: 100,
    swungAt: 0,
  };
}

function publicState(p) {
  return { id: p.id, name: p.name, c: p.c, x: p.x, z: p.z, yaw: p.yaw, m: p.m, r: p.r, health: p.health };
}

function send(p, msg) {
  if (p.ws.readyState === 1) p.ws.send(JSON.stringify(msg));
}

function broadcast(msg, exceptId) {
  const data = JSON.stringify(msg);
  for (const p of players.values()) {
    if (p.id !== exceptId && p.ws.readyState === 1) p.ws.send(data);
  }
}

function clamp(v, lim) {
  return Math.max(-lim, Math.min(lim, Number(v) || 0));
}

function handleMessage(p, raw) {
  let msg;
  try {
    msg = JSON.parse(raw);
  } catch {
    return;
  }

  if (msg.type === "state") {
    p.x = clamp(msg.x, WORLD_LIMIT);
    p.z = clamp(msg.z, WORLD_LIMIT);
    p.yaw = Number(msg.yaw) || 0;
    p.m = !!msg.m;
    p.r = !!msg.r;
  } else if (msg.type === "swing") {
    const now = Date.now();
    if (now - p.swungAt < 350) return; // server-side swing cooldown
    p.swungAt = now;
    broadcast({ type: "swing", id: p.id }, p.id);

    // hit detection against every other player
    for (const other of players.values()) {
      if (other.id === p.id || other.health <= 0) continue;
      if (Math.hypot(other.x - p.x, other.z - p.z) > HIT_RANGE) continue;

      other.health -= HIT_DAMAGE;
      if (other.health <= 0) {
        other.health = 100;
        other.x = SPAWN.x + (Math.random() - 0.5) * 3;
        other.z = SPAWN.z + (Math.random() - 0.5) * 3;
        broadcast({ type: "death", id: other.id, by: p.name, x: other.x, z: other.z });
      } else {
        broadcast({ type: "hit", id: other.id, by: p.name, health: other.health });
      }
    }
  }
}

function startMultiplayer(server, nextUpgradeHandler) {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    let pathname = "/";
    try {
      pathname = new URL(req.url, "http://localhost").pathname;
    } catch {}
    if (pathname === "/mp") {
      wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
    } else if (nextUpgradeHandler) {
      // Next dev HMR websocket
      nextUpgradeHandler(req, socket, head);
    } else {
      socket.destroy();
    }
  });

  wss.on("connection", (ws) => {
    const p = makePlayer(ws);
    players.set(p.id, p);

    send(p, { type: "welcome", id: p.id, name: p.name, c: p.c, players: [...players.values()].map(publicState) });
    broadcast({ type: "join", player: publicState(p) }, p.id);

    ws.on("message", (raw) => handleMessage(p, raw));
    ws.on("close", () => {
      players.delete(p.id);
      broadcast({ type: "leave", id: p.id });
    });
    ws.on("error", () => {
      players.delete(p.id);
      broadcast({ type: "leave", id: p.id });
    });
  });

  setInterval(() => {
    if (players.size === 0) return;
    broadcast({ type: "snapshot", players: [...players.values()].map(publicState) });
  }, TICK_MS);
}

// ── Boot ──────────────────────────────────────────────────────────────────────

app.prepare().then(() => {
  const server = createServer((req, res) => handle(req, res));
  const nextUpgradeHandler = typeof app.getUpgradeHandler === "function" ? app.getUpgradeHandler() : null;
  startMultiplayer(server, nextUpgradeHandler);
  server.listen(port, hostname, () => {
    console.log(`> SAMYAKCRAFT ready on http://localhost:${port} (${dev ? "dev" : "production"}) — multiplayer at /mp`);
  });
});
