"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Clapperboard, Play, SkipForward, X } from "lucide-react";

const PLAYLIST = [
  {
    title: "Believer COD Beat Sync",
    src: "/assets/videos/editing/CODM_Sniper_BeatSync_Believer.mp4",
    description:
      "A COD sniper beat sync edit where the shots land with the song. The important part is timing: every heavy beat is treated like a kill moment, so the motion, scope cuts, and impact all feel locked to the music."
  },
  {
    title: "COD Boom Headshot",
    src: "/assets/videos/editing/CODM_BoomHeadshot_BeatSync.mp4",
    description:
      "A punchier COD edit built around headshot impact. The pacing leans on quick cuts, hit flashes, and sound emphasis so each boom feels intentional instead of random."
  },
  {
    title: "Standoff 2 Funny Moments",
    src: "/assets/videos/editing/Standoff2_FunnyMoments_V3.mp4",
    description:
      "A funny-moments edit shaped for retention: reactions, awkward timing, sudden fails, and quick trims keep the energy moving without letting the joke sit too long."
  },
  {
    title: "Standoff 2 Beat Sync",
    src: "/assets/videos/editing/Standoff2_BeatSync_Montage.mp4",
    description:
      "A Standoff 2 montage focused on rhythm and clean flow. Kills, camera movement, and transitions are placed on musical accents so the gameplay feels like part of the track."
  }
];

const TV_SOURCE = {
  left: "13.671875%",
  top: "14.599609375%",
  width: "34.521484375%",
  height: "44.04296875%"
};

const TV_PLANE = {
  topLeftY: 0.44567627494456763,
  bottomRightY: 0.5421286031042129
};

function solvePerspectiveMatrix(width: number, height: number) {
  const source = [
    [0, 0],
    [width, 0],
    [width, height],
    [0, height]
  ];
  const target = [
    [0, height * TV_PLANE.topLeftY],
    [width, 0],
    [width, height * TV_PLANE.bottomRightY],
    [0, height]
  ];
  const matrix = Array.from({ length: 8 }, (_, row) => {
    const point = Math.floor(row / 2);
    const [x, y] = source[point];
    const [targetX, targetY] = target[point];
    return row % 2 === 0
      ? [x, y, 1, 0, 0, 0, -targetX * x, -targetX * y, targetX]
      : [0, 0, 0, x, y, 1, -targetY * x, -targetY * y, targetY];
  });

  for (let column = 0; column < 8; column++) {
    let pivot = column;
    for (let row = column + 1; row < 8; row++) {
      if (Math.abs(matrix[row][column]) > Math.abs(matrix[pivot][column])) {
        pivot = row;
      }
    }

    [matrix[column], matrix[pivot]] = [matrix[pivot], matrix[column]];
    const divisor = matrix[column][column];
    if (Math.abs(divisor) < 1e-8) return "none";

    for (let col = column; col < 9; col++) {
      matrix[column][col] /= divisor;
    }
    for (let row = 0; row < 8; row++) {
      if (row === column) continue;
      const factor = matrix[row][column];
      for (let col = column; col < 9; col++) {
        matrix[row][col] -= factor * matrix[column][col];
      }
    }
  }

  const [a, e, m, b, f, n, d, h] = matrix.map((row) => row[8]);
  return `matrix3d(${a}, ${b}, 0, ${d}, ${e}, ${f}, 0, ${h}, 0, 0, 1, 0, ${m}, ${n}, 0, 1)`;
}

