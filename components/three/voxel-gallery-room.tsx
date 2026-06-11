"use client";

/**
 * VoxelGalleryRoom — a Minecraft-style 3D gallery.
 * Replaces the old image-backdrop stages for the blender / thumbnails / secret
 * portals (their background JPGs never existed, so those rooms rendered blank).
 *
 * Each theme is a different "biome": nether lab, creator den, end observatory.
 * Portfolio assets hang on the walls as item frames — click to open the viewer.
 */

import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Sparkles, Stars, Text, useTexture } from "@react-three/drei";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { Suspense, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { MediaAsset } from "@/lib/media-registry";

export type GalleryTheme = "nether" | "den" | "end";

type ThemePalette = {
  name: string;
  sky: string;
  fog: [number, number];
  floor: string[];      // pixel palette for the floor texture
  wall: string[];       // pixel palette for the wall texture
  frame: string;        // item frame wood color
  accent: string;       // emissive accent
  torch: string;        // torch light color
  ambient: string;
  text: string;
  particles: string;
  stars?: boolean;
};

const THEMES: Record<GalleryTheme, ThemePalette> = {
  nether: {
    name: "NETHER LAB",
    sky: "#190a14",
    fog: [10, 38],
    floor: ["#4a1a1e", "#56242a", "#3e1418", "#612b2c", "#451d22"],
    wall: ["#33121b", "#3d1822", "#2a0e16", "#47202b", "#38141d"],
    frame: "#2b1530",
    accent: "#b264ff",
    torch: "#c084fc",
    ambient: "#552266",
    text: "#e9d5ff",
    particles: "#c084fc",
  },
  den: {
    name: "CREATOR DEN",
    sky: "#101b10",
    fog: [11, 40],
    floor: ["#5d4528", "#69502f", "#523c22", "#74592f", "#5d4528"],
    wall: ["#3a5230", "#446039", "#314628", "#4c6a40", "#3a5230"],
    frame: "#4a2f17",
    accent: "#38d978",
    torch: "#ffae34",
    ambient: "#3a5a32",
    text: "#d9ffe6",
    particles: "#9dffb9",
  },
  end: {
    name: "END OBSERVATORY",
    sky: "#0a0a18",
    fog: [12, 44],
    floor: ["#dada9e", "#cfcf94", "#e3e3ab", "#c6c68c", "#d6d69c"],
    wall: ["#1a1430", "#221a3e", "#140f26", "#2a2148", "#1d1735"],
    frame: "#0f2c33",
    accent: "#00d4ff",
    torch: "#6ee7ff",
    ambient: "#1d3a55",
    text: "#cdf6ff",
    particles: "#7defff",
    stars: true,
  },
};

const ROOM_W = 16;
const ROOM_D = 14;
const ROOM_H = 7;

// ─── Pixel texture generator (Minecraft block look) ───────────────────────────

function usePixelTexture(palette: string[], repeat: [number, number]) {
  return useMemo(() => {
    if (typeof document === "undefined") return null;
    const px = 16;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = px;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    for (let y = 0; y < px; y++) {
      for (let x = 0; x < px; x++) {
        // deterministic noise so SSR/CSR stay consistent
        const n = Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
        ctx.fillStyle = palette[Math.floor(n * palette.length)];
        ctx.fillRect(x, y, 1, 1);
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat[0], repeat[1]);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [palette, repeat]);
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export function VoxelGalleryRoom({
  theme,
  assets,
  onItemClick,
}: {
  theme: GalleryTheme;
  assets: MediaAsset[];
  onItemClick: (src: string) => void;
}) {
  const palette = THEMES[theme];
  const images = useMemo(() => assets.filter((a) => a.kind === "image").slice(0, 11), [assets]);

  return (
    <Canvas
      shadows={{ type: THREE.PCFSoftShadowMap }}
      dpr={[0.75, 1.25]}
      gl={{ antialias: false, powerPreference: "default", alpha: false, stencil: false }}
    >
      <color attach="background" args={[palette.sky]} />
      <fog attach="fog" args={[palette.sky, ...palette.fog]} />
      <PerspectiveCamera makeDefault fov={55} position={[0, 4.6, 11]} near={0.1} far={60} />
      <OrbitControls
        target={[0, 2.4, -1]}
        enablePan={false}
        minDistance={4.5}
        maxDistance={12.5}
        minPolarAngle={0.7}
        maxPolarAngle={1.5}
        minAzimuthAngle={-1.05}
        maxAzimuthAngle={1.05}
        enableDamping
        dampingFactor={0.08}
      />

      <ambientLight intensity={0.45} color={palette.ambient} />
      <pointLight position={[0, ROOM_H - 1, 0]} intensity={2.6} distance={20} color="#ffffff" />
      <pointLight position={[0, 3, 6]} intensity={1.4} distance={16} color={palette.accent} />

      <Suspense fallback={null}>
        <RoomShell palette={palette} />
        <FrameWalls images={images} palette={palette} onItemClick={onItemClick} />
        <CenterPedestal palette={palette} />
        <Torches palette={palette} />
        {palette.stars && <Stars radius={50} depth={20} count={1200} factor={3} saturation={0.4} fade speed={0.8} />}
        <Sparkles count={60} speed={0.25} size={1.6} color={palette.particles} opacity={0.5} scale={[ROOM_W - 3, ROOM_H - 2, ROOM_D - 3]} position={[0, ROOM_H / 2, 0]} />
      </Suspense>

      <EffectComposer multisampling={0}>
        <Bloom mipmapBlur intensity={1.1} luminanceThreshold={0.22} luminanceSmoothing={0.3} />
        <Vignette eskil={false} offset={0.2} darkness={0.45} />
      </EffectComposer>
    </Canvas>
  );
}

// ─── Room shell — pixel-textured floor, walls, ceiling trim ───────────────────

function RoomShell({ palette }: { palette: ThemePalette }) {
  const floorTex = usePixelTexture(palette.floor, [8, 7]);
  const wallTex = usePixelTexture(palette.wall, [8, 4]);

  return (
    <group>
      {/* floor */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[ROOM_W, ROOM_D]} />
        {floorTex
          ? <meshStandardMaterial map={floorTex} roughness={0.95} />
          : <meshStandardMaterial color={palette.floor[0]} roughness={0.95} />}
      </mesh>

      {/* back wall */}
      <mesh receiveShadow position={[0, ROOM_H / 2, -ROOM_D / 2]}>
        <planeGeometry args={[ROOM_W, ROOM_H]} />
        {wallTex
          ? <meshStandardMaterial map={wallTex} roughness={0.92} />
          : <meshStandardMaterial color={palette.wall[0]} roughness={0.92} />}
      </mesh>
      {/* side walls */}
      <mesh receiveShadow position={[-ROOM_W / 2, ROOM_H / 2, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[ROOM_D, ROOM_H]} />
        {wallTex
          ? <meshStandardMaterial map={wallTex} roughness={0.92} />
          : <meshStandardMaterial color={palette.wall[0]} roughness={0.92} />}
      </mesh>
      <mesh receiveShadow position={[ROOM_W / 2, ROOM_H / 2, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[ROOM_D, ROOM_H]} />
        {wallTex
          ? <meshStandardMaterial map={wallTex} roughness={0.92} />
          : <meshStandardMaterial color={palette.wall[0]} roughness={0.92} />}
      </mesh>

      {/* glowstone ceiling blocks */}
      {([[-4, -3], [4, -3], [-4, 3], [4, 3], [0, 0]] as const).map(([x, z], i) => (
        <mesh key={i} position={[x, ROOM_H - 0.25, z]}>
          <boxGeometry args={[1, 0.5, 1]} />
          <meshStandardMaterial color="#3d2f10" emissive={palette.torch} emissiveIntensity={1.6} />
        </mesh>
      ))}

      {/* baseboard trim */}
      <mesh position={[0, 0.18, -ROOM_D / 2 + 0.1]}>
        <boxGeometry args={[ROOM_W, 0.36, 0.2]} />
        <meshStandardMaterial color={palette.frame} roughness={0.8} />
      </mesh>

      {/* room title floating against back wall */}
      <Text
        position={[0, ROOM_H - 1.1, -ROOM_D / 2 + 0.4]}
        fontSize={0.62}
        anchorX="center"
        color={palette.text}
        outlineColor="#000000"
        outlineWidth={0.02}
        letterSpacing={0.12}
      >
        {palette.name}
      </Text>
    </group>
  );
}

// ─── Item frames on three walls ───────────────────────────────────────────────

type FrameSlot = { pos: [number, number, number]; rotY: number };

function buildSlots(count: number): FrameSlot[] {
  const slots: FrameSlot[] = [];
  const backCount = Math.min(count, 5);
  for (let i = 0; i < backCount; i++) {
    const x = (i - (backCount - 1) / 2) * 2.9;
    slots.push({ pos: [x, 2.7, -ROOM_D / 2 + 0.12], rotY: 0 });
  }
  const sideCount = count - backCount;
  for (let i = 0; i < sideCount; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const idx = Math.floor(i / 2);
    const z = -2.5 + idx * 3.4;
    slots.push({
      pos: [side * (ROOM_W / 2 - 0.12), 2.7, z],
      rotY: side === -1 ? Math.PI / 2 : -Math.PI / 2,
    });
  }
  return slots;
}

function FrameWalls({
  images,
  palette,
  onItemClick,
}: {
  images: MediaAsset[];
  palette: ThemePalette;
  onItemClick: (src: string) => void;
}) {
  const slots = useMemo(() => buildSlots(images.length), [images.length]);
  return (
    <group>
      {images.map((asset, i) => {
        const slot = slots[i];
        if (!slot) return null;
        return (
          <Suspense key={asset.id} fallback={<EmptyFrame slot={slot} palette={palette} />}>
            <ItemFrame slot={slot} asset={asset} palette={palette} onClick={() => onItemClick(asset.src)} />
          </Suspense>
        );
      })}
    </group>
  );
}

function EmptyFrame({ slot, palette }: { slot: FrameSlot; palette: ThemePalette }) {
  return (
    <group position={slot.pos} rotation={[0, slot.rotY, 0]}>
      <mesh castShadow>
        <boxGeometry args={[2.5, 2.5, 0.14]} />
        <meshStandardMaterial color={palette.frame} roughness={0.85} />
      </mesh>
    </group>
  );
}

function ItemFrame({
  slot,
  asset,
  palette,
  onClick,
}: {
  slot: FrameSlot;
  asset: MediaAsset;
  palette: ThemePalette;
  onClick: () => void;
}) {
  const texture = useTexture(asset.src);
  const [hovered, setHovered] = useState(false);
  const glow = useRef<THREE.MeshStandardMaterial>(null);

  const aspect = useMemo(() => {
    const img = texture.image as { width?: number; height?: number } | undefined;
    if (!img?.width || !img?.height) return 1;
    return img.width / img.height;
  }, [texture]);

  // fit inside a 2.4 × 2.4 frame opening
  const w = aspect >= 1 ? 2.4 : 2.4 * aspect;
  const h = aspect >= 1 ? 2.4 / aspect : 2.4;

  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 2;

  useFrame((state, delta) => {
    if (glow.current) {
      const target = hovered ? 1.4 : 0.25;
      glow.current.emissiveIntensity = THREE.MathUtils.lerp(glow.current.emissiveIntensity, target, 1 - Math.exp(-10 * delta));
    }
  });

  return (
    <group position={slot.pos} rotation={[0, slot.rotY, 0]}>
      {/* wooden frame box */}
      <mesh castShadow position={[0, 0, -0.04]}>
        <boxGeometry args={[w + 0.3, h + 0.3, 0.14]} />
        <meshStandardMaterial ref={glow} color={palette.frame} roughness={0.85} emissive={palette.accent} emissiveIntensity={0.25} />
      </mesh>
      {/* the artwork */}
      <mesh
        position={[0, 0, 0.05]}
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = ""; }}
      >
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
      {/* caption — skip raw camera filenames like "20240322212039 IMG 7909 01" */}
      {!/^\d{6,}|^(img|dsc|picsart)\b/i.test(asset.title) && (
        <Text
          position={[0, -h / 2 - 0.32, 0.08]}
          fontSize={0.16}
          anchorX="center"
          color={palette.text}
          outlineColor="#000"
          outlineWidth={0.007}
          maxWidth={w + 0.4}
        >
          {asset.title}
        </Text>
      )}
    </group>
  );
}

// ─── Center pedestal with spinning crystal ────────────────────────────────────

function CenterPedestal({ palette }: { palette: ThemePalette }) {
  const crystal = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (crystal.current) {
      crystal.current.rotation.y = t * 0.8;
      crystal.current.position.y = 2.1 + Math.sin(t * 1.6) * 0.12;
    }
  });

  return (
    <group position={[0, 0, 2.5]}>
      {/* stepped voxel pedestal */}
      <mesh castShadow receiveShadow position={[0, 0.3, 0]}>
        <boxGeometry args={[1.8, 0.6, 1.8]} />
        <meshStandardMaterial color={palette.frame} roughness={0.85} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, 0.85, 0]}>
        <boxGeometry args={[1.2, 0.5, 1.2]} />
        <meshStandardMaterial color={palette.frame} roughness={0.85} emissive={palette.accent} emissiveIntensity={0.18} />
      </mesh>
      {/* floating crystal */}
      <mesh ref={crystal} castShadow position={[0, 2.1, 0]}>
        <octahedronGeometry args={[0.55, 0]} />
        <meshStandardMaterial color="#0c0618" emissive={palette.accent} emissiveIntensity={1.9} roughness={0.3} />
      </mesh>
      <pointLight position={[0, 2.3, 0]} color={palette.accent} intensity={3} distance={9} />
    </group>
  );
}

