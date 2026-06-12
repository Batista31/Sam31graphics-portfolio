"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BedDouble, Camera, Clapperboard, Eye, Headphones, Heart, Image as ImageIcon, Moon, Move3D, Box, Smartphone, Sparkles, Sun, Sword, Users, X } from "lucide-react";
import type { PortfolioRegistry } from "@/lib/media-registry";
import { type RoomId, useWorldStore } from "@/store/world-store";

const PlayableWorld = dynamic(() => import("@/components/three/playable-world").then((m) => m.PlayableWorld), {
  ssr: false,
  loading: () => <LoadingScreen />
});

const SPLASHES = [
  "Also try walking!",
  "Beat-synced!",
  "100% block-certified!",
  "Now with portals!",
  "Press Shift to zoom!",
  "Made in Bengaluru!",
  "Punch the pig! (don't)",
  "Every story, a passion!",
  "Collect the XP orbs!",
  "Render distance: maximum!",
];

const HOTBAR: { id: RoomId; label: string; color: string; icon: React.ReactNode }[] = [
  { id: "video",      label: "Video Edits",  color: "#ff6b35", icon: <Clapperboard size={18} /> },
  { id: "thumbnails", label: "Thumbnails",   color: "#38d978", icon: <ImageIcon size={18} /> },
  { id: "photo",      label: "Photography",  color: "#ffb340", icon: <Camera size={18} /> },
  { id: "blender",    label: "Blender 3D",   color: "#9d50ff", icon: <Box size={18} /> },
  { id: "secret",     label: "Beyond Lens",  color: "#00d4ff", icon: <Eye size={18} /> },
];

