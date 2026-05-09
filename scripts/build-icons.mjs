// Regenerate PWA icons from scripts/icon-source.jpeg.
// Re-run any time the source icon changes:  npm run icons
//
// Outputs (in frontend/public/icons/):
//   favicon-32.png          — 32×32 PNG, browser tab favicon
//   icon-192.png            — 192×192 PNG, used for apple-touch-icon + manifest
//   icon-512.png            — 512×512 PNG, manifest "any" purpose
//   icon-512-maskable.png   — 512×512 PNG with 80% safe-zone padding on a brand
//                             background — Android adaptive icon support
//
// The source jpeg lives outside public/ so Vite doesn't ship it in dist/.

import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ICON_DIR = path.resolve(__dirname, '..', 'frontend', 'public', 'icons');
const SOURCE = path.resolve(__dirname, 'icon-source.jpeg');
const BG = '#0B132B'; // SafeCircles brand background

async function build() {
  // 192×192 — straightforward fit-cover resize
  await sharp(SOURCE).resize(192, 192, { fit: 'cover' }).png().toFile(path.join(ICON_DIR, 'icon-192.png'));

  // 512×512 — same, larger
  await sharp(SOURCE).resize(512, 512, { fit: 'cover' }).png().toFile(path.join(ICON_DIR, 'icon-512.png'));

  // 512×512 maskable — icon at ~80% (410×410) centred on a brand-colour square.
  // This keeps the visible art inside the safe zone Android uses for adaptive
  // icon shapes (circle, squircle, rounded square).
  const inner = await sharp(SOURCE).resize(410, 410, { fit: 'cover' }).png().toBuffer();
  await sharp({
    create: { width: 512, height: 512, channels: 4, background: BG },
  })
    .composite([{ input: inner, gravity: 'center' }])
    .png()
    .toFile(path.join(ICON_DIR, 'icon-512-maskable.png'));

  // Browser tab favicon — modern browsers accept PNG via <link rel="icon">.
  await sharp(SOURCE).resize(32, 32, { fit: 'cover' }).png().toFile(path.join(ICON_DIR, 'favicon-32.png'));

  console.log('Icons regenerated in', ICON_DIR);
}

build().catch((err) => {
  console.error('Icon generation failed:', err);
  process.exit(1);
});
