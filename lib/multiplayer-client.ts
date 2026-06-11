"use client";

/**
 * Thin WebSocket client for the /mp multiplayer endpoint in server.js.
 *
 * Design: network callbacks only mutate plain refs/maps — the 3D scene reads
 * them inside useFrame. React state changes only on roster changes
 * (join/leave), so avatars mount/unmount but never re-render per packet.
 * If the socket can't connect (e.g. plain `next dev`), the world stays
 * single-player.
 */

export type RemoteState = {
  id: number;
  name: string;
  c: number; // outfit palette index
  x: number;
  z: number;
  yaw: number;
  m: boolean; // moving
  r: boolean; // running
  health: number;
  swungAt: number; // local timestamp of last swing (for animation)
};

export type RosterEntry = { id: number; name: string; c: number };

type Handlers = {
  onRoster: (roster: RosterEntry[]) => void;
  onSelf: (id: number, name: string) => void;
  onSelfHit: (health: number, by: string) => void;
  onSelfDeath: (by: string, x: number, z: number) => void;
  onPlayersOnline: (count: number) => void;
};

export class MultiplayerClient {
  /** Mutable per-player network state, read by the render loop. */
  readonly remotes = new Map<number, RemoteState>();
  selfId = -1;
  selfName = "";

  private ws: WebSocket | null = null;
  private handlers: Handlers;
  private closed = false;
  private attempts = 0;
  private lastSent = 0;

  constructor(handlers: Handlers) {
    this.handlers = handlers;
  }

  connect() {
    if (typeof window === "undefined" || this.closed) return;
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    try {
      this.ws = new WebSocket(`${proto}://${window.location.host}/mp`);
    } catch {
      return;
    }

    this.ws.onopen = () => {
      this.attempts = 0;
    };
    this.ws.onmessage = (event) => this.handleMessage(String(event.data));
    this.ws.onclose = () => {
      this.remotes.clear();
      this.publishRoster();
      if (!this.closed && this.attempts < 4) {
        this.attempts += 1;
        setTimeout(() => this.connect(), 1500 * this.attempts);
      }
    };
    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  dispose() {
    this.closed = true;
    this.ws?.close();
    this.remotes.clear();
  }

  /** Throttled — safe to call every frame. */
  sendState(x: number, z: number, yaw: number, m: boolean, r: boolean) {
    const now = performance.now();
    if (now - this.lastSent < 80 || this.ws?.readyState !== 1) return;
    this.lastSent = now;
    this.ws.send(JSON.stringify({ type: "state", x, z, yaw, m, r }));
  }

  sendSwing() {
    if (this.ws?.readyState === 1) this.ws.send(JSON.stringify({ type: "swing" }));
  }

  private publishRoster() {
    this.handlers.onRoster(
      [...this.remotes.values()].map((p) => ({ id: p.id, name: p.name, c: p.c })),
    );
    this.handlers.onPlayersOnline(this.remotes.size + (this.selfId >= 0 ? 1 : 0));
  }

  private upsertRemote(p: { id: number; name: string; c: number; x: number; z: number; yaw: number; m: boolean; r: boolean; health: number }) {
    const existing = this.remotes.get(p.id);
    if (existing) {
      existing.x = p.x; existing.z = p.z; existing.yaw = p.yaw;
      existing.m = p.m; existing.r = p.r; existing.health = p.health;
    } else {
      this.remotes.set(p.id, { ...p, swungAt: 0 });
    }
    return !existing;
  }

  private handleMessage(raw: string) {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    switch (msg.type) {
      case "welcome": {
        this.selfId = msg.id as number;
        this.selfName = msg.name as string;
        this.handlers.onSelf(this.selfId, this.selfName);
        for (const p of msg.players as Parameters<MultiplayerClient["upsertRemote"]>[0][]) {
          if (p.id !== this.selfId) this.upsertRemote(p);
        }
        this.publishRoster();
        break;
      }
      case "join": {
        const p = msg.player as Parameters<MultiplayerClient["upsertRemote"]>[0];
        if (p.id !== this.selfId) {
          this.upsertRemote(p);
          this.publishRoster();
        }
        break;
      }
      case "leave": {
        if (this.remotes.delete(msg.id as number)) this.publishRoster();
        break;
      }
      case "snapshot": {
        let rosterChanged = false;
        for (const p of msg.players as Parameters<MultiplayerClient["upsertRemote"]>[0][]) {
          if (p.id !== this.selfId && this.upsertRemote(p)) rosterChanged = true;
        }
        if (rosterChanged) this.publishRoster();
        break;
      }
      case "swing": {
        const remote = this.remotes.get(msg.id as number);
        if (remote) remote.swungAt = performance.now();
        break;
      }
      case "hit": {
        if (msg.id === this.selfId) {
          this.handlers.onSelfHit(msg.health as number, msg.by as string);
        } else {
          const remote = this.remotes.get(msg.id as number);
          if (remote) remote.health = msg.health as number;
        }
        break;
      }
      case "death": {
        if (msg.id === this.selfId) {
          this.handlers.onSelfDeath(msg.by as string, msg.x as number, msg.z as number);
        } else {
          const remote = this.remotes.get(msg.id as number);
          if (remote) {
            remote.health = 100;
            remote.x = msg.x as number;
            remote.z = msg.z as number;
          }
        }
        break;
      }
    }
  }
}

/** 8 outfit palettes — index comes from the server so everyone agrees. */
export const OUTFITS: { shirt: string; pants: string }[] = [
  { shirt: "#f07f38", pants: "#253047" }, // classic Samyak orange
  { shirt: "#34d399", pants: "#1f2937" }, // emerald
  { shirt: "#60a5fa", pants: "#312e81" }, // sky blue
  { shirt: "#f472b6", pants: "#3b0a2e" }, // pink
  { shirt: "#facc15", pants: "#374151" }, // gold
  { shirt: "#a78bfa", pants: "#1e1b4b" }, // violet
  { shirt: "#f87171", pants: "#1c1917" }, // red
  { shirt: "#22d3ee", pants: "#164e63" }, // cyan
];
