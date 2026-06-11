# Samyak Rao / SAM31GRAPHICS — SAMYAKCRAFT

A fullscreen realtime **multiplayer** 3D Minecraft-style portfolio world built with Next.js, React Three Fiber, drei, Rapier physics, GSAP, Framer Motion, postprocessing, Three.js, Zustand, and a ws WebSocket server.

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. (`npm run dev` runs `node server.js --dev` — the custom server that hosts both Next.js and the multiplayer WebSocket endpoint at `/mp`.)

## Controls

- `WASD` / arrow keys (`↑ ↓ ← →`): move Samyak
- `Shift`: run (camera FOV kicks, dust particles)
- Mouse drag: rotate third-person camera
- Quick click / `F`: swing the diamond sword
- `E`: open inventory (use the Bed to sleep and skip to day/night)
- `Space`: jump / interact with nearby objects
- `1–5`: hotbar teleport to any portal
- Sun/Moon button (top right): day–night cycle with stars

## Multiplayer

Every visitor appears in the world as a Minecraft-style character with a
server-assigned name and outfit color. Sword swings near another player do
20 damage — 5 hits and they respawn at the hub. Health hearts and a "players
online" counter live in the HUD. All realtime logic is in `server.js`
(authoritative server) and `lib/multiplayer-client.ts` (client).

## World Features

- **5 working nether portals** — walk through one to enter its room:
  - Video Edits → Blender-rendered YouTube room with a playable TV
  - Thumbnail Design → 3D voxel "Creator Den" gallery
  - Photography → photo studio room + full gallery overlay
  - Blender 3D → 3D voxel "Nether Lab" gallery
  - Beyond The Lens → 3D voxel "End Observatory" gallery (travel photos)
- **XP system** — 12 collectible XP orbs scattered around the village, Minecraft-style XP bar + hotbar HUD
- **Achievement toasts** — "Achievement Get!" popups for orbs and portal discoveries
- **Jointed character** — shoulder/hip-pivoted limbs, idle look-around, blinking, run lean, jump pose, fluttering cape, dust particles
- **Living world** — wandering voxel pig, flickering torches, swirling portal particles, day/night cycle
- Minecraft splash text on the intro screen

## Dynamic Media Folders

The world automatically scans these folders at build/runtime on the server:

```text
public/assets/videos/editing/
public/assets/images/photography/
public/assets/images/blender/
public/assets/images/thumbnails/
public/assets/images/travel/
```

Supported media: `mp4`, `mov`, `webm`, `jpg`, `jpeg`, `png`, `webp`, `avif`.

## Render Deployment

The project includes `render.yaml`.

Build command:

```bash
npm install && npm run build
```

Start command:

```bash
npm run start
```

## Contact Link

The in-world phone booth opens:

```text
https://wa.me/917975581571?text=Hey%20Samyak,%20I%20saw%20your%20portfolio.
```