// ─── Flickering torches on the side walls ────────────────────────────────────

function Torches({ palette }: { palette: ThemePalette }) {
  const lights = useRef<(THREE.PointLight | null)[]>([]);
  const positions = useMemo<[number, number, number][]>(
    () => [
      [-ROOM_W / 2 + 0.4, 3.4, -5], [ROOM_W / 2 - 0.4, 3.4, -5],
      [-ROOM_W / 2 + 0.4, 3.4, 3],  [ROOM_W / 2 - 0.4, 3.4, 3],
    ],
    [],
  );

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    lights.current.forEach((l, i) => {
      if (l) l.intensity = 1.4 + Math.sin(t * (10 + i * 1.7) + i * 2) * 0.35 + Math.sin(t * (21 + i)) * 0.18;
    });
  });

  return (
    <group>
      {positions.map((p, i) => (
        <group key={i} position={p}>
          <mesh rotation={[0, 0, p[0] < 0 ? -0.35 : 0.35]}>
            <boxGeometry args={[0.12, 0.5, 0.12]} />
            <meshStandardMaterial color="#5b3d1f" roughness={0.9} />
          </mesh>
          <mesh position={[p[0] < 0 ? 0.1 : -0.1, 0.3, 0]}>
            <boxGeometry args={[0.16, 0.16, 0.16]} />
            <meshStandardMaterial color="#2b1505" emissive={palette.torch} emissiveIntensity={2.8} />
          </mesh>
          <pointLight ref={(el) => { lights.current[i] = el; }} position={[p[0] < 0 ? 0.3 : -0.3, 0.5, 0]} color={palette.torch} intensity={1.4} distance={7} />
        </group>
      ))}
    </group>
  );
}
