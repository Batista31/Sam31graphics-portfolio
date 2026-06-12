"use client";

import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { CuboidCollider, Physics, RapierRigidBody, RigidBody } from "@react-three/rapier";
import { Html, PerspectiveCamera, Sparkles, Stars, Text, Preload, useTexture } from "@react-three/drei";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { Suspense, useEffect, useRef, useState, useMemo } from "react";
import type { MutableRefObject } from "react";
import { useRouter } from "next/navigation";
import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { damp3 } from "maath/easing";
import { MultiplayerClient, OUTFITS, type RosterEntry } from "@/lib/multiplayer-client";
import { type RoomId, useWorldStore } from "@/store/world-store";

// ─── Room definitions ─────────────────────────────────────────────────────────

type WorldRoom = { id: RoomId; neonLabel: string; color: string; position: [number,number,number]; activationRadius: number };
type TerrainHeightSampler = (x: number, z: number) => number;

const MINECRAFT_SCALE = 6.5;
const MINECRAFT_Y_OFFSET = -1.55;
const worldFromMineways = (x: number, y: number, z: number): [number, number, number] => [
  x * MINECRAFT_SCALE,
  y * MINECRAFT_SCALE + MINECRAFT_Y_OFFSET,
  z * MINECRAFT_SCALE,
];
const DEFAULT_GROUND_Y = worldFromMineways(0, 0.25, 0)[1];
// Player spawns at PLAYER_SPAWN_Z; portals fan out in a concave semicircle in front.
const PLAYER_SPAWN_Z   = 7;
const PORTAL_FAN_RADIUS = 9;
const portalFan = (angle: number): [number, number, number] => [
  Math.sin(angle) * PORTAL_FAN_RADIUS,
  DEFAULT_GROUND_Y,
  PLAYER_SPAWN_Z - Math.cos(angle) * PORTAL_FAN_RADIUS,
];

const WORLD_ROOMS: WorldRoom[] = [
  { id: "video",      neonLabel: "VIDEO EDITS",      color: "#ff6b35", position: portalFan(-Math.PI / 3), activationRadius: 2.5 },
  { id: "thumbnails", neonLabel: "THUMBNAIL DESIGN", color: "#38d978", position: portalFan(-Math.PI / 6), activationRadius: 2.5 },
  { id: "photo",      neonLabel: "PHOTOGRAPHY",      color: "#ffb340", position: portalFan(0),            activationRadius: 2.5 },
  { id: "blender",    neonLabel: "BLENDER 3D",       color: "#9d50ff", position: portalFan( Math.PI / 6), activationRadius: 2.5 },
  { id: "secret",     neonLabel: "BEYOND THE LENS",  color: "#00d4ff", position: portalFan( Math.PI / 3), activationRadius: 2.5 },
];

const HOTBAR_ORDER: RoomId[] = ["video", "thumbnails", "photo", "blender", "secret"];

// pre-built vectors so the per-frame distance checks allocate nothing
const ROOM_VECS = WORLD_ROOMS.map((r) => new THREE.Vector3(...r.position));

// midpoint between hub and room → where the arch sits
function archPos(r: WorldRoom): [number,number,number] {
  return r.position;
}
function archRotY(r: WorldRoom): number {
  // Each arch faces its opening toward the player spawn point.
  return Math.atan2(0 - r.position[0], PLAYER_SPAWN_Z - r.position[2]);
}
function horizontalDistance(a: THREE.Vector3, b: THREE.Vector3) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

// XP orbs scattered around the hub — away from portal trigger zones.
const ORB_POSITIONS: [number, number][] = [
  [-4.5,  4.0], [ 4.5,  4.0], [-7.5,  9.5], [ 7.5,  9.5],
  [-11.0, 2.0], [ 11.0, 2.0], [-3.0, 12.5], [ 3.0, 12.5],
  [ 0.0,  1.5], [-9.0, -4.0], [ 9.0, -4.0], [ 0.0, 15.5],
];

// ─── Canvas root ─────────────────────────────────────────────────────────────

export function PlayableWorld() {
  return (
    <Canvas
      shadows={{ type: THREE.PCFSoftShadowMap }}
      dpr={[0.75, 1]}
      performance={{ min: 0.5, debounce: 200 }}
      gl={{ antialias: false, powerPreference: "default", alpha: false, stencil: false }}
    >
      <PerspectiveCamera makeDefault fov={58} near={0.1} far={140} />
      <Suspense fallback={<Html center><p className="text-sm uppercase tracking-[0.3em] text-white">Building your world…</p></Html>}>
        <Physics gravity={[0, -18, 0]} timeStep="vary">
          <GameScene />
        </Physics>
        <Preload all />
      </Suspense>
      <EffectComposer multisampling={0}>
        <Bloom mipmapBlur intensity={1.25} luminanceThreshold={0.18} luminanceSmoothing={0.28} />
        <Vignette eskil={false} offset={0.18} darkness={0.38} />
      </EffectComposer>
    </Canvas>
  );
}

// ─── Day / night sky + lights ─────────────────────────────────────────────────

const DAY = {
  sky: new THREE.Color("#88b8ff"),
  hemiSky: new THREE.Color("#e8f7ff"),
  hemiGround: new THREE.Color("#33552c"),
  sun: new THREE.Color("#fff3cc"),
  hemi: 1.05, ambient: 0.28, sun_i: 1.65, fill: 0.38,
};
const NIGHT = {
  sky: new THREE.Color("#0b1030"),
  hemiSky: new THREE.Color("#27306b"),
  hemiGround: new THREE.Color("#0a1018"),
  sun: new THREE.Color("#9db8ff"),
  hemi: 0.38, ambient: 0.1, sun_i: 0.22, fill: 0.16,
};

function SkyAndLights() {
  const night = useWorldStore((s) => s.night);
  const scene = useThree((s) => s.scene);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const amb  = useRef<THREE.AmbientLight>(null);
  const sun  = useRef<THREE.DirectionalLight>(null);
  const fill = useRef<THREE.DirectionalLight>(null);
  const [starsVisible, setStarsVisible] = useState(false);

  useEffect(() => {
    scene.background = DAY.sky.clone();
    scene.fog = new THREE.Fog(DAY.sky.clone(), 55, 125);
  }, [scene]);

  useFrame((_, delta) => {
    const t = night ? NIGHT : DAY;
    const k = 1 - Math.exp(-2.2 * delta);
    if (scene.background instanceof THREE.Color) scene.background.lerp(t.sky, k);
    if (scene.fog instanceof THREE.Fog) scene.fog.color.lerp(t.sky, k);
    if (hemi.current) {
      hemi.current.intensity = THREE.MathUtils.lerp(hemi.current.intensity, t.hemi, k);
      hemi.current.color.lerp(t.hemiSky, k);
      hemi.current.groundColor.lerp(t.hemiGround, k);
    }
    if (amb.current)  amb.current.intensity  = THREE.MathUtils.lerp(amb.current.intensity,  t.ambient, k);
    if (sun.current) {
      sun.current.intensity = THREE.MathUtils.lerp(sun.current.intensity, t.sun_i, k);
      sun.current.color.lerp(t.sun, k);
    }
    if (fill.current) fill.current.intensity = THREE.MathUtils.lerp(fill.current.intensity, t.fill, k);
    if (night !== starsVisible) setStarsVisible(night);
  });

  return (
    <>
      <hemisphereLight ref={hemi} args={["#e8f7ff", "#33552c", 1.05]} />
      <ambientLight ref={amb} intensity={0.28} color="#fff1d0" />
      <directionalLight ref={sun} castShadow position={[9, 14, 6]} intensity={1.65} color="#fff3cc"
        shadow-mapSize={[512, 512]}
        shadow-camera-near={0.5} shadow-camera-far={65}
        shadow-camera-left={-30} shadow-camera-right={30}
        shadow-camera-top={30}  shadow-camera-bottom={-30}
        shadow-bias={-0.001} />
      <directionalLight ref={fill} position={[-7, 6, -8]} intensity={0.38} color="#b8d2ff" />
      <pointLight position={[0, 4, -3]} color="#a855ff" intensity={2.4} distance={24} />
      {starsVisible && <Stars radius={90} depth={30} count={1600} factor={3.2} saturation={0} fade speed={0.6} />}
    </>
  );
}

