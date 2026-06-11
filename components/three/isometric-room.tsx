"use client";

/**
 * Isometric room — static showcase, frameloop="demand" (renders only when needed).
 * Light-themed palette: warm oak floor, terracotta brick walls, cream furniture accents.
 * No character, no physics. Orthographic camera at classic isometric angle [9,9,9].
 * CanvasTexture for floor planks + brick walls — generated once, no file loading.
 */

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrthographicCamera, useTexture, useVideoTexture, Sparkles } from "@react-three/drei";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { PortfolioRegistry, MediaAsset } from "@/lib/media-registry";

// ─── Colour palette ───────────────────────────────────────────────────────────
const C = {
  floorA:    "#d49565",  // warm oak plank A
  floorB:    "#c88550",  // warm oak plank B
  floorSep:  "#8a4e28",  // plank separator
  wallA:     "#b09080",  // brick face A
  wallB:     "#a08070",  // brick face B
  mortar:    "#887060",  // mortar
  baseboard: "#5a3520",  // dark skirting board
  trim:      "#7a5535",  // wall-ceiling trim
  ceiling:   "#f4ead8",  // warm plaster ceiling
  deskDark:  "#4a2e18",  // dark walnut
  deskMed:   "#7a5030",  // medium wood
  deskLight: "#c8a870",  // light oak accent
  chairBody: "#2a2a3a",  // dark upholstery
  chairWood: "#3a2510",  // chair legs
  metal:     "#8a8a9a",  // grey metal
  screen:    "#141420",  // monitor off
  screenOn:  "#1a2060",  // monitor idle glow
  book1:     "#c03030",  // red book
  book2:     "#2050b0",  // blue book
  book3:     "#407040",  // green book
  plant:     "#4a7a38",  // leaves
  plantDark: "#2a4a20",  // dark leaves
  pot:       "#a06040",  // terracotta pot
  rug:       "#8a5a40",  // area rug
  cream:     "#f0e8d8",  // off-white
  window:    "#ffe8a0",  // warm window glow
  rgbBlue:   "#2040ff",  // PC RGB strip
  rgbRed:    "#ff2040",
};

// ─── Procedural canvas textures ───────────────────────────────────────────────

function useWoodTexture(): THREE.CanvasTexture | null {
  return useMemo(() => {
    if (typeof window === "undefined") return null;
    const size = 512;
    const cv   = document.createElement("canvas");
    cv.width = cv.height = size;
    const ctx = cv.getContext("2d")!;
    const PH  = size / 7; // plank height in px

    for (let row = 0; row < 8; row++) {
      const isAlt = row % 2 === 0;
      // plank base
      ctx.fillStyle = isAlt ? C.floorA : C.floorB;
      ctx.fillRect(0, row * PH, size, PH - 3);
      // grain lines
      ctx.strokeStyle = isAlt ? "#b87040" : "#a86030";
      ctx.lineWidth = 0.8;
      for (let g = 1; g < 6; g++) {
        const y = row * PH + g * (PH / 6);
        ctx.beginPath();
        ctx.moveTo(0, y + (Math.sin(g * row) * 1.5));
        ctx.lineTo(size, y + (Math.cos(g + row) * 1.5));
        ctx.stroke();
      }
      // separator
      ctx.fillStyle = C.floorSep;
      ctx.fillRect(0, (row + 1) * PH - 3, size, 3);
    }

    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(2, 2);
    return t;
  }, []);
}

function useBrickTexture(): THREE.CanvasTexture | null {
  return useMemo(() => {
    if (typeof window === "undefined") return null;
    const size = 512;
    const cv   = document.createElement("canvas");
    cv.width = cv.height = size;
    const ctx  = cv.getContext("2d")!;
    const BH   = 46, BW = 96, M = 6;

    // mortar background
    ctx.fillStyle = C.mortar;
    ctx.fillRect(0, 0, size, size);

    const rows = Math.ceil(size / (BH + M)) + 1;
    const cols = Math.ceil(size / (BW + M)) + 2;
    for (let row = 0; row < rows; row++) {
      const off = row % 2 === 0 ? 0 : (BW + M) / 2;
      for (let col = -1; col < cols; col++) {
        const x = col * (BW + M) + off;
        const y = row * (BH + M);
        // vary each brick slightly
        const shade = (Math.sin(col * 3.7 + row * 7.1) * 0.5 + 0.5) * 22;
        const r = Math.round(176 + shade * 0.6);
        const g = Math.round(128 + shade * 0.5);
        const b = Math.round(110 + shade * 0.4);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(x + M / 2, y + M / 2, BW - M / 2, BH - M / 2);
      }
    }

    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1.8, 1.2);
    return t;
  }, []);
}

function useCeilingTexture(): THREE.CanvasTexture | null {
  return useMemo(() => {
    if (typeof window === "undefined") return null;
    const size = 384;
    const cv = document.createElement("canvas");
    cv.width = cv.height = size;
    const ctx = cv.getContext("2d")!;

    ctx.fillStyle = C.ceiling;
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = "rgba(122, 85, 53, 0.18)";
    ctx.lineWidth = 2;
    for (let x = 0; x <= size; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, size);
      ctx.stroke();
    }
    for (let y = 0; y <= size; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(size, y);
      ctx.stroke();
    }
    for (let i = 0; i < 180; i++) {
      ctx.fillStyle = "rgba(145, 111, 78, 0.11)";
      ctx.fillRect(Math.random() * size, Math.random() * size, 1.5, 1.5);
    }

    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1.5, 1.5);
    return t;
  }, []);
}

// Dark ebony floor for photography studio mode
function useDarkWoodTexture(): THREE.CanvasTexture | null {
  return useMemo(() => {
    if (typeof window === "undefined") return null;
    const size = 512;
    const cv   = document.createElement("canvas");
    cv.width = cv.height = size;
    const ctx  = cv.getContext("2d")!;
    const PH   = size / 7;

    for (let row = 0; row < 8; row++) {
      const isAlt = row % 2 === 0;
      ctx.fillStyle = isAlt ? "#1a1218" : "#141018";
      ctx.fillRect(0, row * PH, size, PH - 3);
      ctx.strokeStyle = isAlt ? "#261c22" : "#1e1620";
      ctx.lineWidth = 0.8;
      for (let g = 1; g < 6; g++) {
        const y = row * PH + g * (PH / 6);
        ctx.beginPath();
        ctx.moveTo(0, y + Math.sin(g * row) * 1.5);
        ctx.lineTo(size, y + Math.cos(g + row) * 1.5);
        ctx.stroke();
      }
      ctx.fillStyle = "#0a0810";
      ctx.fillRect(0, (row + 1) * PH - 3, size, 3);
    }

    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(2, 2);
    return t;
  }, []);
}

// Deep charcoal wall for photography studio mode
function useDarkWallTexture(): THREE.CanvasTexture | null {
  return useMemo(() => {
    if (typeof window === "undefined") return null;
    const size = 512;
    const cv   = document.createElement("canvas");
    cv.width = cv.height = size;
    const ctx  = cv.getContext("2d")!;

    ctx.fillStyle = "#1c1828";
    ctx.fillRect(0, 0, size, size);

    // Subtle concrete-plaster noise
    for (let i = 0; i < 8000; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const v = Math.random() * 12;
      ctx.fillStyle = `rgba(${18 + v},${14 + v},${32 + v},0.25)`;
      ctx.fillRect(x, y, 1, 1);
    }

    // Very faint vertical panel seams
    ctx.strokeStyle = "rgba(80,60,120,0.09)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= size; x += 102) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, size);
      ctx.stroke();
    }

    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1.5, 1.2);
    return t;
  }, []);
}

