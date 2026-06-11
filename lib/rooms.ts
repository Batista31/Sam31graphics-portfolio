import type { RoomId } from "@/store/world-store";

export type RoomDefinition = {
  id: RoomId;
  label: string;
  short: string;
  color: string;
  position: [number, number, number];
  copy: string;
};

export const rooms: RoomDefinition[] = [
  {
    id: "video",
    label: "Video Editing",
    short: "Beat sync, chaos, timing",
    color: "#37f4ff",
    position: [-8, 0, -8],
    copy: "A cyberpunk studio of floating cuts, glowing timelines, and gaming memories."
  },
  {
    id: "photo",
    label: "Photography",
    short: "Light, travel, memory",
    color: "#ffb45f",
    position: [8, 0, -8],
    copy: "A dream gallery where deserts, rivers, butterflies, and travel fragments drift in warm air."
  },
  {
    id: "blender",
    label: "Blender / 3D",
    short: "Shaders, forms, experiments",
    color: "#b264ff",
    position: [-8, 0, 8],
    copy: "A neon lab for shader balls, potion bottles, arcade forms, and imagined rooms."
  },
  {
    id: "thumbnails",
    label: "Thumbnail Design",
    short: "Impact, drama, click energy",
    color: "#ff4f8b",
    position: [8, 0, 8],
    copy: "A creator battle station of loud frames, layered drama, and glowing visual hooks."
  }
];