// ─── Game scene ───────────────────────────────────────────────────────────────

function GameScene() {
  const player      = useRef<THREE.Group>(null);
  const playerBody  = useRef<RapierRigidBody>(null);
  const playerPos   = useRef(new THREE.Vector3(0, 0.9, PLAYER_SPAWN_Z));
  const terrainHeight = useRef<TerrainHeightSampler>(() => DEFAULT_GROUND_Y);

  // ── WASD FACING CONTROLS ────────────────────────────────────────────────────
  // playerYaw = the character's facing angle.
  // Convention: yaw=0 → facing -Z (toward rooms). Increases CCW from above.
  const playerYaw = useRef(Math.PI); // start facing -Z

  const router    = useRouter();
  const phase     = useWorldStore((s) => s.phase);
  const setLoaded = useWorldStore((s) => s.setLoaded);
  const markDiscovered      = useWorldStore((s) => s.markDiscovered);
  const requestTeleport     = useWorldStore((s) => s.requestTeleport);
  const toggleInventory     = useWorldStore((s) => s.toggleInventory);
  const swing               = useWorldStore((s) => s.swing);

  const keys    = useRef<Record<string, boolean>>({});
  const jumpOffset = useRef(0);
  const jumpVelocity = useRef(0);
  const moveState = useRef({ moving: false, running: false, jumping: false });
  const mouseLook = useRef(false);
  // prevent double-navigation
  const navigating = useRef(false);
  // timestamp of the first "playing" frame; <0 = not started yet
  const playStart = useRef(-1);
  // damped ground height — kills jitter from plant/flower vertices in the sampler
  const groundSmooth = useRef(DEFAULT_GROUND_Y);
  // sword swing timer: -1 = idle, otherwise seconds since swing start
  const swingTimer = useRef(-1);
  const pointerStart = useRef<{ x: number; y: number; t: number } | null>(null);
  // pre-allocated to avoid new THREE.Vector3() every frame
  const targetCamRef = useRef(new THREE.Vector3());
  // ── multiplayer ──
  const mp = useRef<MultiplayerClient | null>(null);
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const pendingRespawn = useRef<{ x: number; z: number } | null>(null);

  useEffect(() => { setLoaded(true); }, [setLoaded]);

  // ── Multiplayer connection ─────────────────────────────────────────────────
  useEffect(() => {
    const store = useWorldStore.getState;
    const client = new MultiplayerClient({
      onRoster: setRoster,
      onSelf: () => {},
      onPlayersOnline: (count) => store().setPlayersOnline(count),
      onSelfHit: (health, by) => {
        store().hurt(health);
        store().pushToast("Ouch!", `${by} hit you — ${health} HP left`);
      },
      onSelfDeath: (by, x, z) => {
        store().setHealth(100);
        store().pushToast("☠ You died!", `Slain by ${by} — respawned at the hub`);
        pendingRespawn.current = { x, z };
      },
    });
    mp.current = client;
    client.connect();
    return () => {
      client.dispose();
      mp.current = null;
    };
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keys.current[e.key.toLowerCase()] = true;
      // Minecraft hotbar: 1–5 teleports to the matching portal
      if (/^[1-5]$/.test(e.key)) {
        requestTeleport(HOTBAR_ORDER[Number(e.key) - 1]);
      }
      // E — inventory, F — sword swing (only while actually playing)
      if (useWorldStore.getState().phase === "playing") {
        if (e.key.toLowerCase() === "e" && !e.repeat) toggleInventory();
        if (e.key.toLowerCase() === "f" && !e.repeat && swingTimer.current < 0) {
          swingTimer.current = 0;
          swing();
          mp.current?.sendSwing();
        }
      }
      if (e.code === "Space") {
        e.preventDefault();
        keys.current.space = true;
        if (jumpOffset.current <= 0.01) {
          jumpVelocity.current = 5.8;
        }
      }
    };
    const up = (e: KeyboardEvent) => {
      keys.current[e.key.toLowerCase()] = false;
      if (e.code === "Space") keys.current.space = false;
    };
    const pointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      // ignore clicks on HUD buttons — only canvas drags rotate the camera
      if (e.target instanceof Element && e.target.closest("button")) return;
      mouseLook.current = true;
      pointerStart.current = { x: e.clientX, y: e.clientY, t: performance.now() };
      document.body.style.cursor = "grabbing";
    };
    const pointerUp = (e: PointerEvent) => {
      mouseLook.current = false;
      document.body.style.cursor = "";
      // a quick, nearly motionless click = sword swing (Minecraft left-click)
      const start = pointerStart.current;
      pointerStart.current = null;
      if (
        start &&
        performance.now() - start.t < 240 &&
        Math.hypot(e.clientX - start.x, e.clientY - start.y) < 7 &&
        swingTimer.current < 0
      ) {
        swingTimer.current = 0;
        swing();
        mp.current?.sendSwing();
      }
    };
    const pointerMove = (e: PointerEvent) => {
      if (!mouseLook.current) return;
      playerYaw.current -= e.movementX * 0.004;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup",   up);
    window.addEventListener("pointerdown", pointerDown);
    window.addEventListener("pointerup", pointerUp);
    window.addEventListener("pointercancel", pointerUp);
    window.addEventListener("pointermove", pointerMove);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("pointerdown", pointerDown);
      window.removeEventListener("pointerup", pointerUp);
      window.removeEventListener("pointercancel", pointerUp);
      window.removeEventListener("pointermove", pointerMove);
      document.body.style.cursor = "";
    };
  }, [requestTeleport, toggleInventory, swing]);

  useFrame((state, delta) => {
    if (!player.current || !playerBody.current || phase !== "playing") {
      state.camera.position.set(0, 5, 10);
      state.camera.lookAt(0, 0.5, 0);
      return;
    }

    // ── First playing frame: force the body to the spawn point ──────────────
    // Rapier creates kinematic bodies at the origin for a tick before the
    // position prop applies; deriving movement from translation() would then
    // strand the player at (0,0) under the hub crystal.
    if (playStart.current < 0) {
      playStart.current = state.clock.elapsedTime;
      playerBody.current.setTranslation({ x: 0, y: DEFAULT_GROUND_Y + 0.72, z: PLAYER_SPAWN_Z }, true);
      playerBody.current.setNextKinematicTranslation({ x: 0, y: DEFAULT_GROUND_Y + 0.72, z: PLAYER_SPAWN_Z });
    }
    const settled = state.clock.elapsedTime - playStart.current > 0.8;

    // ── Multiplayer respawn (killed by another player) ───────────────────────
    if (pendingRespawn.current) {
      const { x, z } = pendingRespawn.current;
      pendingRespawn.current = null;
      const gy = terrainHeight.current(x, z);
      playerBody.current.setTranslation({ x, y: gy + 0.72, z }, true);
      groundSmooth.current = gy;
      playerYaw.current = Math.PI;
    }

    // ── Hotbar teleport ──────────────────────────────────────────────────────
    const tp = useWorldStore.getState().teleportTarget;
    if (tp) {
      const room = WORLD_ROOMS.find((r) => r.id === tp);
      useWorldStore.getState().clearTeleport();
      if (room) {
        const [rx, , rz] = room.position;
        // land just outside the portal trigger, facing the arch
        const toSpawn = new THREE.Vector3(0 - rx, 0, PLAYER_SPAWN_Z - rz).normalize();
        const px = rx + toSpawn.x * 3.4;
        const pz = rz + toSpawn.z * 3.4;
        const gy = terrainHeight.current(px, pz);
        playerBody.current.setTranslation({ x: px, y: gy + 0.72, z: pz }, true);
        groundSmooth.current = gy;
        // face the portal: forward = (sin yaw, cos yaw) should point at it
        playerYaw.current = Math.atan2(rx - px, rz - pz);
      }
    }

    const body = playerBody.current.translation();
    const k    = keys.current;

    // ── Rotation (A / D) ────────────────────────────────────────────────────
    const TURN = 2.6;
    if (k.a || k.arrowleft)  playerYaw.current += TURN * delta;
    if (k.d || k.arrowright) playerYaw.current -= TURN * delta;

    // ── Forward direction from yaw ───────────────────────────────────────────
    const fwdX =  Math.sin(playerYaw.current);
    const fwdZ =  Math.cos(playerYaw.current);

    // ── Move (W / S) ─────────────────────────────────────────────────────────
    const running = !!k.shift;
    const speed   = running ? 7.2 : 4.0;
    let moveX = 0, moveZ = 0;
    if (k.w || k.arrowup)   { moveX += fwdX * speed * delta; moveZ += fwdZ * speed * delta; }
    if (k.s || k.arrowdown) { moveX -= fwdX * speed * delta; moveZ -= fwdZ * speed * delta; }

    if (jumpVelocity.current !== 0 || jumpOffset.current > 0) {
      jumpVelocity.current -= 18 * delta;
      jumpOffset.current += jumpVelocity.current * delta;

      if (jumpOffset.current <= 0) {
        jumpOffset.current = 0;
        jumpVelocity.current = 0;
      }
    }

    moveState.current.moving  = moveX !== 0 || moveZ !== 0;
    moveState.current.running = running && moveState.current.moving;
    moveState.current.jumping = jumpOffset.current > 0.04;

    const nextX = body.x + moveX;
    const nextZ = body.z + moveZ;
    const groundY = terrainHeight.current(nextX, nextZ);
    // Damp toward the sampled height — plant/flower vertices put single-cell
    // spikes in the sampler, and snapping to them jittered the whole camera.
    groundSmooth.current += (groundY - groundSmooth.current) * Math.min(1, 14 * delta);

    playerBody.current.setNextKinematicTranslation({
      x: nextX,
      y: groundSmooth.current + 0.72 + jumpOffset.current,
      z: nextZ,
    });

    const b = playerBody.current.translation();
    player.current.position.set(b.x, b.y - 0.72, b.z);
    player.current.rotation.y = playerYaw.current;

    playerPos.current.set(b.x, b.y + 0.35, b.z);
    const pp = playerPos.current;

    // stream our state to the other players (throttled inside the client)
    mp.current?.sendState(b.x, b.z, playerYaw.current, moveState.current.moving, moveState.current.running);

    // ── Camera: always behind character ─────────────────────────────────────
    const CAM_DIST = 7.5, CAM_H = 3.8;
    targetCamRef.current.set(pp.x - fwdX * CAM_DIST, pp.y + CAM_H, pp.z - fwdZ * CAM_DIST);
    damp3(state.camera.position, targetCamRef.current, 0.1, delta);
    state.camera.lookAt(pp.x, pp.y + 1.2, pp.z);

    if (state.camera instanceof THREE.PerspectiveCamera) {
      state.camera.fov = THREE.MathUtils.lerp(state.camera.fov, running ? 62 : 56, 1 - Math.exp(-4 * delta));
      state.camera.updateProjectionMatrix();
    }

    // ── Room navigation: walk through arch → go to /room/[id] ───────────────
    if (!navigating.current && settled) {
      for (let i = 0; i < WORLD_ROOMS.length; i++) {
        if (horizontalDistance(pp, ROOM_VECS[i]) < 1.25) {
          navigating.current = true;
          markDiscovered(WORLD_ROOMS[i].id);
          router.push(`/room/${WORLD_ROOMS[i].id}`);
          return;
        }
      }
    }

  });

  return (
    <>
      <SkyAndLights />

      <World playerPos={playerPos} onHeightSamplerReady={(sampler) => { terrainHeight.current = sampler; }} />

      <XpOrbs playerPos={playerPos} />
      <WanderingPig terrainHeight={terrainHeight} playerPos={playerPos} />

      <RigidBody ref={playerBody} type="kinematicPosition" colliders={false} position={[0, DEFAULT_GROUND_Y + 0.72, PLAYER_SPAWN_Z]}>
        <CuboidCollider args={[0.24, 0.55, 0.24]} />
      </RigidBody>
      <group ref={player} position={[0, DEFAULT_GROUND_Y, PLAYER_SPAWN_Z]} scale={0.55}>
        <SamyakCharacter moveState={moveState} swingTimer={swingTimer} />
      </group>
      <DustParticles playerPos={playerPos} moveState={moveState} />

      {/* other visitors exploring the world right now */}
      {roster.map((entry) => (
        <RemoteAvatar key={entry.id} entry={entry} mp={mp} terrainHeight={terrainHeight} />
      ))}

      <Sparkles count={190} speed={0.18} size={1.35} color="#d6b5ff" opacity={0.24} scale={[34, 8, 34]} position={[0, 4, -5]} />
    </>
  );
}