export function VideoRoomStage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const tvRef = useRef<HTMLButtonElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const activeIndexRef = useRef<number | null>(null);
  const clickTimerRef = useRef<number | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [showBehindScenes, setShowBehindScenes] = useState(false);
  const [showFullVideo, setShowFullVideo] = useState(false);
  const [tvTransform, setTvTransform] = useState("none");

  const activeVideo = activeIndex === null ? null : PLAYLIST[activeIndex];
  const status = useMemo(() => {
    if (activeIndex === null) return "Click Me";
    return activeVideo?.title ?? "";
  }, [activeIndex, activeVideo]);

  useEffect(() => {
    const tv = tvRef.current;
    if (!tv) return;

    const updateTransform = () => {
      const width = tv.offsetWidth;
      const height = tv.offsetHeight;
      if (width > 0 && height > 0) {
        setTvTransform(solvePerspectiveMatrix(width, height));
      }
    };

    updateTransform();
    const observer = new ResizeObserver(updateTransform);
    observer.observe(tv);
    window.addEventListener("resize", updateTransform);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateTransform);
    };
  }, []);

  function playIndex(index: number) {
    activeIndexRef.current = index;
    setActiveIndex(index);
    requestAnimationFrame(() => {
      videoRef.current?.play().catch(() => undefined);
    });
  }

  function playNextVideo() {
    const currentIndex = activeIndexRef.current;
    playIndex(currentIndex === null ? 0 : (currentIndex + 1) % PLAYLIST.length);
  }

  function handleTvClick() {
    if (clickTimerRef.current) return;
    clickTimerRef.current = window.setTimeout(() => {
      clickTimerRef.current = null;
      const currentIndex = activeIndexRef.current;
      const nextIndex = currentIndex === null ? 0 : (currentIndex + 1) % PLAYLIST.length;
      playIndex(nextIndex);
    }, 220);
  }

  function handleTvDoubleClick() {
    if (clickTimerRef.current) {
      window.clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }

    if (activeIndexRef.current === null) {
      playIndex(0);
    }
    setShowFullVideo(true);
  }

  function handleEnded() {
    const currentIndex = activeIndexRef.current;
    if (currentIndex === null) return;
    playIndex((currentIndex + 1) % PLAYLIST.length);
  }

  // subtle parallax tilt following the mouse — makes the render feel 3D
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
    <section
      className="relative h-full w-full overflow-hidden bg-[#080403]"
      onMouseMove={handleParallax}
      onMouseLeave={resetParallax}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_22%,rgba(255,120,46,0.24),transparent_28rem),radial-gradient(circle_at_74%_38%,rgba(255,208,126,0.1),transparent_24rem)]" />

      <button
        type="button"
        onClick={() => setShowBehindScenes(true)}
        className="absolute right-5 top-5 z-40 flex items-center gap-2 rounded-full border border-orange-100/25 bg-black/45 px-4 py-2 text-[0.64rem] font-bold uppercase tracking-[0.2em] text-orange-100 backdrop-blur-md transition hover:bg-orange-100 hover:text-black"
      >
        <Clapperboard size={14} />
        Behind Scenes
      </button>

      <motion.div
        className="relative z-10 grid h-full w-full place-items-center px-3"
        initial={{ opacity: 0, scale: 1.025 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.65, ease: "easeOut" }}
      >
        <div
          ref={stageRef}
          className="relative aspect-square h-[min(94vh,94vw)] max-h-[1120px] max-w-[1120px] transition-transform duration-200 ease-out will-change-transform"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/images/rooms/yt-room.png"
            alt="YouTube video room"
            className="h-full w-full select-none object-contain drop-shadow-[0_30px_90px_rgba(0,0,0,0.55)]"
            draggable={false}
          />

          <button
            ref={tvRef}
            type="button"
            aria-label="Play YouTube room TV"
            onClick={handleTvClick}
            onDoubleClick={handleTvDoubleClick}
            className="group absolute overflow-hidden bg-black/45 text-left outline-none transition duration-300 hover:brightness-125 focus-visible:ring-2 focus-visible:ring-orange-200"
            style={{
              ...TV_SOURCE,
              transform: tvTransform,
              transformOrigin: "0 0"
            }}
          >
            {activeVideo ? (
              <video
                ref={videoRef}
                key={activeVideo.src}
                src={activeVideo.src}
                muted
                playsInline
                autoPlay
                onEnded={handleEnded}
                className="h-full w-full scale-[1.1] object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(140deg,rgba(21,5,0,0.96),rgba(60,16,6,0.88),rgba(10,4,2,0.98))]">
                <div className="text-center">
                  <Play className="mx-auto mb-3 text-orange-300 drop-shadow-[0_0_16px_rgba(255,108,29,0.8)]" size={34} />
                  <p className="text-xl font-black uppercase tracking-[0.18em] text-orange-100 drop-shadow-[0_0_18px_rgba(255,105,24,0.9)] md:text-4xl">
                    Click Me
                  </p>
                </div>
              </div>
            )}

            <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.16),transparent_34%,rgba(0,0,0,0.3)_70%)] opacity-70 mix-blend-screen" />
          </button>

          <div className="pointer-events-none absolute left-[16%] top-[56%] z-20 rounded-full border border-orange-200/20 bg-black/45 px-4 py-2 text-[0.58rem] font-bold uppercase tracking-[0.18em] text-orange-100/85 shadow-[0_0_28px_rgba(255,85,12,0.25)] backdrop-blur-md md:text-xs">
            {status}
          </div>

          <div className="pointer-events-none absolute left-[16%] top-[61%] z-20 hidden rounded-full border border-white/10 bg-black/35 px-3 py-1.5 text-[0.5rem] font-bold uppercase tracking-[0.16em] text-white/55 backdrop-blur-md md:block">
            Double click for full view
          </div>
        </div>
      </motion.div>

      {showFullVideo && activeVideo && (
        <motion.div
          className="fixed inset-0 z-[90] overflow-y-auto overscroll-contain bg-black/88 px-4 py-6 backdrop-blur-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setShowFullVideo(false)}
        >
          <motion.div
            className="mx-auto mb-24 w-full max-w-6xl overflow-hidden rounded-md border border-white/15 bg-[#080604] shadow-2xl shadow-orange-500/20"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative aspect-video bg-black">
              <video key={activeVideo.src} src={activeVideo.src} controls autoPlay className="h-full w-full object-contain" />
              <button
                type="button"
                onClick={playNextVideo}
                aria-label="Play next video"
                className="absolute right-3 top-16 grid h-10 w-10 place-items-center rounded-full bg-white text-black transition hover:bg-orange-100"
              >
                <SkipForward size={18} />
              </button>
              <button
                type="button"
                onClick={() => setShowFullVideo(false)}
                aria-label="Close full video"
                className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-white text-black transition hover:bg-orange-100"
              >
                <X size={18} />
              </button>
            </div>
            <div className="border-t border-white/10 p-5 md:p-6">
              <p className="text-[0.62rem] font-bold uppercase tracking-[0.24em] text-orange-200/75">Editing breakdown</p>
              <h2 className="mt-2 text-2xl font-black uppercase tracking-wide text-white md:text-3xl">{activeVideo.title}</h2>
              <p className="mt-3 max-w-4xl text-sm leading-7 text-stone-300 md:text-base">{activeVideo.description}</p>
            </div>
          </motion.div>
        </motion.div>
      )}

      {showBehindScenes && (
        <motion.div
          className="absolute inset-0 z-[90] grid place-items-center bg-black/86 p-4 backdrop-blur-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setShowBehindScenes(false)}
        >
          <motion.div
            className="relative w-full max-w-6xl overflow-hidden rounded-md border border-white/15 bg-black shadow-2xl shadow-orange-500/20"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(event) => event.stopPropagation()}
          >
            <Image
              src="/assets/images/rooms/yt-room-behind-scenes.png"
              alt="Behind the scenes Blender setup for the YouTube room"
              width={1920}
              height={1080}
              className="h-auto max-h-[82vh] w-full object-contain"
              priority
            />
            <button
              type="button"
              onClick={() => setShowBehindScenes(false)}
              aria-label="Close behind the scenes"
              className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-white text-black transition hover:bg-orange-100"
            >
              <X size={18} />
            </button>
          </motion.div>
        </motion.div>
      )}
    </section>
  );
}