export function ExperienceShell({ registry }: { registry: PortfolioRegistry }) {
  const phase = useWorldStore((state) => state.phase);
  const setPhase = useWorldStore((state) => state.setPhase);
  const modal = useWorldStore((state) => state.cinematicModal);
  const closeModal = useWorldStore((state) => state.closeModal);
  const interactionLabel = useWorldStore((state) => state.interactionLabel);
  const night = useWorldStore((state) => state.night);
  const toggleNight = useWorldStore((state) => state.toggleNight);
  const xp = useWorldStore((state) => state.xp);
  const orbsCollected = useWorldStore((state) => state.orbsCollected);
  const totalOrbs = useWorldStore((state) => state.totalOrbs);
  const toasts = useWorldStore((state) => state.toasts);
  const requestTeleport = useWorldStore((state) => state.requestTeleport);
  const inventoryOpen = useWorldStore((state) => state.inventoryOpen);
  const closeInventory = useWorldStore((state) => state.closeInventory);
  const sleeping = useWorldStore((state) => state.sleeping);
  const sleep = useWorldStore((state) => state.sleep);
  const wake = useWorldStore((state) => state.wake);
  const discovered = useWorldStore((state) => state.discovered);
  const health = useWorldStore((state) => state.health);
  const lastHurtAt = useWorldStore((state) => state.lastHurtAt);
  const playersOnline = useWorldStore((state) => state.playersOnline);

  const splash = useMemo(() => SPLASHES[Math.floor(Math.random() * SPLASHES.length)], []);

  // sleeping lasts a few seconds, then you wake to the flipped time of day
  useEffect(() => {
    if (!sleeping) return;
    const timer = setTimeout(wake, 2600);
    return () => clearTimeout(timer);
  }, [sleeping, wake]);

  return (
    <main id="game-root" className="relative bg-black text-white">
      <PlayableWorld registry={registry} />
      <div className="film-grain" />

      <AnimatePresence>
        {phase === "intro" && (
          <motion.div
            className="absolute inset-0 z-50 grid place-items-center bg-black"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2 }}
          >
            <motion.div className="relative text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.4 }}>
              <motion.p className="text-sm uppercase tracking-[0.36em] text-orange-200" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                Every room tells a story.
              </motion.p>
              <motion.h1 className="mt-5 font-serif text-5xl font-black uppercase leading-tight md:text-8xl" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1.4, duration: 1.2 }}>
                Every story,
                <br />
                a passion.
              </motion.h1>
              {/* Minecraft splash text */}
              <motion.p
                className="pointer-events-none absolute -right-6 top-2 rotate-[-14deg] text-base font-black text-yellow-300 drop-shadow-[2px_2px_0_rgba(60,50,0,0.9)] md:-right-20 md:top-6 md:text-xl"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, scale: [1, 1.08, 1] }}
                transition={{ delay: 2.2, scale: { repeat: Infinity, duration: 0.9 } }}
              >
                {splash}
              </motion.p>
              <motion.button
                className="mt-10 rounded-full border border-orange-100/60 px-8 py-3 text-xs uppercase tracking-[0.22em] text-orange-100 transition hover:bg-orange-100 hover:text-black"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 2.8 }}
                onClick={() => setPhase("playing")}
              >
                Enter The World
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="pointer-events-none absolute left-5 top-5 z-30">
        <p className="font-serif text-4xl italic leading-none">Samyak</p>
        <p className="ml-4 text-[0.58rem] uppercase tracking-[0.55em] text-white/75">Graphics</p>
      </div>

      <div className="absolute right-5 top-5 z-30 hidden items-center gap-3 md:flex">
        <HudPill icon={<Users size={16} />} text={`${playersOnline} online`} />
        <HudPill icon={<Move3D size={16} />} text="WASD / ⬆⬇⬅➡ move" />
        <HudPill icon={<Sword size={16} />} text="Click / F swing" />
        <HudPill icon={<Headphones size={16} />} text="Space jump" />
        <HudPill icon={<Box size={16} />} text="E inventory" />
        <button
          type="button"
          onClick={toggleNight}
          aria-label={night ? "Switch to day" : "Switch to night"}
          className="grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-black/35 text-stone-200 backdrop-blur-md transition hover:bg-white hover:text-black"
        >
          {night ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>

      {/* Achievement toasts — Minecraft style */}
      <div className="pointer-events-none absolute right-5 top-20 z-40 flex flex-col gap-2">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 60 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 60 }}
              className="flex items-center gap-3 rounded-md border-2 border-[#55401e] bg-[#1c1c1c]/95 px-4 py-2.5 shadow-[0_4px_18px_rgba(0,0,0,0.6)]"
            >
              <span className="grid h-8 w-8 place-items-center rounded bg-gradient-to-br from-lime-300 to-green-600 text-sm">✦</span>
              <span>
                <span className="block text-[0.78rem] font-bold text-yellow-300">{toast.title}</span>
                <span className="block text-[0.7rem] text-stone-200">{toast.sub}</span>
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {interactionLabel && phase === "playing" && (
          <motion.div
            className="pointer-events-none absolute bottom-28 left-1/2 z-40 -translate-x-1/2 rounded-full border border-white/20 bg-black/55 px-6 py-3 text-center text-sm uppercase tracking-[0.2em] text-orange-100 backdrop-blur-md"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 18 }}
          >
            Space - {interactionLabel}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Minecraft hotbar + XP bar ── */}
      {phase === "playing" && (
        <motion.div
          className="absolute bottom-4 left-1/2 z-40 -translate-x-1/2"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          {/* Hearts — Minecraft health row */}
          <div className="mb-1 flex justify-center gap-0.5">
            {Array.from({ length: 10 }, (_, i) => (
              <Heart
                key={i}
                size={14}
                className={i < Math.ceil(health / 10) ? "text-red-500" : "text-black/50"}
                fill={i < Math.ceil(health / 10) ? "#ef4444" : "#1a1a1a"}
              />
            ))}
          </div>
          {/* XP bar */}
          <div className="mx-auto mb-1.5 h-2 w-[88%] overflow-hidden rounded-sm border border-black/70 bg-black/55">
            <div
              className="h-full bg-gradient-to-r from-lime-400 to-green-500 transition-[width] duration-500"
              style={{ width: `${Math.min((orbsCollected / totalOrbs) * 100, 100)}%` }}
            />
          </div>
          <div className="mb-1 text-center text-[0.62rem] font-bold text-lime-300 drop-shadow-[1px_1px_0_rgba(0,0,0,0.9)]">
            {xp} XP · {orbsCollected}/{totalOrbs} orbs
          </div>
          {/* Hotbar slots */}
          <div className="flex gap-1 rounded-md border-2 border-[#2a2a2a] bg-[#161616]/85 p-1 backdrop-blur-sm">
            {HOTBAR.map((slot, i) => (
                <button
                  key={slot.id}
                  type="button"
                  title={`${slot.label} — press ${i + 1}`}
                  onClick={() => requestTeleport(slot.id)}
                  className="group relative grid h-12 w-12 place-items-center rounded border-2 border-[#3f3f3f] bg-[#262626]/80 transition hover:border-white/70 hover:bg-white/10 md:h-14 md:w-14"
                  style={{ color: slot.color }}
                >
                  {slot.icon}
                  <span className="absolute left-1 top-0.5 text-[0.55rem] font-bold text-white/60">{i + 1}</span>
                  <span className="pointer-events-none absolute -top-8 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-black/85 px-2 py-1 text-[0.6rem] uppercase tracking-[0.14em] text-white group-hover:block">
                    {slot.label}
                  </span>
                </button>
            ))}
          </div>
          <p className="mt-1.5 text-center text-[0.58rem] font-bold uppercase tracking-[0.2em] text-white/55 drop-shadow-[1px_1px_0_rgba(0,0,0,0.9)]">
            Press <span className="text-yellow-300">E</span> for inventory · <span className="text-yellow-300">1–5</span> teleport
          </p>
        </motion.div>
      )}

      {/* red damage flash when another player hits you */}
      <AnimatePresence>
        {lastHurtAt > 0 && (
          <motion.div
            key={lastHurtAt}
            className="pointer-events-none absolute inset-0 z-[60]"
            style={{ background: "radial-gradient(ellipse at center, transparent 40%, rgba(220,30,30,0.55) 100%)" }}
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.7 }}
          />
        )}
      </AnimatePresence>

      {/* ── Inventory (E) ── */}
      <AnimatePresence>
        {inventoryOpen && phase === "playing" && (
          <motion.div
            className="absolute inset-0 z-[70] grid place-items-center bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={closeInventory}
          >
            <motion.div
              className="w-[min(92vw,30rem)] rounded-lg border-4 border-[#3f3f3f] bg-[#c6c6c6] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.7)]"
              initial={{ scale: 0.92, y: 14 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-black uppercase tracking-[0.18em] text-[#3a3a3a]">Inventory</h2>
                <button
                  type="button"
                  onClick={closeInventory}
                  aria-label="Close inventory"
                  className="grid h-7 w-7 place-items-center rounded bg-[#8b8b8b] text-white transition hover:bg-[#6f6f6f]"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="grid grid-cols-4 gap-2">
                <InventorySlot
                  icon={<Sword size={26} className="text-cyan-600" />}
                  label="Diamond Sword"
                  sub="Equipped · click or F to swing"
                />
                <InventorySlot
                  icon={<BedDouble size={26} className="text-rose-600" />}
                  label="Bed"
                  sub="Click to sleep — skips to day/night"
                  onUse={sleep}
                  highlight
                />
                <InventorySlot
                  icon={<Sparkles size={26} className="text-lime-600" />}
                  label={`XP Orbs ×${orbsCollected}`}
                  sub={`${totalOrbs - orbsCollected} still hidden in the world`}
                />
                <InventorySlot
                  icon={<Camera size={26} className="text-amber-600" />}
                  label="Camera"
                  sub="Samyak never leaves home without it"
                />
              </div>

              <p className="mb-2 mt-4 text-[0.6rem] font-bold uppercase tracking-[0.2em] text-[#5a5a5a]">Portals discovered</p>
              <div className="grid grid-cols-5 gap-2">
                {HOTBAR.map((slot) => {
                  const found = discovered.includes(slot.id);
                  return (
                    <div
                      key={slot.id}
                      title={found ? slot.label : "???"}
                      className={`grid aspect-square place-items-center rounded border-2 ${
                        found ? "border-[#5a5a5a] bg-[#9d9d9d]" : "border-[#9a9a9a] bg-[#b5b5b5] opacity-45"
                      }`}
                      style={{ color: found ? slot.color : "#6b6b6b" }}
                    >
                      {found ? slot.icon : <span className="text-base font-black">?</span>}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Sleeping overlay — cozy Blender bedroom render ── */}
      <AnimatePresence>
        {sleeping && (
          <motion.div
            className="absolute inset-0 z-[85] grid place-items-center bg-black"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 1.1 } }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <motion.img
              src="/assets/images/rooms/sleep-room.webp"
              alt="Samyak's cozy bedroom"
              className="max-h-[72vh] max-w-[88vw] object-contain"
              initial={{ scale: 1.04 }} animate={{ scale: 1 }} transition={{ duration: 2.6, ease: "easeOut" }}
            />
            <motion.p
              className="absolute bottom-16 text-sm uppercase tracking-[0.4em] text-stone-300"
              animate={{ opacity: [0.35, 1, 0.35] }}
              transition={{ repeat: Infinity, duration: 1.6 }}
            >
              Sleeping…
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute inset-x-0 bottom-0 z-20 h-32 bg-gradient-to-t from-black/70 to-transparent" />

      <div className="absolute inset-0 z-[90] hidden place-items-center bg-black px-6 text-center max-[520px]:grid">
        <Smartphone className="mx-auto mb-4 text-orange-200" size={34} />
        <h2 className="text-2xl font-black">Desktop experience recommended</h2>
        <p className="mt-3 max-w-sm text-stone-300">This is a keyboard and mouse controlled 3D world. Open it on a desktop or laptop for the playable version.</p>
      </div>

      <AnimatePresence>
        {modal && (
          <motion.div className="absolute inset-0 z-[80] grid place-items-center bg-black/88 p-4 backdrop-blur-xl" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="relative aspect-video w-full max-w-6xl overflow-hidden rounded-md border border-white/15 bg-black shadow-2xl shadow-orange-500/15" initial={{ scale: 0.92 }} animate={{ scale: 1 }} exit={{ scale: 0.96 }}>
              {modal.match(/\.(mp4|mov|webm)$/i) ? (
                <video src={modal} controls autoPlay className="h-full w-full object-contain" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={modal} alt="Project preview" className="h-full w-full object-contain" />
              )}
              <button className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-white text-black" onClick={closeModal} aria-label="Close viewer">
                <X size={18} />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

function InventorySlot({
  icon,
  label,
  sub,
  onUse,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  sub: string;
  onUse?: () => void;
  highlight?: boolean;
}) {
  const Tag = onUse ? "button" : "div";
  return (
    <Tag
      type={onUse ? "button" : undefined}
      onClick={onUse}
      title={`${label} — ${sub}`}
      className={`group relative grid aspect-square place-items-center rounded border-2 transition ${
        highlight
          ? "border-amber-600 bg-[#d9c489] hover:bg-[#e8d49a] cursor-pointer"
          : "border-[#5a5a5a] bg-[#9d9d9d]"
      } ${onUse ? "hover:scale-[1.04]" : ""}`}
    >
      {icon}
      <span className="pointer-events-none absolute -bottom-1 left-1/2 z-10 hidden w-36 -translate-x-1/2 translate-y-full rounded bg-black/90 px-2 py-1.5 text-center text-[0.58rem] leading-tight text-white group-hover:block">
        <span className="block font-bold text-yellow-300">{label}</span>
        {sub}
      </span>
    </Tag>
  );
}

function HudPill({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-white/15 bg-black/35 px-4 py-2 text-xs uppercase tracking-[0.18em] text-stone-200 backdrop-blur-md">
      {icon}
      {text}
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="grid h-screen place-items-center bg-black text-white">
      <div className="text-center">
        <div className="mx-auto mb-5 h-14 w-14 animate-spin rounded-full border-2 border-white/15 border-t-orange-200" />
        <p className="text-sm uppercase tracking-[0.3em] text-stone-300">Building the playable world</p>
      </div>
    </div>
  );
}
