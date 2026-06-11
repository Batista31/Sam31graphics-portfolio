import fs from "node:fs";
import path from "node:path";

const output = path.join(process.cwd(), "public", "models", "samyak-character", "samyak.glb");
fs.mkdirSync(path.dirname(output), { recursive: true });

if (!fs.existsSync(output)) {
  const json = JSON.stringify({
    asset: { version: "2.0", generator: "SAM31GRAPHICS procedural placeholder" },
    scene: 0,
    scenes: [{ nodes: [] }],
    nodes: []
  });
  const jsonBuffer = Buffer.from(json.padEnd(Math.ceil(json.length / 4) * 4, " "), "utf8");
  const totalLength = 12 + 8 + jsonBuffer.length;
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLength, 8);
  const chunkHeader = Buffer.alloc(8);
  chunkHeader.writeUInt32LE(jsonBuffer.length, 0);
  chunkHeader.writeUInt32LE(0x4e4f534a, 4);
  fs.writeFileSync(output, Buffer.concat([header, chunkHeader, jsonBuffer]));
}
