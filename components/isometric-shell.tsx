"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Images, X } from "lucide-react";
import type { PortfolioRegistry } from "@/lib/media-registry";
import { VideoRoomStage } from "@/components/video-room-stage";
import { PhotographyRoomStage } from "@/components/photography-room-stage";

const IsometricRoom = dynamic(
  () => import("@/components/three/isometric-room").then((m) => m.IsometricRoom),
  { ssr: false, loading: () => <RoomLoader /> }
);

const VoxelGalleryRoom = dynamic(
  () => import("@/components/three/voxel-gallery-room").then((m) => m.VoxelGalleryRoom),
  { ssr: false, loading: () => <RoomLoader /> }
);

const ROOM_META: Record<string, { label: string; sub: string; color: string }> = {
  video:      { label: "Video Editing",     sub: "Beat sync · chaos · timing",          color: "#ff4e2a" },
  photo:      { label: "Photography",       sub: "Light · travel · memory",             color: "#ffb340" },
  blender:    { label: "Blender / 3D",      sub: "Shaders · forms · experiments",       color: "#9d50ff" },
  thumbnails: { label: "Thumbnail Design",  sub: "Impact · drama · click energy",       color: "#00e87a" },
  secret:     { label: "Beyond The Lens",   sub: "Forest · observatory · wind",         color: "#00d4ff" },
};

export function IsometricShell({ roomId, registry }: { roomId: string; registry: PortfolioRegistry }) {
  const router = useRouter();
  const [modal, setModal] = useState<string | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const meta = ROOM_META[roomId] ?? { label: roomId, sub: "", color: "#ffffff" };

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#2e2a38]">
      {roomId === "video" ? (
        <VideoRoomStage />
      ) : roomId === "photo" ? (
        <PhotographyRoomStage assets={registry.photography} onItemClick={setModal} />
      ) : roomId === "blender" ? (
        <VoxelGalleryRoom theme="nether" assets={registry.blender} onItemClick={setModal} />
      ) : roomId === "thumbnails" ? (
        <VoxelGalleryRoom theme="den" assets={registry.thumbnails} onItemClick={setModal} />
      ) : roomId === "secret" ? (
        <VoxelGalleryRoom theme="end" assets={registry.travel} onItemClick={setModal} />
      ) : (
        <IsometricRoom roomId={roomId} registry={registry} onItemClick={setModal} />
      )}

      {/* Back button */}
      <motion.button
        initial={{ opacity: 0, x: -16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.4 }}
        onClick={() => router.push("/")}
        className="absolute left-5 top-5 z-50 flex items-center gap-2 rounded-full border border-white/20 bg-black/45 px-5 py-2.5 text-xs uppercase tracking-[0.2em] text-white backdrop-blur-md transition-colors hover:bg-white hover:text-black"
      >
        <ArrowLeft size={13} />
        Back to World
      </motion.button>

      {/* Room title */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="pointer-events-none absolute left-1/2 top-20 z-50 -translate-x-1/2 text-center sm:top-5"
      >
        <p className="text-[0.6rem] uppercase tracking-[0.35em]" style={{ color: meta.color }}>
          You are in
        </p>
        <h1 className="text-2xl font-black uppercase tracking-wide text-white">{meta.label}</h1>
        <p className="mt-0.5 text-[0.65rem] uppercase tracking-[0.18em] text-white/50">{meta.sub}</p>
      </motion.div>

      {roomId === "photo" && (
        <motion.button
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.45 }}
          onClick={() => setGalleryOpen(true)}
          className="absolute right-5 top-5 z-50 flex items-center gap-2 rounded-full border border-white/20 bg-black/45 px-5 py-2.5 text-xs uppercase tracking-[0.18em] text-white backdrop-blur-md transition-colors hover:bg-white hover:text-black"
        >
          <Images size={14} />
          More Photos
        </motion.button>
      )}

      {/* Click hint */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        className="pointer-events-none absolute bottom-6 left-1/2 z-50 -translate-x-1/2 text-[0.65rem] uppercase tracking-[0.22em] text-white/35"
      >
        {roomId === "video"
          ? "Click the TV to change videos"
          : roomId === "photo"
            ? "Click any item to view"
            : "Drag to look around · Click a frame to view"}
      </motion.p>

      {/* Work item modal */}
      <AnimatePresence>
        {galleryOpen && (
          <motion.div
            className="absolute inset-0 z-[75] bg-black/88 p-5 pt-24 backdrop-blur-xl"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <div className="mx-auto flex h-full max-w-6xl flex-col">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-[0.6rem] uppercase tracking-[0.35em] text-amber-200">Photography</p>
                  <h2 className="text-2xl font-black uppercase tracking-wide text-white">All Photos</h2>
                </div>
                <button
                  className="grid h-10 w-10 place-items-center rounded-full bg-white text-black transition hover:bg-stone-200"
                  onClick={() => setGalleryOpen(false)}
                  aria-label="Close photo gallery"
                >
                  <X size={17} />
                </button>
              </div>

              <div className="no-scrollbar grid flex-1 grid-cols-2 gap-3 overflow-y-auto pb-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {registry.photography.map((asset) => (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => setModal(asset.src)}
                    className="group relative aspect-[4/5] overflow-hidden rounded-md border border-white/10 bg-white/5 text-left outline-none transition hover:border-amber-200/70 focus-visible:ring-2 focus-visible:ring-amber-200"
                    aria-label={`Open ${asset.title}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={asset.src} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-3 pb-3 pt-8 text-[0.62rem] uppercase tracking-[0.12em] text-white/85">
                      {asset.title}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {modal && (
          <motion.div
            className="absolute inset-0 z-[80] grid place-items-center bg-black/85 p-4 backdrop-blur-xl"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setModal(null)}
          >
            <motion.div
              className="relative aspect-video w-full max-w-5xl overflow-hidden rounded-xl border border-white/15 bg-black shadow-2xl"
              initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
            >
              {modal.match(/\.(mp4|mov|webm)$/i) ? (
                <video src={modal} controls autoPlay className="h-full w-full object-contain" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={modal} alt="Work preview" className="h-full w-full object-contain" />
              )}
              <button
                className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white text-black transition hover:bg-stone-200"
                onClick={() => setModal(null)}
              >
                <X size={16} />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

function RoomLoader() {
  return (
    <div className="grid h-screen place-items-center bg-[#2e2a38] text-white">
      <div className="text-center">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-white/70" />
        <p className="text-xs uppercase tracking-[0.3em] text-white/50">Loading room…</p>
      </div>
    </div>
  );
}