// ─── World ────────────────────────────────────────────────────────────────────

function World({
  playerPos,
  onHeightSamplerReady,
}: {
  playerPos: MutableRefObject<THREE.Vector3>;
  onHeightSamplerReady: (sampler: TerrainHeightSampler) => void;
}) {
  return (
    <group>
      <MinecraftWorldModel onHeightSamplerReady={onHeightSamplerReady} />
      <HubCenter />
      {WORLD_ROOMS.map(room => (
        <RoomGate key={room.id} room={room} playerPos={playerPos} />
      ))}
      <ContactBooth position={[0, 0, 12]} />
    </group>
  );
}

// ─── Minecraft OBJ world ──────────────────────────────────────────────────────

function MinecraftWorldModel({ onHeightSamplerReady }: { onHeightSamplerReady: (sampler: TerrainHeightSampler) => void }) {
  const obj = useLoader(OBJLoader, "/assets/models/minecraft-world/Mineways2Skfb.obj");
  const texture = useTexture("/assets/models/minecraft-world/Mineways2Skfb-RGBA.png");

  const model = useMemo(() => {
    const clone = obj.clone(true);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestMipmapNearestFilter;
    texture.anisotropy = 1;

    clone.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        // Perf: the world is huge — it RECEIVES shadows (player, mobs) but
        // does not cast them, which keeps the shadow depth pass tiny.
        child.castShadow = false;
        child.receiveShadow = true;
        child.material = new THREE.MeshStandardMaterial({
          map: texture,
          roughness: 0.92,
          metalness: 0,
          side: THREE.DoubleSide, // Mineways foliage cross-quads need both faces
        });
        // Static geometry — skip per-frame matrix recomputation.
        child.matrixAutoUpdate = false;
        child.updateMatrix();
      }
    });

    return clone;
  }, [obj, texture]);

  useEffect(() => {
    const cellSize = 0.35;
    const heights = new Map<string, number>();
    const key = (x: number, z: number) => `${Math.round(x / cellSize)},${Math.round(z / cellSize)}`;
    // Player can step up this much above the base ground level (gentle slopes OK, building rooftops not).
    const MAX_WALKABLE_Y = DEFAULT_GROUND_Y + 0.65;

    obj.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;

      const position = child.geometry.getAttribute("position");
      if (!position) return;

      for (let i = 0; i < position.count; i++) {
        const x = position.getX(i) * MINECRAFT_SCALE;
        const y = position.getY(i) * MINECRAFT_SCALE + MINECRAFT_Y_OFFSET;
        const z = position.getZ(i) * MINECRAFT_SCALE;
        if (y > MAX_WALKABLE_Y) continue; // skip building rooftops / walls
        const k = key(x, z);
        const previous = heights.get(k);
        if (previous === undefined || y > previous) heights.set(k, y);
      }
    });

    onHeightSamplerReady((x, z) => {
      let best = heights.get(key(x, z));
      if (best !== undefined) return best;

      for (let radius = 1; radius <= 4; radius++) {
        for (let dx = -radius; dx <= radius; dx++) {
          for (let dz = -radius; dz <= radius; dz++) {
            const ix = Math.round(x / cellSize) + dx;
            const iz = Math.round(z / cellSize) + dz;
            const value = heights.get(`${ix},${iz}`);
            if (value !== undefined) {
              best = best === undefined ? value : Math.max(best, value);
            }
          }
        }

        if (best !== undefined) return best;
      }

      return DEFAULT_GROUND_Y;
    });
  }, [obj, onHeightSamplerReady]);

  return (
    <RigidBody type="fixed" colliders={false}>
      <primitive object={model} scale={MINECRAFT_SCALE} position={[0, MINECRAFT_Y_OFFSET, 0]} />
      <CuboidCollider args={[26, 0.12, 19]} position={[0, -0.12, 0]} />
    </RigidBody>
  );
}