// ─── Canvas root ─────────────────────────────────────────────────────────────

export function IsometricRoom({
  roomId,
  registry,
  onItemClick,
}: {
  roomId: string;
  registry: PortfolioRegistry;
  onItemClick: (src: string) => void;
}) {
  return (
    <Canvas
      frameloop="demand"                        // only render on change — static scene
      shadows={{ type: THREE.BasicShadowMap }}
      dpr={[0.85, 1]}
      gl={{ antialias: true, alpha: false, powerPreference: "default" }}
    >
      <IsoCamera />
      <color attach="background" args={["#2e2a38"]} />

      <Suspense fallback={null}>
        <IsometricScene roomId={roomId} registry={registry} onItemClick={onItemClick} />
      </Suspense>

      <EffectComposer multisampling={0}>
        <Bloom mipmapBlur intensity={0.35} luminanceThreshold={0.4} />
        <Vignette eskil={false} offset={0.25} darkness={0.55} />
      </EffectComposer>
    </Canvas>
  );
}

// ─── Isometric camera setup ───────────────────────────────────────────────────

function IsoCamera() {
  const camRef = useRef<THREE.OrthographicCamera>(null!);
  const { invalidate } = useThree();

  useEffect(() => {
    if (camRef.current) {
      camRef.current.lookAt(0, 0, 0);
      camRef.current.updateProjectionMatrix();
      invalidate();
    }
  }, [invalidate]);

  return <OrthographicCamera ref={camRef} makeDefault position={[9, 9, 9]} zoom={52} near={0.1} far={200} />;
}

// ─── Isometric scene ──────────────────────────────────────────────────────────

function IsometricScene({
  roomId,
  registry,
  onItemClick,
}: {
  roomId: string;
  registry: PortfolioRegistry;
  onItemClick: (src: string) => void;
}) {
  const assets = useMemo(() => {
    if (roomId === "video")      return registry.editing;
    if (roomId === "photo")      return registry.photography;
    if (roomId === "blender")    return registry.blender;
    if (roomId === "thumbnails") return registry.thumbnails;
    return registry.travel;
  }, [roomId, registry]);

  const isPhoto = roomId === "photo";

  return (
    <>
      {/* ── Lighting — warm cosy for most rooms, dark studio for photo ── */}
      {isPhoto ? (
        <>
          <ambientLight intensity={0.12} color="#0c0818" />
          <directionalLight castShadow position={[6, 10, 6]} intensity={0.60} color="#fff0e0"
            shadow-mapSize={[512, 512]}
            shadow-camera-left={-8} shadow-camera-right={8}
            shadow-camera-top={8}  shadow-camera-bottom={-8}
            shadow-bias={-0.001} />
          {/* Cool blue rim from behind */}
          <directionalLight position={[-4, 5, -5]} intensity={0.08} color="#1540cc" />
        </>
      ) : (
        <>
          <ambientLight intensity={0.72} color="#ffe8cc" />
          <directionalLight castShadow position={[6, 10, 6]} intensity={1.0} color="#fff6e8"
            shadow-mapSize={[512, 512]}
            shadow-camera-left={-8} shadow-camera-right={8}
            shadow-camera-top={8}  shadow-camera-bottom={-8}
            shadow-bias={-0.001} />
          <directionalLight position={[-4, 5, -5]} intensity={0.28} color="#d8e8ff" />
          <directionalLight position={[3, 1, 5]} intensity={0.15} color="#ffd8a0" />
        </>
      )}

      {/* Room geometry + furniture */}
      <RoomBase dark={isPhoto} />
      <RoomVariant roomId={roomId} assets={assets} onItemClick={onItemClick} />

      {/* Atmospheric particles */}
      <Sparkles
        count={isPhoto ? 30 : 60}
        speed={0}
        size={isPhoto ? 1.6 : 0.9}
        color={isPhoto ? "#c8a020" : "#ffe0a0"}
        opacity={isPhoto ? 0.09 : 0.28}
        scale={[6, 3.5, 6]}
        position={[0, 2, 0]}
      />
    </>
  );
}

// ─── Room base: floor + two walls + trims + window ───────────────────────────
// Camera at [9,9,9]:  left wall = world x=-3.5 (faces +X), back wall = world z=-3.5 (faces +Z)

function RoomBase({ dark = false }: { dark?: boolean }) {
  const woodTex     = useWoodTexture();
  const darkWoodTex = useDarkWoodTexture();
  const brickTex    = useBrickTexture();
  const darkWallTex = useDarkWallTexture();
  const ceilingTex  = useCeilingTexture();

  const floorTex    = dark ? darkWoodTex  : woodTex;
  const wallTex     = dark ? darkWallTex  : brickTex;
  const baseboardClr = dark ? "#0c0a18"  : C.baseboard;
  const trimClr      = dark ? "#1e1830"  : C.trim;
  const ceilClr      = dark ? "#0e0d1a"  : C.ceiling;

  return (
    <group>
      {/* ── Floor ── */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]}>
        <planeGeometry args={[7, 7]} />
        {floorTex
          ? <meshStandardMaterial map={floorTex} roughness={0.62} metalness={dark ? 0.08 : 0.05} />
          : <meshStandardMaterial color={dark ? "#1a1218" : C.floorA} roughness={0.65} />}
      </mesh>

      {/* ── Left wall (x = -3.5, faces +X toward viewer) ── */}
      <mesh receiveShadow position={[-3.5, 2, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[7, 4]} />
        {wallTex
          ? <meshStandardMaterial map={wallTex} roughness={0.86} />
          : <meshStandardMaterial color={dark ? "#1c1828" : C.wallA} roughness={0.88} />}
      </mesh>

      {/* ── Back wall (z = -3.5, faces +Z toward viewer) ── */}
      <mesh receiveShadow position={[0, 2, -3.5]}>
        <planeGeometry args={[7, 4]} />
        {wallTex
          ? <meshStandardMaterial map={wallTex} roughness={0.86} />
          : <meshStandardMaterial color={dark ? "#1c1828" : C.wallA} roughness={0.88} />}
      </mesh>

      {/* ── Baseboards ── */}
      <mesh position={[-3.42, 0.2, 0]} rotation={[0, Math.PI/2, 0]}>
        <boxGeometry args={[7, 0.4, 0.08]} />
        <meshStandardMaterial color={baseboardClr} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.2, -3.42]}>
        <boxGeometry args={[7, 0.4, 0.08]} />
        <meshStandardMaterial color={baseboardClr} roughness={0.7} />
      </mesh>

      {/* ── Ceiling trim ── */}
      <mesh position={[-3.42, 3.92, 0]} rotation={[0, Math.PI/2, 0]}>
        <boxGeometry args={[7, 0.16, 0.12]} />
        <meshStandardMaterial color={trimClr} roughness={0.65} />
      </mesh>
      <mesh position={[0, 3.92, -3.42]}>
        <boxGeometry args={[7, 0.16, 0.12]} />
        <meshStandardMaterial color={trimClr} roughness={0.65} />
      </mesh>

      <group position={[0, 4.06, 0]}>
        {([
          { p: [0, 0, -3.05] as [number, number, number], s: [7.2, 0.12, 0.8] as [number, number, number] },
          { p: [-3.05, 0, 0] as [number, number, number], s: [0.8, 0.12, 7.2] as [number, number, number] },
          { p: [0, 0, 3.05] as [number, number, number], s: [7.2, 0.12, 0.8] as [number, number, number] },
          { p: [3.05, 0, 0] as [number, number, number], s: [0.8, 0.12, 7.2] as [number, number, number] },
        ]).map((panel, i) => (
          <mesh key={i} receiveShadow position={panel.p} scale={panel.s}>
            <boxGeometry />
            {(ceilingTex && !dark)
              ? <meshStandardMaterial map={ceilingTex} color={ceilClr} roughness={0.78} />
              : <meshStandardMaterial color={ceilClr} roughness={0.78} />}
          </mesh>
        ))}
        {[-2.2, 0, 2.2].map((x) => (
          <mesh key={x} castShadow position={[x, -0.04, 0]}>
            <boxGeometry args={[0.12, 0.16, 7.1]} />
            <meshStandardMaterial color={trimClr} roughness={0.62} />
          </mesh>
        ))}
        {[-2.2, 0, 2.2].map((z) => (
          <mesh key={z} castShadow position={[0, -0.05, z]}>
            <boxGeometry args={[7.1, 0.13, 0.1]} />
            <meshStandardMaterial color={trimClr} roughness={0.62} />
          </mesh>
        ))}
      </group>

      {/* ── Window on LEFT wall ── */}
      <Window dark={dark} />
    </group>
  );
}

