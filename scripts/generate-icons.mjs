// Rasterises the SVG brand mark into PWA / Apple / favicon icons.
// Run with `npm run icons` after changing public/icons/mark.svg.
import sharp from "sharp";
import { readFile, writeFile } from "node:fs/promises";

const svg = await readFile(new URL("../public/icons/mark.svg", import.meta.url));
const navy = { r: 15, g: 32, b: 39, alpha: 1 };

async function plain(size, out) {
  await sharp(svg, { density: 512 }).resize(size, size).png().toFile(out);
}

// Maskable + Apple icons: mark centred on navy with safe-zone padding.
async function padded(size, pad, out) {
  const inner = Math.round(size * (1 - pad * 2));
  const mark = await sharp(svg, { density: 512 }).resize(inner, inner).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: navy } })
    .composite([{ input: mark, gravity: "center" }])
    .png()
    .toFile(out);
}

await padded(192, 0.12, "public/icons/icon-192.png");
await padded(512, 0.12, "public/icons/icon-512.png");
await padded(512, 0.2, "public/icons/maskable-512.png");
await padded(180, 0.12, "src/app/apple-icon.png");
await plain(32, "public/icons/favicon-32.png");
await writeFile("src/app/icon.svg", svg);
console.log("icons generated");
