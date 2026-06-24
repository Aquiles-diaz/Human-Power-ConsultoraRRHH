// Genera assets livianos a partir de los logos pesados, SIN pisar los originales.
// Reejecutable: `npm run optimize:images`.
//
//   public/logohumap-sinfondo.png (540K)  ->  public/favicon.png (64x64)
//                                             public/apple-touch-icon.png (180x180)
//                                             public/logo.png (512px, para JSON-LD Organization)
//   public/logohumap-white.png            ->  public/og-image.png (1200x630, formato social)
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { statSync } from "node:fs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pub = (p) => path.join(root, "public", p);
const kb = (p) => (statSync(p).size / 1024).toFixed(1) + "K";

// Favicon: logo a color sobre transparente, 64x64, en paleta para que pese poco.
await sharp(pub("logohumap-sinfondo.png"))
  .resize(64, 64, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png({ compressionLevel: 9, palette: true })
  .toFile(pub("favicon.png"));

// Apple touch icon: 180x180 sobre fondo blanco (iOS no respeta transparencia).
await sharp(pub("logohumap-sinfondo.png"))
  .resize(160, 160, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
  .extend({ top: 10, bottom: 10, left: 10, right: 10, background: { r: 255, g: 255, b: 255, alpha: 1 } })
  .png({ compressionLevel: 9 })
  .toFile(pub("apple-touch-icon.png"));

// Logo optimizado a color (transparente), max 512px, para el JSON-LD Organization.
await sharp(pub("logohumap-sinfondo.png"))
  .resize(512, 512, { fit: "inside" })
  .png({ compressionLevel: 9, palette: true })
  .toFile(pub("logo.png"));

// OG image: logo blanco centrado sobre fondo negro de marca, 1200x630 (preview social).
const W = 1200;
const H = 630;
const logo = await sharp(pub("logohumap-white.png")).resize(560, 560, { fit: "inside" }).toBuffer();
await sharp({
  create: { width: W, height: H, channels: 4, background: { r: 10, g: 10, b: 10, alpha: 1 } },
})
  .composite([{ input: logo, gravity: "center" }])
  .png({ compressionLevel: 9, palette: true })
  .toFile(pub("og-image.png"));

console.log("Assets generados:");
for (const f of ["favicon.png", "apple-touch-icon.png", "logo.png", "og-image.png"]) {
  console.log(`  public/${f}  ->  ${kb(pub(f))}`);
}