// ─── Window ───────────────────────────────────────────────────────────────────

function Window({ dark = false }: { dark?: boolean }) {
  const glowColor  = dark ? "#2040a8" : C.window;
  const lightColor = dark ? "#3055cc" : "#ffe090";
  return (
    <group position={[-3.35, 2.4, 1.2]}>
      {/* Glow pane (warm sunlight or cool moonlight) */}
      <mesh rotation={[0, Math.PI / 2, 0]} position={[0.01, 0, 0]}>
        <planeGeometry args={[1.2, 1.1]} />
        <meshBasicMaterial color={glowColor} transparent opacity={dark ? 0.70 : 0.88} side={THREE.FrontSide} />
      </mesh>
      {/* Frame bars */}
      {([
        { p:[0.06,  0.58, 0] as [number,number,number], s:[0.06, 0.1,  1.26] as [number,number,number] },
        { p:[0.06, -0.58, 0] as [number,number,number], s:[0.06, 0.1,  1.26] as [number,number,number] },
        { p:[0.06, 0,  0.65] as [number,number,number], s:[0.06, 1.16, 0.1 ] as [number,number,number] },
        { p:[0.06, 0, -0.65] as [number,number,number], s:[0.06, 1.16, 0.1 ] as [number,number,number] },
        { p:[0.06, 0,  0   ] as [number,number,number], s:[0.06, 1.16, 0.06] as [number,number,number] },
      ] as const).map((b, i) => (
        <mesh key={i} position={b.p} scale={b.s}>
          <boxGeometry />
          <meshStandardMaterial color={dark ? "#2a2838" : C.cream} roughness={0.6} />
        </mesh>
      ))}
      <pointLight color={lightColor} intensity={dark ? 1.6 : 2.2} distance={6} position={[1, 0, 0]} />
    </group>
  );
}

// ─── Room variant router ──────────────────────────────────────────────────────

function RoomVariant({ roomId, assets, onItemClick }: { roomId: string; assets: MediaAsset[]; onItemClick: (s: string) => void }) {
  switch (roomId) {
    case "video":      return <VideoRoom      assets={assets} onItemClick={onItemClick} />;
    case "photo":      return <PhotoRoom      assets={assets} onItemClick={onItemClick} />;
    case "blender":    return <BlenderRoom    assets={assets} onItemClick={onItemClick} />;
    case "thumbnails": return <ThumbnailRoom  assets={assets} onItemClick={onItemClick} />;
    case "secret":     return <SecretRoom     assets={assets} onItemClick={onItemClick} />;
    default:           return null;
  }
}

// ─── Shared furniture primitives ─────────────────────────────────────────────

