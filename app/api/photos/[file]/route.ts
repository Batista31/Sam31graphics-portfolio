import fs from "node:fs/promises";
import path from "node:path";

const photoRoot = path.resolve(process.cwd(), "..", "Photos");
const contentTypes: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif"
};

type RouteContext = {
  params: Promise<{ file: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { file } = await context.params;
  const safeFile = path.basename(file);

  if (safeFile !== file) {
    return new Response("Invalid photo path", { status: 400 });
  }

  const extension = path.extname(safeFile).toLowerCase();
  const contentType = contentTypes[extension];

  if (!contentType) {
    return new Response("Unsupported photo type", { status: 415 });
  }

  const absolute = path.join(photoRoot, safeFile);
  const resolved = path.resolve(absolute);

  if (!resolved.startsWith(photoRoot)) {
    return new Response("Invalid photo path", { status: 400 });
  }

  try {
    const bytes = await fs.readFile(resolved);
    return new Response(bytes, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600"
      }
    });
  } catch {
    return new Response("Photo not found", { status: 404 });
  }
}
