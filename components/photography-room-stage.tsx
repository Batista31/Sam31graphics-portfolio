"use client";

import { motion } from "framer-motion";
import { useRef } from "react";
import type { CSSProperties } from "react";
import type { MediaAsset } from "@/lib/media-registry";

type PhotoPanel = {
  x: number;
  y: number;
  w: number;
  h: number;
  rotate: number;
  skewY: number;
  clipPath: string;
};

const chartPanels: PhotoPanel[] = [
  {
    x: 10.0,
    y: 29.9,
    w: 11.5,
    h: 17.0,
    rotate: -2.2,
    skewY: -1.2,
    clipPath: "polygon(8% 3%, 96% 0%, 100% 98%, 3% 100%)",
  },
  {
    x: 22.3,
    y: 29.0,
    w: 10.5,
    h: 17.0,
    rotate: -1.4,
    skewY: -0.7,
    clipPath: "polygon(7% 3%, 97% 0%, 99% 97%, 4% 100%)",
  },
  {
    x: 33.4,
    y: 27.8,
    w: 9.2,
    h: 16.9,
    rotate: -0.8,
    skewY: -0.3,
    clipPath: "polygon(6% 3%, 97% 0%, 99% 97%, 4% 100%)",
  },
  {
    x: 43.2,
    y: 27.0,
    w: 8.5,
    h: 16.3,
    rotate: -0.3,
    skewY: 0,
    clipPath: "polygon(5% 2%, 98% 0%, 99% 97%, 4% 100%)",
  },
  {
    x: 55.3,
    y: 27.4,
    w: 6.6,
    h: 15.4,
    rotate: 4.8,
    skewY: 5.6,
    clipPath: "polygon(0% 0%, 91% 6%, 96% 100%, 9% 95%)",
  },
  {
    x: 61.8,
    y: 28.0,
    w: 7.5,
    h: 17.0,
    rotate: 3.8,
    skewY: 3.4,
    clipPath: "polygon(0% 2%, 94% 6%, 98% 100%, 8% 96%)",
  },
  {
    x: 68.8,
    y: 28.3,
    w: 9.6,
    h: 19.5,
    rotate: 3.3,
    skewY: 2.6,
    clipPath: "polygon(0% 2%, 95% 6%, 98% 100%, 8% 96%)",
  },
];

export function PhotographyRoomStage({
  assets,
  onItemClick,
}: {
  assets: MediaAsset[];
  onItemClick: (src: string) => void;
}) {
  const stageRef = useRef<HTMLDivElement>(null);

  function handleParallax(event: React.MouseEvent<HTMLElement>) {
    const el = stageRef.current;
    if (!el) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const dx = (event.clientX - rect.left) / rect.width - 0.5;
    const dy = (event.clientY - rect.top) / rect.height - 0.5;
    el.style.transform = `perspective(1300px) rotateX(${(-dy * 2.2).toFixed(2)}deg) rotateY(${(dx * 2.2).toFixed(2)}deg)`;
  }

  function resetParallax() {
    if (stageRef.current) stageRef.current.style.transform = "";
  }

  return (
    <div
      className="relative grid h-screen w-screen place-items-center overflow-hidden bg-[#1f1712]"
      onMouseMove={handleParallax}
      onMouseLeave={resetParallax}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/assets/images/rooms/photo-room.jpg"
        alt=""
        className="absolute inset-0 h-full w-full scale-110 object-cover blur-2xl saturate-110"
        draggable={false}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(255,190,111,0.16),transparent_38rem),linear-gradient(180deg,rgba(34,18,10,0.32),rgba(16,10,7,0.46))]" />
      <div
        ref={stageRef}
        className="relative overflow-hidden drop-shadow-[0_30px_80px_rgba(0,0,0,0.35)] transition-transform duration-200 ease-out will-change-transform"
        style={{ width: "min(100vw, 100vh)", height: "min(100vw, 100vh)" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/assets/images/rooms/photo-room.jpg"
          alt="Photography room"
          className="absolute inset-0 h-full w-full object-contain"
          draggable={false}
        />

        {chartPanels.map((panel, index) => {
          const asset = assets[index % Math.max(assets.length, 1)];
          if (!asset) return null;

          const panelStyle: CSSProperties = {
            left: `${panel.x}%`,
            top: `${panel.y}%`,
            width: `${panel.w}%`,
            height: `${panel.h}%`,
            clipPath: panel.clipPath,
            transform: `rotate(${panel.rotate}deg) skewY(${panel.skewY}deg)`,
            transformOrigin: "50% 50%",
          };

          return (
            <motion.button
              key={`${asset.id}-${index}`}
              type="button"
              aria-label={`Open ${asset.title}`}
              className="group absolute cursor-pointer border-0 bg-transparent p-0 outline-none transition focus-visible:ring-2 focus-visible:ring-amber-200"
              style={panelStyle}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={() => onItemClick(asset.src)}
            >
              {/* hover glow so the framed photos read as clickable */}
              <span className="pointer-events-none absolute inset-0 bg-amber-100/0 shadow-[inset_0_0_0_rgba(255,210,130,0)] transition duration-300 group-hover:bg-amber-100/10 group-hover:shadow-[inset_0_0_22px_rgba(255,210,130,0.55)]" />
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