function Desk({ pos, w = 2.4, d = 0.9 }: { pos: [number,number,number]; w?: number; d?: number }) {
  return (
    <group position={pos}>
      {/* Top */}
      <mesh castShadow receiveShadow position={[0, 0.46, 0]}>
        <boxGeometry args={[w, 0.07, d]} />
        <meshStandardMaterial color={C.deskDark} roughness={0.6} />
      </mesh>
      {/* Legs */}
      {([
        [-w/2+0.1,  d/2-0.1],
        [ w/2-0.1,  d/2-0.1],
        [-w/2+0.1, -d/2+0.1],
        [ w/2-0.1, -d/2+0.1],
      ] as [number,number][]).map(([x, z], i) => (
        <mesh key={i} castShadow position={[x, 0.22, z]}>
          <boxGeometry args={[0.07, 0.44, 0.07]} />
          <meshStandardMaterial color={C.deskDark} roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
}

function Monitor({ pos, src, onItemClick }: { pos: [number,number,number]; src?: string; onItemClick?: (s: string) => void }) {
  const hasSrc = !!src;
  return (
    <group position={pos} onClick={hasSrc && onItemClick ? () => onItemClick(src!) : undefined}
      onPointerEnter={hasSrc ? () => { document.body.style.cursor = "pointer"; } : undefined}
      onPointerLeave={hasSrc ? () => { document.body.style.cursor = ""; } : undefined}>
      {/* Screen panel */}
      <mesh castShadow>
        <boxGeometry args={[1.3, 0.82, 0.07]} />
        <meshStandardMaterial color={C.screen} roughness={0.5} />
      </mesh>
      {/* Screen display */}
      {hasSrc
        ? <ScreenAsset src={src!} w={1.18} h={0.7} />
        : <mesh position={[0, 0, 0.04]}>
            <planeGeometry args={[1.18, 0.7]} />
            <meshBasicMaterial color={C.screenOn} />
          </mesh>}
      {/* Stand */}
      <mesh castShadow position={[0, -0.58, 0]}>
        <boxGeometry args={[0.08, 0.34, 0.08]} />
        <meshStandardMaterial color={C.metal} roughness={0.5} />
      </mesh>
      <mesh castShadow position={[0, -0.76, 0]}>
        <boxGeometry args={[0.38, 0.04, 0.22]} />
        <meshStandardMaterial color={C.metal} roughness={0.5} />
      </mesh>
    </group>
  );
}

function ScreenAsset({ src, w, h }: { src: string; w: number; h: number }) {
  const isVideo = src.match(/\.(mp4|mov|webm)$/i);
  return isVideo
    ? <VideoScreenMesh src={src} w={w} h={h} />
    : <ImageScreenMesh src={src} w={w} h={h} />;
}

function VideoScreenMesh({ src, w, h }: { src: string; w: number; h: number }) {
  const tex = useVideoTexture(src, { muted: true, loop: true, start: true });
  return (
    <mesh position={[0, 0, 0.04]}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  );
}

function ImageScreenMesh({ src, w, h }: { src: string; w: number; h: number }) {
  const tex = useTexture(src);
  return (
    <mesh position={[0, 0, 0.04]}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  );
}

function Chair({ pos, rot = 0 }: { pos: [number,number,number]; rot?: number }) {
  return (
    <group position={pos} rotation={[0, rot, 0]}>
      {/* Seat */}
      <mesh castShadow position={[0, 0.48, 0]}>
        <boxGeometry args={[0.56, 0.06, 0.52]} />
        <meshStandardMaterial color={C.chairBody} roughness={0.8} />
      </mesh>
      {/* Back cushion */}
      <mesh castShadow position={[0, 0.9, -0.22]}>
        <boxGeometry args={[0.54, 0.66, 0.08]} />
        <meshStandardMaterial color={C.chairBody} roughness={0.8} />
      </mesh>
      {/* Legs (4 points) */}
      {([ [-0.2, 0.2], [0.2, 0.2], [-0.2, -0.2], [0.2, -0.2] ] as [number,number][]).map(([x, z], i) => (
        <mesh key={i} castShadow position={[x, 0.22, z]}>
          <cylinderGeometry args={[0.025, 0.025, 0.44, 6]} />
          <meshStandardMaterial color={C.metal} roughness={0.4} />
        </mesh>
      ))}
      {/* Central pole */}
      <mesh castShadow position={[0, 0.22, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.44, 8]} />
        <meshStandardMaterial color={C.metal} roughness={0.4} />
      </mesh>
    </group>
  );
}

function Shelf({ pos, w = 1.2, shelves = 3 }: { pos: [number,number,number]; w?: number; shelves?: number }) {
  const h = shelves * 0.55;
  return (
    <group position={pos}>
      {/* Back panel */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[w, h, 0.08]} />
        <meshStandardMaterial color={C.deskLight} roughness={0.65} />
      </mesh>
      {/* Shelf boards */}
      {Array.from({ length: shelves + 1 }).map((_, i) => (
        <mesh key={i} castShadow position={[0, -h / 2 + i * (h / shelves), 0.14]}>
          <boxGeometry args={[w, 0.05, 0.3]} />
          <meshStandardMaterial color={C.deskDark} roughness={0.6} />
        </mesh>
      ))}
      {/* Books on middle shelves */}
      {Array.from({ length: shelves - 1 }).map((_, row) => {
        const books = [C.book1, C.book2, C.book3, C.deskMed, C.book1];
        return books.slice(0, 4).map((col, bi) => (
          <mesh key={`${row}-${bi}`} castShadow
            position={[-w/2 + 0.1 + bi * (w / 4.5), -h/2 + (row + 1) * (h/shelves) + 0.15, 0.17]}>
            <boxGeometry args={[w/5.5, 0.25, 0.22]} />
            <meshStandardMaterial color={col} roughness={0.75} />
          </mesh>
        ));
      })}
    </group>
  );
}

function Plant({ pos, scale = 1 }: { pos: [number,number,number]; scale?: number }) {
  return (
    <group position={pos} scale={scale}>
      {/* Pot */}
      <mesh castShadow position={[0, 0.14, 0]}>
        <cylinderGeometry args={[0.17, 0.13, 0.28, 10]} />
        <meshStandardMaterial color={C.pot} roughness={0.7} />
      </mesh>
      {/* Soil */}
      <mesh position={[0, 0.29, 0]}>
        <cylinderGeometry args={[0.15, 0.15, 0.04, 10]} />
        <meshStandardMaterial color="#3a2010" roughness={0.9} />
      </mesh>
      {/* Stem + leaves (layered cones) */}
      {([0.18, 0.35, 0.5] as const).map((y, i) => (
        <mesh key={i} castShadow position={[0, y + 0.3, 0]}>
          <coneGeometry args={[0.28 - i * 0.06, 0.22, 8]} />
          <meshStandardMaterial color={i % 2 === 0 ? C.plant : C.plantDark} roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

function WallFrame({ pos, rot = 0, src, onItemClick }: {
  pos: [number,number,number]; rot?: number; src?: string; onItemClick?: (s: string) => void;
}) {
  const hasSrc = !!src;
  return (
    <group position={pos} rotation={[0, rot, 0]}
      onClick={hasSrc && onItemClick ? () => onItemClick(src!) : undefined}
      onPointerEnter={hasSrc ? () => { document.body.style.cursor = "pointer"; } : undefined}
      onPointerLeave={hasSrc ? () => { document.body.style.cursor = ""; } : undefined}>
      {/* Frame border */}
      <mesh castShadow>
        <boxGeometry args={[0.96, 0.72, 0.05]} />
        <meshStandardMaterial color={C.deskDark} roughness={0.65} />
      </mesh>
      {hasSrc
        ? <ScreenAsset src={src!} w={0.84} h={0.6} />
        : <mesh position={[0, 0, 0.03]}>
            <planeGeometry args={[0.84, 0.6]} />
            <meshBasicMaterial color={C.cream} />
          </mesh>}
    </group>
  );
}

function Keyboard({ pos }: { pos: [number,number,number] }) {
  return (
    <mesh castShadow position={pos}>
      <boxGeometry args={[0.7, 0.025, 0.26]} />
      <meshStandardMaterial color="#222230" roughness={0.9} />
    </mesh>
  );
}

function PCTower({ pos, rgb = C.rgbBlue }: { pos: [number,number,number]; rgb?: string }) {
  return (
    <group position={pos}>
      <mesh castShadow>
        <boxGeometry args={[0.24, 0.52, 0.48]} />
        <meshStandardMaterial color="#181820" roughness={0.7} />
      </mesh>
      {/* RGB strip */}
      <mesh position={[0.13, 0.1, 0]}>
        <boxGeometry args={[0.02, 0.22, 0.46]} />
        <meshStandardMaterial color="#000" emissive={rgb} emissiveIntensity={2.5} />
      </mesh>
    </group>
  );
}

function Rug({ pos, w = 2.6, d = 2.0, color = C.rug }: { pos: [number,number,number]; w?: number; d?: number; color?: string }) {
  return (
    <group position={pos}>
      <mesh receiveShadow rotation={[-Math.PI/2, 0, 0]} position={[0, 0.003, 0]}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color={color} roughness={0.88} />
      </mesh>
      {/* Border trim */}
      <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, 0.004, 0]}>
        <ringGeometry args={[Math.min(w,d)/2 - 0.1, Math.min(w,d)/2, 4, 1, Math.PI/4]} />
        <meshBasicMaterial color={C.deskDark} transparent opacity={0.55} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function ShowcaseStand({
  pos,
  rot = 0,
  src,
  onItemClick,
  wide = true,
}: {
  pos: [number,number,number];
  rot?: number;
  src?: string;
  onItemClick?: (s: string) => void;
  wide?: boolean;
}) {
  if (!src) return null;
  const w = wide ? 1.7 : 1.05;
  const h = wide ? 0.95 : 1.4;

  return (
    <group
      position={pos}
      rotation={[0, rot, 0]}
      onClick={onItemClick ? () => onItemClick(src) : undefined}
      onPointerEnter={() => { document.body.style.cursor = "pointer"; }}
      onPointerLeave={() => { document.body.style.cursor = ""; }}
    >
      <mesh castShadow position={[0, 0.58, 0]}>
        <boxGeometry args={[w + 0.16, h + 0.16, 0.08]} />
        <meshStandardMaterial color={C.deskDark} roughness={0.62} />
      </mesh>
      <group position={[0, 0.58, 0.055]}>
        <ScreenAsset src={src} w={w} h={h} />
      </group>
      <mesh castShadow receiveShadow position={[0, -0.08, -0.04]}>
        <boxGeometry args={[w + 0.42, 0.16, 0.42]} />
        <meshStandardMaterial color={C.deskMed} roughness={0.68} />
      </mesh>
      <mesh castShadow position={[0, 0.22, -0.04]}>
        <boxGeometry args={[0.12, 0.6, 0.12]} />
        <meshStandardMaterial color={C.metal} roughness={0.45} metalness={0.25} />
      </mesh>
      <pointLight color="#fff0cc" intensity={1.1} distance={2.6} position={[0, 1.45, 0.25]} />
    </group>
  );
}

// ─── VIDEO EDITING ROOM ───────────────────────────────────────────────────────

function VideoRoom({ assets, onItemClick }: { assets: MediaAsset[]; onItemClick: (s: string) => void }) {
  return (
    <group>
      <ShowcaseStand pos={[1.55, 0.35, 1.15]} rot={-0.58} src={assets[0]?.src} onItemClick={onItemClick} />
      {/* Main L-desk against left + back walls */}
      <Desk pos={[-1.8, 0, -2.6]} w={2.8} d={0.92} />
      {/* Feature monitor — center above desk */}
      <Monitor pos={[-1.8, 1.38, -2.92]} src={assets[0]?.src} onItemClick={onItemClick} />
      {/* Side monitors */}
      {assets.slice(1, 3).map((a, i) => (
        <Monitor key={a.id} pos={[-3.0 + i * 2.6, 1.32, -2.88]} src={a.src} onItemClick={onItemClick} />
      ))}
      <Keyboard pos={[-1.8, 0.5, -2.45]} />
      <PCTower pos={[-3.2, 0.28, -2.5]} rgb={C.rgbBlue} />
      {/* Headphones on hook */}
      <mesh castShadow position={[-3.4, 1.65, -3.35]}>
        <torusGeometry args={[0.12, 0.025, 8, 16, Math.PI]} />
        <meshStandardMaterial color={C.metal} roughness={0.5} />
      </mesh>
      {/* Gaming chair */}
      <Chair pos={[-1.8, 0, -1.7]} rot={Math.PI} />
      {/* Shelf with game cases on back wall */}
      <Shelf pos={[1.8, 1.5, -3.42]} w={1.6} shelves={2} />
      {/* Small TV / extra screen on back wall */}
      {assets[3] && <WallFrame pos={[0.1, 2.0, -3.42]} src={assets[3].src} onItemClick={onItemClick} />}
      {/* Neon LED strip behind desk — emissive */}
      <mesh position={[-1.8, 0.78, -3.15]}>
        <boxGeometry args={[2.8, 0.03, 0.03]} />
        <meshStandardMaterial color="#000" emissive="#ff3080" emissiveIntensity={2.8} />
      </mesh>
      <Plant pos={[-3.2, 0, -0.8]} scale={0.82} />
      <Rug pos={[-0.8, 0, -1.0]} w={2.2} d={1.8} color="#4a3028" />
    </group>
  );
}

// ─── Photography studio props ────────────────────────────────────────────────

function RingLight({ pos }: { pos: [number, number, number] }) {
  return (
    <group position={pos}>
      {/* Outer glowing ring */}
      <mesh position={[0, 1.58, 0]}>
        <torusGeometry args={[0.44, 0.048, 12, 44]} />
        <meshStandardMaterial color="#111" emissive="#fff4e0" emissiveIntensity={4.5} />
      </mesh>
      {/* Inner accent ring */}
      <mesh position={[0, 1.58, 0]}>
        <torusGeometry args={[0.36, 0.022, 10, 44]} />
        <meshStandardMaterial color="#000" emissive="#ffcc80" emissiveIntensity={1.8} />
      </mesh>
      {/* Dark center glass */}
      <mesh position={[0, 1.58, 0]}>
        <circleGeometry args={[0.40, 28]} />
        <meshBasicMaterial color="#060608" transparent opacity={0.85} />
      </mesh>
      {/* Stand pole */}
      <mesh castShadow position={[0, 0.82, 0]}>
        <cylinderGeometry args={[0.014, 0.014, 1.64, 8]} />
        <meshStandardMaterial color={C.metal} roughness={0.4} />
      </mesh>
      {/* Three-leg base */}
      {([0, (Math.PI * 2) / 3, (Math.PI * 4) / 3] as const).map((a, i) => (
        <mesh key={i} castShadow position={[Math.sin(a) * 0.24, 0.04, Math.cos(a) * 0.24]}>
          <cylinderGeometry args={[0.01, 0.01, 0.46, 6]} />
          <meshStandardMaterial color={C.metal} roughness={0.4} />
        </mesh>
      ))}
      {/* Diffuse light from ring face */}
      <pointLight color="#fff8f0" intensity={4.0} distance={5.5} position={[0, 1.58, 0.5]} />
    </group>
  );
}

function Softbox({ pos }: { pos: [number, number, number] }) {
  return (
    <group position={pos}>
      {/* Front diffuser panel — emissive white */}
      <mesh castShadow position={[0, 1.88, 0]} rotation={[0.22, 0.15, 0]}>
        <boxGeometry args={[0.64, 0.46, 0.06]} />
        <meshStandardMaterial color="#fff8f0" emissive="#fff4e8" emissiveIntensity={2.0} roughness={0.3} />
      </mesh>
      {/* Back housing — matte black */}
      <mesh position={[0, 1.88, -0.05]} rotation={[0.22, 0.15, 0]}>
        <boxGeometry args={[0.68, 0.50, 0.05]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.72} />
      </mesh>
      {/* Stand */}
      <mesh castShadow position={[0, 0.96, 0]}>
        <cylinderGeometry args={[0.014, 0.014, 1.92, 8]} />
        <meshStandardMaterial color={C.metal} roughness={0.4} />
      </mesh>
      {/* Counterweight */}
      <mesh castShadow position={[0, 0.07, 0]}>
        <cylinderGeometry args={[0.16, 0.19, 0.14, 8]} />
        <meshStandardMaterial color="#222" roughness={0.7} />
      </mesh>
      <pointLight color="#fff4e0" intensity={3.2} distance={5.5} position={[0, 1.88, 0.45]} />
    </group>
  );
}

function FilmStrip({ pos, rot = 0 }: { pos: [number, number, number]; rot?: number }) {
  return (
    <group position={pos} rotation={[0, rot, 0]}>
      {/* Strip body */}
      <mesh>
        <boxGeometry args={[2.6, 0.52, 0.04]} />
        <meshStandardMaterial color="#080808" roughness={0.82} />
      </mesh>
      {/* Perforations — top */}
      {Array.from({ length: 9 }).map((_, i) => (
        <mesh key={`t${i}`} position={[-1.12 + i * 0.28, 0.22, 0.026]}>
          <boxGeometry args={[0.12, 0.07, 0.02]} />
          <meshStandardMaterial color="#1c1c1c" roughness={0.9} />
        </mesh>
      ))}
      {/* Perforations — bottom */}
      {Array.from({ length: 9 }).map((_, i) => (
        <mesh key={`b${i}`} position={[-1.12 + i * 0.28, -0.22, 0.026]}>
          <boxGeometry args={[0.12, 0.07, 0.02]} />
          <meshStandardMaterial color="#1c1c1c" roughness={0.9} />
        </mesh>
      ))}
      {/* Frame windows — faintly emissive purple */}
      {Array.from({ length: 5 }).map((_, i) => (
        <mesh key={`f${i}`} position={[-1.04 + i * 0.52, 0, 0.026]}>
          <boxGeometry args={[0.42, 0.30, 0.02]} />
          <meshStandardMaterial color="#16162a" emissive="#2a1650" emissiveIntensity={0.65} roughness={0.6} />
        </mesh>
      ))}
      {/* Gold border accent */}
      <mesh position={[0, 0, 0.016]}>
        <boxGeometry args={[2.62, 0.54, 0.02]} />
        <meshStandardMaterial color="#c9a020" emissive="#c9a020" emissiveIntensity={0.2} transparent opacity={0.22} />
      </mesh>
    </group>
  );
}

function LensCollection({ pos }: { pos: [number, number, number] }) {
  const lenses = [
    { dx: -0.28, r: 0.062, h: 0.16, dark: "#1a1a1a" },
    { dx:  0.00, r: 0.052, h: 0.22, dark: "#141414" },
    { dx:  0.26, r: 0.040, h: 0.12, dark: "#1e1e1e" },
  ];
  return (
    <group position={pos}>
      {lenses.map((l, i) => (
        <group key={i} position={[l.dx, l.h / 2, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[l.r, l.r * 0.88, l.h, 14]} />
            <meshStandardMaterial color={l.dark} roughness={0.28} metalness={0.55} />
          </mesh>
          {/* Front lens glass */}
          <mesh position={[0, l.h / 2 + 0.005, 0]}>
            <circleGeometry args={[l.r * 0.78, 14]} />
            <meshStandardMaterial color="#0a1220" roughness={0.05} metalness={0.35} transparent opacity={0.88} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ─── PHOTOGRAPHY ROOM ─────────────────────────────────────────────────────────

function PhotoRoom({ assets, onItemClick }: { assets: MediaAsset[]; onItemClick: (s: string) => void }) {
  return (
    <group>
      {/* ── Moody studio lighting ── */}
      {/* Warm gold key — over the gallery wall */}
      <pointLight color="#c8a010" intensity={3.5} distance={5.5} position={[0, 3.6, -2.8]} />
      {/* Cool blue rim from back-left corner */}
      <pointLight color="#1840cc" intensity={1.6} distance={6.5} position={[-3, 2.4, -1.5]} />
      {/* Warm fill over camera area */}
      <pointLight color="#ff9060" intensity={1.2} distance={4} position={[0.4, 3.0, 0.2]} />

      {/* ── Hero: camera on tripod, centre-stage ── */}
      <CameraOnTripod pos={[0.4, 0, -0.6]} />

      {/* ── Ring light — just left of camera ── */}
      <RingLight pos={[-1.3, 0, -0.2]} />

      {/* ── Softbox — right side ── */}
      <Softbox pos={[2.7, 0, -0.9]} />

      {/* ── Gallery wall — back wall, dark matte frames ── */}
      {assets.slice(0, 4).map((a, i) => (
        <WallFrame
          key={a.id}
          pos={[-2.4 + i * 1.62, 2.25, -3.4]}
          src={a.src}
          onItemClick={onItemClick}
        />
      ))}
      {/* Extra photo on left wall */}
      {assets[4] && (
        <WallFrame key={assets[4].id} pos={[-3.38, 2.3, -1.4]} rot={Math.PI / 2} src={assets[4].src} onItemClick={onItemClick} />
      )}

      {/* ── Film strip decoration on left wall ── */}
      <FilmStrip pos={[-3.38, 1.26, 0.9]} rot={Math.PI / 2} />

      {/* ── Lens table ── */}
      <Desk pos={[-2.3, 0, -1.6]} w={1.5} d={0.72} />
      <LensCollection pos={[-2.3, 0.5, -1.6]} />

      {/* Stool beside table */}
      <mesh castShadow position={[-2.3, 0.44, -0.85]}>
        <cylinderGeometry args={[0.22, 0.18, 0.06, 10]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.7} />
      </mesh>
      <mesh castShadow position={[-2.3, 0.22, -0.85]}>
        <cylinderGeometry args={[0.025, 0.025, 0.44, 6]} />
        <meshStandardMaterial color={C.metal} roughness={0.4} />
      </mesh>

      {/* ── Dark backdrop stand — back-right ── */}
      <mesh castShadow position={[2.4, 1.6, -3.1]}>
        <boxGeometry args={[2.0, 3.2, 0.04]} />
        <meshStandardMaterial color="#0d0d14" roughness={0.9} />
      </mesh>
      {/* Backdrop pole */}
      <mesh castShadow position={[2.4, 3.28, -3.05]}>
        <cylinderGeometry args={[0.014, 0.014, 2.1, 8]} rotation-z={Math.PI / 2} />
        <meshStandardMaterial color={C.metal} roughness={0.4} />
      </mesh>

      {/* Dark rug under camera area */}
      <Rug pos={[0.4, 0, 0.3]} w={2.8} d={2.4} color="#0f0e18" />

      {/* Small dark plant — subtle */}
      <Plant pos={[3.1, 0, 2.5]} scale={0.88} />
    </group>
  );
}

function CameraOnTripod({ pos }: { pos: [number,number,number] }) {
  return (
    <group position={pos}>
      {/* Tripod legs */}
      {([0, Math.PI * 2/3, Math.PI * 4/3] as const).map((a, i) => (
        <mesh key={i} castShadow position={[Math.sin(a) * 0.3, 0.5, Math.cos(a) * 0.3]}
          rotation={[Math.atan2(0.6, 0.3) - Math.PI/2, a, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 1.1, 6]} />
          <meshStandardMaterial color={C.metal} roughness={0.4} />
        </mesh>
      ))}
      {/* Camera body */}
      <mesh castShadow position={[0, 1.1, 0]}>
        <boxGeometry args={[0.32, 0.22, 0.2]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.5} metalness={0.4} />
      </mesh>
      <mesh castShadow position={[0.14, 1.1, 0]}>
        <cylinderGeometry args={[0.07, 0.06, 0.18, 10]} rotation-x={Math.PI/2} />
        <meshStandardMaterial color="#0d0d0d" roughness={0.4} metalness={0.5} />
      </mesh>
    </group>
  );
}

// ─── BLENDER / 3D ROOM ────────────────────────────────────────────────────────

function BlenderRoom({ assets, onItemClick }: { assets: MediaAsset[]; onItemClick: (s: string) => void }) {
  return (
    <group>
      {/* ── Blender-brand accent lighting ── */}
      <pointLight color="#7030ff" intensity={2.8} distance={6} position={[0, 3.5, -1]} />
      <pointLight color="#ff6030" intensity={1.4} distance={5} position={[2.8, 2.5, 1]} />

      {/* ── Hero showcase: big render on back wall, centre ── */}
      {assets[0] && (
        <group
          onClick={() => onItemClick(assets[0].src)}
          onPointerEnter={() => { document.body.style.cursor = "pointer"; }}
          onPointerLeave={() => { document.body.style.cursor = ""; }}
        >
          {/* Oversized frame */}
          <mesh castShadow position={[0, 2.2, -3.42]}>
            <boxGeometry args={[3.2, 2.0, 0.06]} />
            <meshStandardMaterial color="#1a0d2e" roughness={0.55} />
          </mesh>
          <ScreenAsset src={assets[0].src} w={3.0} h={1.86} />
          {/* Glow strip below */}
          <mesh position={[0, 1.2, -3.42]}>
            <boxGeometry args={[3.2, 0.04, 0.05]} />
            <meshStandardMaterial color="#000" emissive="#9050ff" emissiveIntensity={3} />
          </mesh>
          <pointLight color="#9050ff" intensity={2} distance={4} position={[0, 2.2, -3]} />
        </group>
      )}

      {/* ── Dual-monitor desk ── */}
      <Desk pos={[-0.8, 0, -2.7]} w={3.0} d={0.92} />
      <Monitor pos={[-1.7, 1.36, -2.96]} src={assets[1]?.src} onItemClick={onItemClick} />
      <Monitor pos={[-0.1, 1.36, -2.96]} src={assets[2]?.src} onItemClick={onItemClick} />
      <Keyboard pos={[-1.0, 0.5, -2.45]} />
      {/* Wacom tablet */}
      <mesh castShadow position={[0.65, 0.5, -2.42]}>
        <boxGeometry args={[0.6, 0.025, 0.38]} />
        <meshStandardMaterial color="#181825" roughness={0.85} />
      </mesh>
      <PCTower pos={[-3.1, 0.28, -2.6]} rgb={C.rgbRed} />

      {/* ── Left wall: render gallery ── */}
      {assets.slice(3, 6).map((a, i) => (
        <WallFrame key={a.id} pos={[-3.38, 2.6 - i * 0.92, 1.6 - i * 0.35]} rot={Math.PI / 2} src={a.src} onItemClick={onItemClick} />
      ))}

      {/* ── Floating glowing icosahedron on pedestal ── */}
      <mesh castShadow position={[2.2, 0.85, -2.9]}>
        <icosahedronGeometry args={[0.22, 1]} />
        <meshStandardMaterial color="#9050ff" emissive="#6020cc" emissiveIntensity={1.2} metalness={0.45} roughness={0.15} />
      </mesh>
      <mesh castShadow position={[2.2, 0.52, -2.9]}>
        <cylinderGeometry args={[0.16, 0.19, 0.1, 10]} />
        <meshStandardMaterial color={C.deskDark} roughness={0.6} />
      </mesh>
      <pointLight color="#a060ff" intensity={1.6} distance={2.8} position={[2.2, 1.3, -2.6]} />

      {/* Blender logo shelf books */}
      <Shelf pos={[3.0, 1.5, -2.8]} w={1.2} shelves={2} />
      <Chair pos={[-1.0, 0, -1.7]} rot={Math.PI} />
      <Plant pos={[3.0, 0, 0.8]} scale={0.9} />
      <Rug pos={[-0.6, 0, -0.8]} w={2.6} d={2.2} color="#1e1430" />
    </group>
  );
}

// ─── THUMBNAIL DESIGN ROOM ────────────────────────────────────────────────────

function ThumbnailRoom({ assets, onItemClick }: { assets: MediaAsset[]; onItemClick: (s: string) => void }) {
  return (
    <group>
      {/* ── YouTube creator accent lighting ── */}
      <pointLight color="#ff3030" intensity={2.2} distance={5} position={[-2.5, 3.2, -2]} />
      <pointLight color="#ffffff" intensity={1.8} distance={6} position={[0, 3.5, 0]} />

      {/* ── BILLBOARD WALL — back wall, 3 large thumbnails ── */}
      {assets.slice(0, 3).map((a, i) => (
        <group
          key={a.id}
          onClick={() => onItemClick(a.src)}
          onPointerEnter={() => { document.body.style.cursor = "pointer"; }}
          onPointerLeave={() => { document.body.style.cursor = ""; }}
        >
          {/* Large framed print */}
          <mesh castShadow position={[-2.2 + i * 2.2, 2.3, -3.42]}>
            <boxGeometry args={[1.9, 1.35, 0.06]} />
            <meshStandardMaterial color="#111" roughness={0.5} />
          </mesh>
          <group position={[-2.2 + i * 2.2, 2.3, -3.39]}>
            <ScreenAsset src={a.src} w={1.78} h={1.22} />
          </group>
          {/* Neon underline strip — each a different colour */}
          <mesh position={[-2.2 + i * 2.2, 1.6, -3.4]}>
            <boxGeometry args={[1.9, 0.04, 0.04]} />
            <meshStandardMaterial color="#000" emissive={["#ff3030","#ffcc00","#00d4ff"][i]} emissiveIntensity={3.5} />
          </mesh>
          <pointLight
            color={["#ff3030","#ffcc00","#00d4ff"][i]}
            intensity={1.2} distance={3}
            position={[-2.2 + i * 2.2, 2.3, -3]}
          />
        </group>
      ))}

      {/* ── Wide monitor desk for active work ── */}
      <Desk pos={[-0.2, 0.28, -2.7]} w={2.4} d={0.9} />
      <group position={[-0.2, 1.58, -2.96]}>
        <mesh castShadow><boxGeometry args={[2.0, 1.1, 0.07]} /><meshStandardMaterial color={C.screen} roughness={0.5} /></mesh>
        {assets[3] && <ScreenAsset src={assets[3].src} w={1.88} h={0.98} />}
      </group>
      <Keyboard pos={[-0.2, 0.78, -2.44]} />

      {/* ── Left wall: creator mood board ── */}
      {/* Bold colour swatches */}
      {(["#ff3030","#ffcc00","#00d4ff","#e87820","#9050ff"] as const).map((col, i) => (
        <group key={i}>
          <mesh castShadow position={[-3.38, 2.85 - i * 0.42, -0.5 + i * 0.22]} rotation={[0, Math.PI / 2, 0]}>
            <boxGeometry args={[0.55, 0.28, 0.018]} />
            <meshStandardMaterial color={col} roughness={0.65} emissive={col} emissiveIntensity={0.35} />
          </mesh>
        </group>
      ))}
      {/* Extra thumbnail on left wall */}
      {assets[4] && (
        <WallFrame key={assets[4].id} pos={[-3.38, 1.45, 1.6]} rot={Math.PI / 2} src={assets[4].src} onItemClick={onItemClick} />
      )}

      {/* Bar stool */}
      <group position={[-0.2, 0, -1.45]}>
        <mesh castShadow position={[0, 0.72, 0]}>
          <cylinderGeometry args={[0.24, 0.2, 0.06, 10]} />
          <meshStandardMaterial color={C.chairBody} roughness={0.8} />
        </mesh>
        <mesh castShadow position={[0, 0.38, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 0.68, 8]} />
          <meshStandardMaterial color={C.metal} roughness={0.4} />
        </mesh>
      </group>

      {/* Design books */}
      {([C.book1, C.book2, C.book3] as const).map((col, i) => (
        <mesh key={i} castShadow position={[1.6, 0.5 + i * 0.07, -2.44]}>
          <boxGeometry args={[0.3, 0.065, 0.22]} />
          <meshStandardMaterial color={col} roughness={0.7} />
        </mesh>
      ))}
      <Plant pos={[3.1, 0, -1.0]} scale={0.9} />
      <Rug pos={[-0.2, 0, -0.5]} w={2.4} d={1.8} color="#100a08" />
    </group>
  );
}

// ─── BEYOND THE LENS — secret / travel ───────────────────────────────────────

function SecretRoom({ assets, onItemClick }: { assets: MediaAsset[]; onItemClick: (s: string) => void }) {
  return (
    <group>
      {/* ── Campfire / explorer atmosphere ── */}
      <pointLight color="#ff8030" intensity={2.5} distance={5} position={[1.2, 1.5, 0.4]} />
      <pointLight color="#3060ff" intensity={1.2} distance={6} position={[-3, 3, -2]} />

      {/* ── Featured showcase: hero travel moment ── */}
      <ShowcaseStand pos={[2.3, 0.35, 1.6]} rot={-0.84} src={assets[0]?.src} onItemClick={onItemClick} wide={false} />

      {/* ── Cosy sofa ── */}
      <Sofa pos={[1.2, 0, -0.4]} />

      {/* ── Bookshelf ── */}
      <Shelf pos={[-1.8, 1.4, -3.42]} w={2.0} shelves={3} />

      {/* ── Left wall: 2×2 travel gallery, bigger frames ── */}
      {assets.slice(0, 4).map((a, i) => (
        <group
          key={a.id}
          onClick={() => onItemClick(a.src)}
          onPointerEnter={() => { document.body.style.cursor = "pointer"; }}
          onPointerLeave={() => { document.body.style.cursor = ""; }}
        >
          <mesh castShadow position={[-3.38, 2.55 - Math.floor(i / 2) * 1.05, 1.1 - (i % 2) * 1.7]} rotation={[0, Math.PI / 2, 0]}>
            <boxGeometry args={[1.3, 0.95, 0.06]} />
            <meshStandardMaterial color={C.deskDark} roughness={0.6} />
          </mesh>
          <group position={[-3.36, 2.55 - Math.floor(i / 2) * 1.05, 1.1 - (i % 2) * 1.7]} rotation={[0, Math.PI / 2, 0]}>
            <ScreenAsset src={a.src} w={1.18} h={0.82} />
          </group>
        </group>
      ))}

      {/* ── Back wall: panoramic travel prints ── */}
      {assets.slice(4, 7).map((a, i) => (
        <WallFrame key={a.id} pos={[-2.0 + i * 2.0, 2.3, -3.4]} src={a.src} onItemClick={onItemClick} />
      ))}

      {/* Globe on stand */}
      <Globe pos={[-2.8, 0, 1.2]} />

      {/* Telescope by window area */}
      <Telescope pos={[-2.6, 0, 2.8]} />

      {/* Coffee table */}
      <mesh castShadow receiveShadow position={[1.2, 0.26, 0.8]}>
        <boxGeometry args={[0.9, 0.06, 0.5]} />
        <meshStandardMaterial color={C.deskMed} roughness={0.65} />
      </mesh>
      {/* Coffee mug */}
      <mesh castShadow position={[1.2, 0.32, 0.82]}>
        <cylinderGeometry args={[0.06, 0.055, 0.1, 10]} />
        <meshStandardMaterial color={C.cream} roughness={0.7} />
      </mesh>

      <Plant pos={[-3.1, 0, -2.8]} scale={1.2} />
      <Plant pos={[3.1, 0, 2.5]} scale={0.85} />
      <Rug pos={[1.2, 0, 0.4]} w={2.6} d={2.4} color="#4a5a3a" />
    </group>
  );
}

function Sofa({ pos }: { pos: [number,number,number] }) {
  return (
    <group position={pos}>
      {/* Base */}
      <mesh castShadow position={[0, 0.22, 0]}>
        <boxGeometry args={[1.6, 0.44, 0.72]} />
        <meshStandardMaterial color="#6a5848" roughness={0.82} />
      </mesh>
      {/* Back cushion */}
      <mesh castShadow position={[0, 0.6, -0.28]}>
        <boxGeometry args={[1.58, 0.44, 0.18]} />
        <meshStandardMaterial color="#7a6858" roughness={0.8} />
      </mesh>
      {/* Armrests */}
      {([-0.8, 0.8] as const).map((x) => (
        <mesh key={x} castShadow position={[x, 0.42, 0]}>
          <boxGeometry args={[0.18, 0.5, 0.72]} />
          <meshStandardMaterial color="#5a4838" roughness={0.8} />
        </mesh>
      ))}
      {/* Legs */}
      {([ [-0.7, 0.3], [0.7, 0.3], [-0.7, -0.3], [0.7, -0.3] ] as [number,number][]).map(([x,z],i) => (
        <mesh key={i} castShadow position={[x, 0.06, z]}>
          <boxGeometry args={[0.08, 0.12, 0.08]} />
          <meshStandardMaterial color={C.deskDark} roughness={0.7} />
        </mesh>
      ))}
      {/* Throw pillow */}
      <mesh castShadow position={[0.5, 0.5, -0.06]} rotation={[0.1, 0.2, 0.1]}>
        <boxGeometry args={[0.3, 0.26, 0.14]} />
        <meshStandardMaterial color="#c04860" roughness={0.85} />
      </mesh>
    </group>
  );
}

function Globe({ pos }: { pos: [number,number,number] }) {
  return (
    <group position={pos}>
      <mesh castShadow position={[0, 0.68, 0]}>
        <sphereGeometry args={[0.28, 16, 16]} />
        <meshStandardMaterial color="#2050a0" roughness={0.3} metalness={0.2} />
      </mesh>
      <mesh castShadow position={[0, 0.34, 0]}>
        <cylinderGeometry args={[0.04, 0.06, 0.68, 8]} />
        <meshStandardMaterial color={C.metal} roughness={0.4} />
      </mesh>
      <mesh castShadow position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.22, 0.22, 0.06, 12]} />
        <meshStandardMaterial color={C.deskDark} roughness={0.7} />
      </mesh>
    </group>
  );
}

function Telescope({ pos }: { pos: [number,number,number] }) {
  return (
    <group position={pos} rotation={[0, 0.4, 0]}>
      {/* Tripod */}
      {([0, Math.PI * 2/3, Math.PI * 4/3] as const).map((a, i) => (
        <mesh key={i} castShadow position={[Math.sin(a)*0.22, 0.42, Math.cos(a)*0.22]}
          rotation={[Math.atan2(0.42, 0.22) - Math.PI/2 + 0.1, a, 0]}>
          <cylinderGeometry args={[0.01, 0.01, 0.9, 6]} />
          <meshStandardMaterial color={C.metal} roughness={0.4} />
        </mesh>
      ))}
      {/* Tube */}
      <mesh castShadow position={[0, 1.05, 0]} rotation={[0.5, 0, 0]}>
        <cylinderGeometry args={[0.055, 0.04, 0.7, 10]} />
        <meshStandardMaterial color="#3a3a4a" roughness={0.5} metalness={0.4} />
      </mesh>
    </group>
  );
}