function Block({
  position,
  scale = [1, 1, 1],
  color,
  topColor,
  emissive,
  emissiveIntensity = 0,
}: {
  position: [number, number, number];
  scale?: [number, number, number];
  color: string;
  topColor?: string;
  emissive?: string;
  emissiveIntensity?: number;
}) {
  return (
    <group position={position} scale={scale}>
      <mesh castShadow receiveShadow>
        <boxGeometry />
        <meshStandardMaterial color={color} roughness={0.78} emissive={emissive ?? "#000000"} emissiveIntensity={emissiveIntensity} />
      </mesh>
      {topColor && (
        <mesh position={[0, 0.501, 0]}>
          <boxGeometry args={[1.01, 0.03, 1.01]} />
          <meshStandardMaterial color={topColor} roughness={0.84} />
        </mesh>
      )}
    </group>
  );
}

// ─── Hub center ───────────────────────────────────────────────────────────────

function HubCenter() {
  // Floating sky sign — nothing on the ground so the player walks freely underneath.
  return (
    <group position={[0, 0, 0]}>
      {/* Glowing crystal shard — floats at eye level above the portal arc */}
      <Block position={[0, 7.2, -0.5]} scale={[0.7, 1.4, 0.7]} color="#1a0d2e" emissive="#8b5cf6" emissiveIntensity={1.8} />
      <Block position={[0, 6.6, -0.5]} scale={[1.1, 0.5, 1.1]} color="#120920" emissive="#6d28d9" emissiveIntensity={1.0} />
      {/* Wide purple glow */}
      <pointLight position={[0, 7.8, -0.5]} color="#b38cff" intensity={6} distance={22} />
      {/* Title */}
      <Text position={[0, 9.4, -0.5]} fontSize={0.68} anchorX="center" color="#fff4e8"
        outlineColor="#6d28d9" outlineWidth={0.022} letterSpacing={0.07}>
        SAMYAKCRAFT
      </Text>
      {/* Subtitle */}
      <Text position={[0, 8.6, -0.5]} fontSize={0.24} anchorX="center" color="#e9d5ff"
        outlineColor="#110820" outlineWidth={0.009} letterSpacing={0.14}>
        WALK INTO A PORTAL
      </Text>
    </group>
  );
}

// ─── Room gate — arch + portal effects ────────────────────────────────────────

function RoomGate({ room, playerPos }: { room: WorldRoom; playerPos: MutableRefObject<THREE.Vector3> }) {
  const ap = useMemo(() => archPos(room), [room]);
  const apVec = useMemo(() => new THREE.Vector3(...archPos(room)), [room]);
  const labelGroupRef = useRef<THREE.Group>(null);
  const nearRef = useRef(false);

  useFrame(() => {
    const d = horizontalDistance(playerPos.current, apVec);
    const n = d < room.activationRadius + 3;
    if (n !== nearRef.current) {
      nearRef.current = n;
      // Toggle visibility imperatively — no React re-render, no Text remount stutter
      if (labelGroupRef.current) labelGroupRef.current.visible = n;
    }
  });

  return (
    <group>
      {/* Arch + portal */}
      <group position={ap} rotation={[0, archRotY(room), 0]} scale={0.45}>
        <ArchWithWalls color={room.color} label={room.neonLabel} nearRef={nearRef} />
      </group>
      {/* Floor label — always mounted, toggled imperatively to avoid troika rebuild stutter */}
      <group ref={labelGroupRef} visible={false}>
        <Text
          position={[ap[0], ap[1] + 0.06, ap[2]]}
          rotation={[-Math.PI/2, 0, archRotY(room)]}
          fontSize={0.22}
          anchorX="center"
          color={room.color}
          outlineColor="#000"
          outlineWidth={0.008}
        >
          Enter portal
        </Text>
      </group>
    </group>
  );
}

// ─── Arch with obsidian frame, swirl particles + torches ─────────────────────

const PORTAL_PARTICLE_COUNT = 16;

