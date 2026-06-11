import fs from "node:fs";
import path from "node:path";

export type MediaKind = "image" | "video" | "audio" | "model";

export type MediaAsset = {
  id: string;
  title: string;
  src: string;
  folder: string;
  kind: MediaKind;
  extension: string;
};

const publicRoot = path.join(process.cwd(), "public");
const externalPhotoRoot = path.resolve(process.cwd(), "..", "Photos");
const naturalCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
const extensions: Record<MediaKind, string[]> = {
  image: [".jpg", ".jpeg", ".png", ".webp", ".avif"],
  video: [".mp4", ".mov", ".webm"],
  audio: [".mp3", ".wav", ".ogg", ".m4a"],
  model: [".glb", ".gltf"]
};

function titleize(fileName: string) {
  return path
    .parse(fileName)
    .name
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
}

function kindFromExtension(extension: string): MediaKind | null {
  const lower = extension.toLowerCase();
  const found = Object.entries(extensions).find(([, values]) => values.includes(lower));
  return found ? (found[0] as MediaKind) : null;
}

export function scanPublicFolder(folder: string): MediaAsset[] {
  const absolute = path.join(publicRoot, folder);

  if (!fs.existsSync(absolute)) {
    return [];
  }

  return fs
    .readdirSync(absolute, { withFileTypes: true })
    .flatMap((entry) => {
      const relative = path.join(folder, entry.name).replaceAll("\\", "/");

      if (entry.isDirectory()) {
        return scanPublicFolder(relative);
      }

      const extension = path.extname(entry.name);
      const kind = kindFromExtension(extension);

      if (!kind) {
        return [];
      }

      return [
        {
          id: relative.replace(/[^a-z0-9]/gi, "-").toLowerCase(),
          title: titleize(entry.name),
          src: `/${relative}`,
          folder,
          kind,
          extension: extension.toLowerCase()
        }
      ];
    })
    .sort((a, b) => a.title.localeCompare(b.title));
}

function photoSortValue(fileName: string) {
  const baseName = path.parse(fileName).name;
  const isNumberedFrame = /^\d+$/.test(baseName);
  return {
    rank: isNumberedFrame ? 0 : 1,
    number: isNumberedFrame ? Number(baseName) : Number.POSITIVE_INFINITY,
    name: fileName
  };
}

export function scanPhotoFolder(): MediaAsset[] {
  if (!fs.existsSync(externalPhotoRoot)) {
    return scanPublicFolder("assets/images/photography");
  }

  return fs
    .readdirSync(externalPhotoRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .flatMap((entry) => {
      const extension = path.extname(entry.name);
      const kind = kindFromExtension(extension);

      if (kind !== "image") {
        return [];
      }

      return [
        {
          id: `photos-${entry.name.replace(/[^a-z0-9]/gi, "-").toLowerCase()}`,
          title: titleize(entry.name),
          src: `/api/photos/${encodeURIComponent(entry.name)}`,
          folder: externalPhotoRoot,
          kind,
          extension: extension.toLowerCase()
        }
      ];
    })
    .sort((a, b) => {
      const left = photoSortValue(path.basename(a.src));
      const right = photoSortValue(path.basename(b.src));

      if (left.rank !== right.rank) return left.rank - right.rank;
      if (left.number !== right.number) return left.number - right.number;
      return naturalCollator.compare(decodeURIComponent(left.name), decodeURIComponent(right.name));
    });
}

export type PortfolioRegistry = {
  editing: MediaAsset[];
  photography: MediaAsset[];
  blender: MediaAsset[];
  thumbnails: MediaAsset[];
  travel: MediaAsset[];
  audio: {
    ambient: MediaAsset[];
    room: MediaAsset[];
    ui: MediaAsset[];
  };
};

export function getPortfolioRegistry(): PortfolioRegistry {
  return {
    editing: scanPublicFolder("assets/videos/editing"),
    photography: scanPhotoFolder(),
    blender: scanPublicFolder("assets/images/blender"),
    thumbnails: scanPublicFolder("assets/images/thumbnails"),
    travel: scanPublicFolder("assets/images/travel"),
    audio: {
      ambient: scanPublicFolder("audio/ambient"),
      room: scanPublicFolder("audio/room"),
      ui: scanPublicFolder("audio/ui")
    }
  };
}
