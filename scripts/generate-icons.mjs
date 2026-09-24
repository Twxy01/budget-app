/**
 * Génère les icônes de l'app à partir d'un SVG.
 * À relancer seulement si le dessin change : `node scripts/generate-icons.mjs`.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const GREEN = '#23694a';

/** Enveloppe blanche avec une jauge, sur fond vert. `pad` laisse la marge des icônes maskables. */
const svg = (size, pad) => {
  const s = size;
  const m = s * pad;
  const w = s - m * 2;
  const h = w * 0.66;
  const top = (s - h) / 2 - w * 0.04;
  const r = w * 0.08;
  const barY = top + h + w * 0.16;
  const barH = w * 0.1;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <rect width="${s}" height="${s}" fill="${GREEN}"/>
  <rect x="${m}" y="${top}" width="${w}" height="${h}" rx="${r}" fill="#ffffff"/>
  <path d="M${m} ${top + r} L${m + w / 2} ${top + h * 0.58} L${m + w} ${top + r}"
        fill="none" stroke="${GREEN}" stroke-width="${w * 0.09}" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="${m}" y="${barY}" width="${w}" height="${barH}" rx="${barH / 2}" fill="#ffffff" opacity="0.35"/>
  <rect x="${m}" y="${barY}" width="${w * 0.62}" height="${barH}" rx="${barH / 2}" fill="#ffffff"/>
</svg>`;
};

const targets = [
  ['icon-192.png', 192, 0.17],
  ['icon-512.png', 512, 0.17],
  ['icon-maskable-512.png', 512, 0.26],
  ['apple-touch-icon.png', 180, 0.15],
];

await mkdir('public', { recursive: true });
for (const [name, size, pad] of targets) {
  await sharp(Buffer.from(svg(size, pad))).png().toFile(`public/${name}`);
  console.log('✓', name);
}
await writeFile('public/favicon.svg', svg(64, 0.15));
console.log('✓ favicon.svg');