function ArchWithWalls({ color, label, nearRef }: { color: string; label: string; nearRef: MutableRefObject<boolean> }) {
  const portalMat = useRef<THREE.MeshBasicMaterial>(null);
  const particles = useRef<THREE.Group>(null);
  const torchL = useRef<THREE.PointLight>(null);
  const torchR = useRef<THREE.PointLight>(null);
  const seeds = useMemo(
    () => Array.from({ length: PORTAL_PARTICLE_COUNT }, (_, i) => ({
      phase: (i / PORTAL_PARTICLE_COUNT) * Math.PI * 2,
      radius: 0.5 + ((i * 37) % 10) / 14,
      speed: 0.6 + ((i * 13) % 7) / 9,
      size: 0.05 + ((i * 7) % 5) / 70,
    })),
    [],
  );

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (portalMat.current) {
      portalMat.current.opacity = 0.58 + Math.sin(t * 3.2) * 0.12;
    }
    // Skip expensive particle + torch updates when player is far — torch lights
    // don't reach far anyway (distance=5), and particles aren't visible at range.
    if (!nearRef.current) return;
    // Nether-portal swirl: particles orbit inside the portal plane
    if (particles.current) {
      particles.current.children.forEach((p, i) => {
        const s = seeds[i];
        const a = t * s.speed + s.phase;
        p.position.set(
          Math.cos(a) * s.radius,
          1.75 + Math.sin(a * 1.7) * 1.1,
          0.14 + Math.sin(a * 2.3) * 0.1,
        );
        p.rotation.z = a;
        const sc = 0.8 + Math.sin(a * 3) * 0.35;
        p.scale.setScalar(sc);
      });
    }
    // Torch flicker
    if (torchL.current) torchL.current.intensity = 1.6 + Math.sin(t * 11.0) * 0.35 + Math.sin(t * 23.0) * 0.2;
    if (torchR.current) torchR.current.intensity = 1.6 + Math.sin(t * 13.0 + 2) * 0.35 + Math.sin(t * 19.0 + 1) * 0.2;
  });

  return (
    <group>
      {/* Obsidian frame */}
      <Block position={[-1.5, 1.0, 0]} scale={[0.6, 2.0, 0.55]} color="#1a1025" emissive="#3b0764" emissiveIntensity={0.35} />
      <Block position={[1.5, 1.0, 0]} scale={[0.6, 2.0, 0.55]} color="#1a1025" emissive="#3b0764" emissiveIntensity={0.35} />
      <Block position={[-1.5, 2.8, 0]} scale={[0.6, 0.7, 0.55]} color="#160d21" emissive="#4c1d95" emissiveIntensity={0.5} />
      <Block position={[1.5, 2.8, 0]} scale={[0.6, 0.7, 0.55]} color="#160d21" emissive="#4c1d95" emissiveIntensity={0.5} />
      <Block position={[0, 3.35, 0]} scale={[3.6, 0.65, 0.55]} color="#160d21" emissive="#4c1d95" emissiveIntensity={0.5} />
      <Block position={[0, 0.05, 0]} scale={[3.6, 0.3, 0.55]} color="#130c1d" emissive="#4c1d95" emissiveIntensity={0.35} />

      {/* Portal surface */}
      <mesh position={[0, 1.75, 0.04]}>
        <planeGeometry args={[2.35, 2.9]} />
        <meshBasicMaterial ref={portalMat} color="#9d4edd" transparent opacity={0.66} side={THREE.DoubleSide} />
      </mesh>

      {/* Swirl particles */}
      <group ref={particles}>
        {seeds.map((s, i) => (
          <mesh key={i}>
            <planeGeometry args={[s.size, s.size]} />
            <meshBasicMaterial
              color={i % 3 === 0 ? color : "#c084fc"}
              transparent
              opacity={0.85}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        ))}
      </group>

      {/* Torches on the pillars */}
      {([-1, 1] as const).map((side) => (
        <group key={side} position={[side * 1.5, 2.25, 0.45]}>
          <mesh castShadow>
            <boxGeometry args={[0.12, 0.42, 0.12]} />
            <meshStandardMaterial color="#6b4a2a" roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.26, 0]}>
            <boxGeometry args={[0.15, 0.15, 0.15]} />
            <meshStandardMaterial color="#2b1505" emissive="#ffae34" emissiveIntensity={2.6} />
          </mesh>
        </group>
      ))}
      <pointLight ref={torchL} position={[-1.5, 2.7, 0.7]} color="#ffae34" intensity={1.6} distance={5} />
      <pointLight ref={torchR} position={[1.5, 2.7, 0.7]} color="#ffae34" intensity={1.6} distance={5} />

      <pointLight position={[0, 1.8, 1.0]} color={color} intensity={2.8} distance={7.5} />

      <Text position={[0, 4.2, 0]} fontSize={0.2} anchorX="center" color="#f5e8ff" outlineColor="#000" outlineWidth={0.008} letterSpacing={0.14}>
        {label}
      </Text>
      <Block position={[0, 0.14, -1.4]} scale={[2.7, 0.16, 2.3]} color="#5b2a82" emissive={color} emissiveIntensity={0.22} />
    </group>
  );
}

// ─── XP orbs ──────────────────────────────────────────────────────────────────

