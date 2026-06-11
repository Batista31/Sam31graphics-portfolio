"use client";

import { create } from "zustand";

export type RoomId = "home" | "video" | "photo" | "blender" | "thumbnails" | "secret";
export type GamePhase = "intro" | "playing" | "viewer";

export type Toast = { id: number; title: string; sub: string };

type WorldState = {
  activeRoom: RoomId;
  phase: GamePhase;
  isLoaded: boolean;
  secretUnlocked: boolean;
  cinematicModal: string | null;
  interactionLabel: string | null;
  // ── Minecraft-y state ──
  xp: number;
  orbsCollected: number;
  totalOrbs: number;
  night: boolean;
  toasts: Toast[];
  discovered: RoomId[];
  teleportTarget: RoomId | null; // consumed by the 3D world
  inventoryOpen: boolean;
  sleeping: boolean;
  swingTick: number; // increments on every sword swing — consumed by mobs
  health: number;
  lastHurtAt: number; // ms timestamp — drives the red damage flash
  playersOnline: number;
  setActiveRoom: (room: RoomId) => void;
  setPhase: (phase: GamePhase) => void;
  setLoaded: (value: boolean) => void;
  unlockSecret: () => void;
  openModal: (src: string) => void;
  closeModal: () => void;
  setInteractionLabel: (label: string | null) => void;
  collectOrb: () => void;
  toggleNight: () => void;
  pushToast: (title: string, sub: string) => void;
  dismissToast: (id: number) => void;
  markDiscovered: (room: RoomId) => void;
  requestTeleport: (room: RoomId) => void;
  clearTeleport: () => void;
  toggleInventory: () => void;
  closeInventory: () => void;
  sleep: () => void;
  wake: () => void;
  swing: () => void;
  setHealth: (health: number) => void;
  hurt: (health: number) => void;
  setPlayersOnline: (count: number) => void;
};

let toastId = 0;

export const useWorldStore = create<WorldState>((set, get) => ({
  activeRoom: "home",
  phase: "intro",
  isLoaded: false,
  secretUnlocked: false,
  cinematicModal: null,
  interactionLabel: null,
  xp: 0,
  orbsCollected: 0,
  totalOrbs: 12,
  night: false,
  toasts: [],
  discovered: [],
  teleportTarget: null,
  inventoryOpen: false,
  sleeping: false,
  swingTick: 0,
  health: 100,
  lastHurtAt: 0,
  playersOnline: 1,
  setActiveRoom: (activeRoom) => set({ activeRoom }),
  setPhase: (phase) => set({ phase }),
  setLoaded: (isLoaded) => set({ isLoaded }),
  unlockSecret: () => set({ secretUnlocked: true, activeRoom: "secret" }),
  openModal: (cinematicModal) => set({ cinematicModal, phase: "viewer" }),
  closeModal: () => set({ cinematicModal: null, phase: "playing" }),
  setInteractionLabel: (interactionLabel) => set({ interactionLabel }),
  collectOrb: () => {
    const { orbsCollected, totalOrbs, pushToast } = get();
    const next = orbsCollected + 1;
    set((s) => ({ orbsCollected: next, xp: s.xp + 7 }));
    if (next === 1) pushToast("Achievement Get!", "Getting an Upgrade — first XP orb");
    if (next === totalOrbs) pushToast("Achievement Get!", "XP Hunter — all orbs collected!");
  },
  toggleNight: () => set((s) => ({ night: !s.night })),
  pushToast: (title, sub) => {
    const id = ++toastId;
    set((s) => ({ toasts: [...s.toasts, { id, title, sub }] }));
    setTimeout(() => get().dismissToast(id), 4200);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  markDiscovered: (room) => {
    const { discovered, pushToast } = get();
    if (discovered.includes(room)) return;
    set({ discovered: [...discovered, room], xp: get().xp + 15 });
    const names: Record<string, string> = {
      video: "Video Edits Portal",
      thumbnails: "Thumbnail Design Portal",
      photo: "Photography Portal",
      blender: "Blender 3D Portal",
      secret: "Beyond The Lens Portal",
    };
    pushToast("Discovered!", names[room] ?? room);
  },
  requestTeleport: (room) => set({ teleportTarget: room }),
  clearTeleport: () => set({ teleportTarget: null }),
  toggleInventory: () => set((s) => ({ inventoryOpen: !s.inventoryOpen })),
  closeInventory: () => set({ inventoryOpen: false }),
  sleep: () => set({ sleeping: true, inventoryOpen: false }),
  wake: () => {
    const { night, pushToast } = get();
    set({ sleeping: false, night: !night });
    pushToast("Well rested!", night ? "Rise and shine — it's morning" : "The stars came out");
  },
  swing: () => set((s) => ({ swingTick: s.swingTick + 1 })),
  setHealth: (health) => set({ health }),
  hurt: (health) => set({ health, lastHurtAt: Date.now() }),
  setPlayersOnline: (playersOnline) => set({ playersOnline }),
}));

// dev-only debugging handle; stripped from production bundles
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  (window as unknown as Record<string, unknown>).__worldStore = useWorldStore;
}