function XpOrbs({ playerPos }: { playerPos: MutableRefObject<THREE.Vector3> }) {
  const collectOrb = useWorldStore((s) => s.collectOrb);
  const phase = useWorldStore((s) => s.phase);
  const [taken, setTaken] = useState<boolean[]>(() => ORB_POSITIONS.map(() => false));
  const takenRef = useRef<boolean[]>(ORB_POSITIONS.map(() => false));
  const group = useRef<THREE.Group>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (!group.current) return;
    group.current.children.forEach((orb, i) => {
      if (takenRef.current[i]) return;
      orb.position.y = DEFAULT_GROUND_Y + 0.55 + Math.sin(t * 2.4 + i * 1.3) * 0.14;
      orb.rotation.y = t * 2 + i;
      if (phase !== "playing") return;
      const d = horizontalDistance(playerPos.current, orb.position as THREE.Vector3);
      if (d < 0.9) {
        takenRef.current[i] = true;
        collectOrb();
        setTaken((prev) => {
          const next = [...prev];
          next[i] = true;
          return next;
        });
      }
    });
  });

  return (
    <group ref={group}>
      {ORB_POSITIONS.map(([x, z], i) => (
        <group key={i} position={[x, DEFAULT_GROUND_Y + 0.55, z]} visible={!taken[i]}>
          <mesh>
            <icosahedronGeometry args={[0.16, 0]} />
            <meshStandardMaterial color="#173b06" emissive="#7dff3a" emissiveIntensity={2.4} />
          </mesh>
          <mesh rotation={[Math.PI / 4, 0, Math.PI / 4]}>
            <icosahedronGeometry args={[0.1, 0]} />
            <meshStandardMaterial color="#0c2603" emissive="#d7ff5e" emissiveIntensity={3.2} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ─── Dust particles when running ─────────────────────────────────────────────

const DUST_COUNT = 14;

function DustParticles({
  playerPos,
  moveState,
}: {
  playerPos: MutableRefObject<THREE.Vector3>;
  moveState: MutableRefObject<{ moving: boolean; running: boolean; jumping: boolean }>;
}) {
  const group = useRef<THREE.Group>(null);
  const lives = useRef<Float32Array>(new Float32Array(DUST_COUNT)); // 0 = dead
  const nextSpawn = useRef(0);
  const cursor = useRef(0);

  useFrame((state, delta) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime;
    const ms = moveState.current;

    // spawn while moving on the ground
    if (ms.moving && !ms.jumping && t > nextSpawn.current) {
      nextSpawn.current = t + (ms.running ? 0.07 : 0.16);
      const i = cursor.current;
      cursor.current = (cursor.current + 1) % DUST_COUNT;
      lives.current[i] = 1;
      const m = group.current.children[i];
      m.position.set(
        playerPos.current.x + (Math.random() - 0.5) * 0.35,
        playerPos.current.y - 0.3,
        playerPos.current.z + (Math.random() - 0.5) * 0.35,
      );
    }

    for (let i = 0; i < DUST_COUNT; i++) {
      const m = group.current.children[i] as THREE.Mesh;
      if (lives.current[i] <= 0) { m.visible = false; continue; }
      lives.current[i] -= delta * 2.2;
      m.visible = true;
      m.position.y += delta * 0.7;
      const s = 0.05 + (1 - lives.current[i]) * 0.1;
      m.scale.setScalar(Math.max(s, 0.01));
      const mat = m.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(lives.current[i], 0) * 0.55;
    }
  });

  return (
    <group ref={group}>
      {Array.from({ length: DUST_COUNT }, (_, i) => (
        <mesh key={i} visible={false}>
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial color="#cbb494" transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

// ─── Wandering pig ────────────────────────────────────────────────────────────

function WanderingPig({
  terrainHeight,
  playerPos,
}: {
  terrainHeight: MutableRefObject<TerrainHeightSampler>;
  playerPos: MutableRefObject<THREE.Vector3>;
}) {
  const root = useRef<THREE.Group>(null);
  const legFL = useRef<THREE.Group>(null);
  const legFR = useRef<THREE.Group>(null);
  const legBL = useRef<THREE.Group>(null);
  const legBR = useRef<THREE.Group>(null);
  const heading = useRef(Math.random() * Math.PI * 2);
  const center = useMemo(() => new THREE.Vector3(8.5, 0, 11), []);
  const pos = useRef(new THREE.Vector3(8.5, DEFAULT_GROUND_Y, 11));
  const nextTurn = useRef(0);
  const lastSwing = useRef(0);
  const panicUntil = useRef(0);
  const hop = useRef(-1);
  const pushToast = useWorldStore((s) => s.pushToast);
  const oinked = useRef(false);

  useFrame((state, delta) => {
    if (!root.current) return;
    const t = state.clock.elapsedTime;

    // sword swung near the pig → panic and flee
    const tick = useWorldStore.getState().swingTick;
    if (tick !== lastSwing.current) {
      lastSwing.current = tick;
      if (horizontalDistance(playerPos.current, pos.current) < 3) {
        panicUntil.current = t + 2.2;
        hop.current = 0; // start a hop

        heading.current = Math.atan2(pos.current.x - playerPos.current.x, pos.current.z - playerPos.current.z);
        if (!oinked.current) {
          oinked.current = true;
          pushToast("Oink!!", "Leave the pig alone 🐷");
        }
      }
    }
    const panicking = t < panicUntil.current;

    if (!panicking && t > nextTurn.current) {
      nextTurn.current = t + 2 + Math.random() * 3;
      heading.current += (Math.random() - 0.5) * 2.2;
    }
    // keep within the pen radius (unless running for its life)
    if (!panicking && pos.current.distanceTo(center) > 5) {
      heading.current = Math.atan2(center.x - pos.current.x, center.z - pos.current.z);
    }

    // hop: half-sine arc over 0.45s, hop.current = time since hop start (-1 = idle)
    let hopY = 0;
    if (hop.current >= 0) {
      hop.current += delta;
      if (hop.current >= 0.45) hop.current = -1;
      else hopY = Math.sin((hop.current / 0.45) * Math.PI) * 0.42;
    }

    const speed = panicking ? 3.6 : 0.85;
    pos.current.x += Math.sin(heading.current) * speed * delta;
    pos.current.z += Math.cos(heading.current) * speed * delta;
    pos.current.y = terrainHeight.current(pos.current.x, pos.current.z);

    root.current.position.set(pos.current.x, pos.current.y + hopY, pos.current.z);
    root.current.rotation.y = heading.current;

    const sw = Math.sin(t * (panicking ? 16 : 7)) * 0.45;
    if (legFL.current) legFL.current.rotation.x = sw;
    if (legFR.current) legFR.current.rotation.x = -sw;
    if (legBL.current) legBL.current.rotation.x = -sw;
    if (legBR.current) legBR.current.rotation.x = sw;
  });

  const pink = "#eda3a0";
  const darkPink = "#d4807c";

  return (
    <group ref={root} scale={0.42}>
      {/* body */}
      <mesh castShadow position={[0, 0.85, 0]}>
        <boxGeometry args={[1.0, 0.8, 1.6]} />
        <meshStandardMaterial color={pink} roughness={0.85} />
      </mesh>
      {/* head */}
      <mesh castShadow position={[0, 0.95, 0.95]}>
        <boxGeometry args={[0.75, 0.7, 0.6]} />
        <meshStandardMaterial color={pink} roughness={0.85} />
      </mesh>
      {/* snout */}
      <mesh position={[0, 0.85, 1.28]}>
        <boxGeometry args={[0.32, 0.24, 0.1]} />
        <meshStandardMaterial color={darkPink} roughness={0.8} />
      </mesh>
      {/* eyes */}
      <mesh position={[-0.2, 1.06, 1.26]}><boxGeometry args={[0.09, 0.09, 0.02]} /><meshStandardMaterial color="#181010" /></mesh>
      <mesh position={[0.2, 1.06, 1.26]}><boxGeometry args={[0.09, 0.09, 0.02]} /><meshStandardMaterial color="#181010" /></mesh>
      {/* legs — pivoted at the hip */}
      {([
        [legFL, -0.32,  0.55], [legFR, 0.32,  0.55],
        [legBL, -0.32, -0.55], [legBR, 0.32, -0.55],
      ] as const).map(([ref, x, z], i) => (
        <group key={i} ref={ref} position={[x, 0.5, z]}>
          <mesh castShadow position={[0, -0.25, 0]}>
            <boxGeometry args={[0.28, 0.5, 0.28]} />
            <meshStandardMaterial color={darkPink} roughness={0.85} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ─── Remote players ───────────────────────────────────────────────────────────

function RemoteAvatar({
  entry,
  mp,
  terrainHeight,
}: {
  entry: RosterEntry;
  mp: MutableRefObject<MultiplayerClient | null>;
  terrainHeight: MutableRefObject<TerrainHeightSampler>;
}) {
  const root = useRef<THREE.Group>(null);
  const healthBar = useRef<THREE.Mesh>(null);
  const cur = useRef({ x: 0, z: 0, yaw: Math.PI, init: false });
  const moveState = useRef({ moving: false, running: false, jumping: false });
  const swingTimer = useRef(-1);
  const lastSwingSeen = useRef(0);

  useFrame((_, delta) => {
    const data = mp.current?.remotes.get(entry.id);
    if (!data || !root.current) return;

    const c = cur.current;
    if (!c.init) {
      c.x = data.x; c.z = data.z; c.yaw = data.yaw; c.init = true;
    }

    // position: exponential approach toward the latest network target
    const k = 1 - Math.exp(-10 * delta);
    c.x += (data.x - c.x) * k;
    c.z += (data.z - c.z) * k;
    // yaw: shortest-angle lerp
    const dy = ((data.yaw - c.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    c.yaw += dy * k;

    root.current.position.set(c.x, terrainHeight.current(c.x, c.z), c.z);
    root.current.rotation.y = c.yaw;

    moveState.current.moving = data.m;
    moveState.current.running = data.r;

    // replay their sword swings
    if (data.swungAt > lastSwingSeen.current) {
      lastSwingSeen.current = data.swungAt;
      if (swingTimer.current < 0) swingTimer.current = 0;
    }

    // health bar width
    if (healthBar.current) {
      healthBar.current.scale.x = Math.max(data.health / 100, 0.02);
    }
  });

  const outfit = OUTFITS[entry.c % OUTFITS.length];

  return (
    <group ref={root} scale={0.55} visible={cur.current.init || undefined}>
      <SamyakCharacter moveState={moveState} swingTimer={swingTimer} outfit={outfit} name={entry.name} />
      {/* health bar above the name tag */}
      <mesh position={[0, 2.72, 0]}>
        <boxGeometry args={[0.9, 0.09, 0.02]} />
        <meshBasicMaterial color="#1a0505" />
      </mesh>
      <mesh ref={healthBar} position={[0, 2.72, 0.015]}>
        <boxGeometry args={[0.86, 0.06, 0.015]} />
        <meshBasicMaterial color="#ff4444" />
      </mesh>
    </group>
  );
}

// ─── Contact booth ────────────────────────────────────────────────────────────

function ContactBooth({ position }: { position: [number,number,number] }) {
  return (
    <group position={position}>
      <Block position={[0, 0.55, 0]} scale={[1.45, 1.1, 1.45]} color="#123a2f" emissive="#14f1b4" emissiveIntensity={0.22} />
      <Block position={[0, 1.55, 0]} scale={[1.15, 1.0, 1.15]} color="#071915" emissive="#1fffc2" emissiveIntensity={0.55} />
      <Block position={[0, 2.35, 0]} scale={[1.55, 0.28, 1.55]} color="#10322b" emissive="#1fffc2" emissiveIntensity={0.35} />
      <pointLight position={[0, 2.1, 0.8]} color="#1fffc2" intensity={2.6} distance={6} />
      <Text position={[0,2.95,0.7]} fontSize={0.17} color="#adffe9" outlineColor="#00120e" outlineWidth={0.006} anchorX="center" maxWidth={2.2}>CONNECT</Text>
      <Text position={[0,2.66,0.7]} fontSize={0.17} color="#adffe9" outlineColor="#00120e" outlineWidth={0.006} anchorX="center" maxWidth={2.2}>WITH SAMYAK</Text>
    </group>
  );
}

// ─── Samyak character — jointed limbs, idle/run/jump animation ───────────────

const SWING_DURATION = 0.34;

function SamyakCharacter({
  moveState,
  swingTimer,
  outfit = { shirt: "#f07f38", pants: "#253047" },
  name = "Samyak",
}: {
  moveState: MutableRefObject<{ moving: boolean; running: boolean; jumping: boolean }>;
  swingTimer: MutableRefObject<number>;
  outfit?: { shirt: string; pants: string };
  name?: string;
}) {
  const body      = useRef<THREE.Group>(null);
  const head      = useRef<THREE.Group>(null);
  const leftLeg   = useRef<THREE.Group>(null);
  const rightLeg  = useRef<THREE.Group>(null);
  const leftArm   = useRef<THREE.Group>(null);
  const rightArm  = useRef<THREE.Group>(null);
  const cape      = useRef<THREE.Mesh>(null);
  const leftEye   = useRef<THREE.Mesh>(null);
  const rightEye  = useRef<THREE.Mesh>(null);
  const phase     = useRef(0);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const ms = moveState.current;
    const k = 1 - Math.exp(-12 * delta); // smoothing

    if (ms.moving) phase.current += delta * (ms.running ? 13 : 8);

    // sword swing timer advances here (single owner of the animation clock)
    if (swingTimer.current >= 0) {
      swingTimer.current += delta;
      if (swingTimer.current > SWING_DURATION) swingTimer.current = -1;
    }
    const swinging = swingTimer.current >= 0;
    const swingArc = swinging ? Math.sin((swingTimer.current / SWING_DURATION) * Math.PI) : 0;

    // target limb angles
    const stride = ms.moving ? Math.sin(phase.current) * (ms.running ? 0.85 : 0.6) : 0;
    let armL = -stride * 0.8;
    let armR =  stride * 0.8;
    let armLz = 0.06, armRz = -0.06;
    let legL = stride;
    let legR = -stride;

    if (ms.jumping) {
      // arms out + legs tucked, like a Minecraft jump
      armL = -0.6; armR = -0.6;
      armLz = 0.85; armRz = -0.85;
      legL = 0.45; legR = -0.25;
    } else if (!ms.moving) {
      // idle: subtle breathing arm sway
      armL = Math.sin(t * 1.7) * 0.05;
      armR = Math.sin(t * 1.7 + Math.PI) * 0.05;
      armLz = 0.04 + Math.sin(t * 1.3) * 0.015;
      armRz = -0.04 - Math.sin(t * 1.3) * 0.015;
    }

    // swing overrides the right arm: raise overhead and chop forward
    if (swinging) {
      armR = -2.3 * swingArc;
      armRz = -0.25 * swingArc;
    }

    if (leftArm.current)  { leftArm.current.rotation.x  = THREE.MathUtils.lerp(leftArm.current.rotation.x,  armL, k);  leftArm.current.rotation.z  = THREE.MathUtils.lerp(leftArm.current.rotation.z,  armLz, k); }
    if (rightArm.current) {
      const armK = swinging ? 1 : k; // swing snaps, everything else eases
      rightArm.current.rotation.x = THREE.MathUtils.lerp(rightArm.current.rotation.x, armR, armK);
      rightArm.current.rotation.z = THREE.MathUtils.lerp(rightArm.current.rotation.z, armRz, armK);
    }
    if (leftLeg.current)  leftLeg.current.rotation.x  = THREE.MathUtils.lerp(leftLeg.current.rotation.x,  legL, k);
    if (rightLeg.current) rightLeg.current.rotation.x = THREE.MathUtils.lerp(rightLeg.current.rotation.x, legR, k);

    // body: run lean + idle bob
    if (body.current) {
      const lean = ms.jumping ? -0.08 : ms.running ? 0.22 : ms.moving ? 0.1 : 0;
      body.current.rotation.x = THREE.MathUtils.lerp(body.current.rotation.x, lean, k);
      const bobAmp = ms.moving ? 0.045 : 0.015;
      const bobSpeed = ms.running ? 13 : ms.moving ? 8 : 2;
      body.current.position.y = THREE.MathUtils.lerp(
        body.current.position.y,
        Math.abs(Math.sin(ms.moving ? phase.current : t * bobSpeed)) * bobAmp,
        k,
      );
    }

    // head: gentle look-around when idle, steady when moving
    if (head.current) {
      const lookY = ms.moving ? 0 : Math.sin(t * 0.7) * 0.28;
      const lookX = ms.moving ? -0.05 : Math.sin(t * 0.43) * 0.07;
      head.current.rotation.y = THREE.MathUtils.lerp(head.current.rotation.y, lookY, k * 0.5);
      head.current.rotation.x = THREE.MathUtils.lerp(head.current.rotation.x, lookX, k * 0.5);
    }

    // blink every ~3.4s
    const blink = (t % 3.4) < 0.12 ? 0.12 : 1;
    if (leftEye.current)  leftEye.current.scale.y  = blink;
    if (rightEye.current) rightEye.current.scale.y = blink;

    // cape flutter
    if (cape.current) {
      const flutter = ms.running ? 0.85 : ms.moving ? 0.45 : 0.12;
      cape.current.rotation.x = THREE.MathUtils.lerp(
        cape.current.rotation.x,
        flutter + Math.sin(t * (ms.moving ? 9 : 2.2)) * (ms.moving ? 0.12 : 0.04),
        k,
      );
    }
  });

  return (
    <group ref={body}>
      {/* ── Head (pivot at neck) ── */}
      <group ref={head} position={[0, 1.48, 0]}>
        <mesh castShadow position={[0, 0.18, 0]}>
          <boxGeometry args={[0.68, 0.68, 0.68]} />
          <meshStandardMaterial color="#c98b66" roughness={0.64} />
        </mesh>
        {/* hair */}
        <mesh castShadow position={[0, 0.48, -0.04]}>
          <boxGeometry args={[0.72, 0.26, 0.72]} />
          <meshStandardMaterial color="#1b1010" roughness={0.7} />
        </mesh>
        {/* eyes */}
        <mesh ref={leftEye} position={[-0.16, 0.2, 0.346]}><boxGeometry args={[0.09, 0.08, 0.02]} /><meshStandardMaterial color="#101010" /></mesh>
        <mesh ref={rightEye} position={[0.16, 0.2, 0.346]}><boxGeometry args={[0.09, 0.08, 0.02]} /><meshStandardMaterial color="#101010" /></mesh>
        {/* mouth */}
        <mesh position={[0, 0.04, 0.35]}><boxGeometry args={[0.18, 0.04, 0.02]} /><meshStandardMaterial color="#5a221c" /></mesh>
      </group>

      {/* ── Torso ── */}
      <mesh castShadow position={[0, 1.05, 0]}>
        <boxGeometry args={[0.72, 0.82, 0.62]} />
        <meshStandardMaterial color={outfit.shirt} roughness={0.78} />
      </mesh>
      {/* chest stripe */}
      <mesh position={[0, 1.18, 0.33]}><boxGeometry args={[0.46, 0.18, 0.03]} /><meshStandardMaterial color="#ffe1a0" roughness={0.7} /></mesh>
      {/* backpack */}
      <mesh castShadow position={[0, 1.05, -0.43]}>
        <boxGeometry args={[0.58, 0.62, 0.22]} />
        <meshStandardMaterial color="#172231" roughness={0.72} />
      </mesh>
      {/* cape — hangs from the shoulders, pivots at the top */}
      <mesh ref={cape} castShadow position={[0, 1.45, -0.56]}>
        <boxGeometry args={[0.6, 0.04, 0.02]} />
        <meshStandardMaterial color="#7c2d12" roughness={0.8} />
        <mesh castShadow position={[0, -0.42, 0]}>
          <boxGeometry args={[0.58, 0.82, 0.035]} />
          <meshStandardMaterial color="#9a3412" roughness={0.85} />
        </mesh>
      </mesh>

      {/* ── Arms (pivot at shoulder) ── */}
      <group ref={leftArm} position={[-0.52, 1.42, 0]}>
        <mesh castShadow position={[0, -0.37, 0]}>
          <boxGeometry args={[0.22, 0.74, 0.25]} />
          <meshStandardMaterial color="#c98b66" roughness={0.68} />
        </mesh>
        {/* sleeve */}
        <mesh position={[0, -0.12, 0]}>
          <boxGeometry args={[0.25, 0.28, 0.28]} />
          <meshStandardMaterial color={outfit.shirt} roughness={0.78} />
        </mesh>
      </group>
      <group ref={rightArm} position={[0.52, 1.42, 0]}>
        <mesh castShadow position={[0, -0.37, 0]}>
          <boxGeometry args={[0.22, 0.74, 0.25]} />
          <meshStandardMaterial color="#c98b66" roughness={0.68} />
        </mesh>
        <mesh position={[0, -0.12, 0]}>
          <boxGeometry args={[0.25, 0.28, 0.28]} />
          <meshStandardMaterial color={outfit.shirt} roughness={0.78} />
        </mesh>
        {/* diamond sword — gripped at the hand, pointing forward-up like MC */}
        <group position={[0.02, -0.72, 0.12]} rotation={[-Math.PI / 3.2, 0, 0]}>
          {/* handle */}
          <mesh castShadow position={[0, -0.1, 0]}>
            <boxGeometry args={[0.07, 0.22, 0.07]} />
            <meshStandardMaterial color="#5b3d1f" roughness={0.85} />
          </mesh>
          {/* guard */}
          <mesh castShadow position={[0, 0.04, 0]}>
            <boxGeometry args={[0.2, 0.06, 0.09]} />
            <meshStandardMaterial color="#2c6e63" roughness={0.6} />
          </mesh>
          {/* blade */}
          <mesh castShadow position={[0, 0.36, 0]}>
            <boxGeometry args={[0.1, 0.58, 0.045]} />
            <meshStandardMaterial color="#39d7cd" emissive="#1fa89e" emissiveIntensity={0.55} roughness={0.32} metalness={0.25} />
          </mesh>
          {/* tip */}
          <mesh castShadow position={[0, 0.71, 0]}>
            <boxGeometry args={[0.06, 0.12, 0.045]} />
            <meshStandardMaterial color="#7df0e8" emissive="#2cc3b8" emissiveIntensity={0.7} roughness={0.3} metalness={0.25} />
          </mesh>
        </group>
      </group>

      {/* ── Legs (pivot at hip) ── */}
      <group ref={leftLeg} position={[-0.19, 0.78, 0]}>
        <mesh castShadow position={[0, -0.36, 0]}>
          <boxGeometry args={[0.25, 0.72, 0.28]} />
          <meshStandardMaterial color={outfit.pants} roughness={0.76} />
        </mesh>
        <mesh castShadow position={[0, -0.73, 0.08]}>
          <boxGeometry args={[0.28, 0.12, 0.38]} />
          <meshStandardMaterial color="#0f0e0d" roughness={0.7} />
        </mesh>
      </group>
      <group ref={rightLeg} position={[0.19, 0.78, 0]}>
        <mesh castShadow position={[0, -0.36, 0]}>
          <boxGeometry args={[0.25, 0.72, 0.28]} />
          <meshStandardMaterial color={outfit.pants} roughness={0.76} />
        </mesh>
        <mesh castShadow position={[0, -0.73, 0.08]}>
          <boxGeometry args={[0.28, 0.12, 0.38]} />
          <meshStandardMaterial color="#0f0e0d" roughness={0.7} />
        </mesh>
      </group>

      <Text position={[0,2.48,0]} fontSize={0.15} anchorX="center" color="#fff3df" outlineColor="#1c1208" outlineWidth={0.006}>{name}</Text>
    </group>
  );
}
