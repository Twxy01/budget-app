/**
 * Génère les icônes de l'app à partir de `logo.png` (la tuile carrée du logo).
 * À relancer si le logo change : `node scripts/generate-icons.mjs`.
 */
import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';

const SOURCE = 'logo.png';

/** Repère la tuile colorée dans le logo, qui est posé sur un fond clair. */
async function findTile() {
  const image = sharp(SOURCE);
  const { width, height } = await image.metadata();
  const { data, info } = await image
    .clone()
    .resize(200, 200, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Le fond du logo est crème ; la tuile et le texte sont nettement plus sombres.
  const isDark = (x, y) => {
    const i = (y * info.width + x) * info.channels;
    return (data[i] + data[i + 1] + data[i + 2]) / 3 < 200;
  };

  // La tuile est la première bande épaisse en partant du haut ; le texte, plus bas, est fin.
  const rowCount = (y) => {
    let n = 0;
    for (let x = 0; x < info.width; x++) if (isDark(x, y)) n++;
    return n;
  };
  // Le seuil de sortie est bas : au milieu de la tuile, le « S » clair réduit le compte.
  let minY = -1;
  let maxY = -1;
  for (let y = 0; y < info.height; y++) {
    const count = rowCount(y);
    if (minY === -1 && count > info.width * 0.15) minY = y;
    if (minY !== -1 && count < info.width * 0.02) {
      maxY = y - 1;
      break;
    }
  }
  if (minY === -1) throw new Error('Tuile introuvable dans le logo.');
  if (maxY === -1) maxY = info.height - 1;

  let minX = info.width;
  let maxX = -1;
  for (let y = minY; y <= maxY; y++) {
    for (let x = 0; x < info.width; x++) {
      if (!isDark(x, y)) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
    }
  }

  const scaleX = width / info.width;
  const scaleY = height / info.height;
  return {
    left: Math.round(minX * scaleX),
    top: Math.round(minY * scaleY),
    width: Math.round((maxX - minX + 1) * scaleX),
    height: Math.round((maxY - minY + 1) * scaleY),
  };
}

const tile = await findTile();
// La tuile a ses propres coins arrondis : on garde l'intérieur, que l'on recompose
// sur un aplat de la même couleur pour que les icônes soient pleines à tous les formats.
const inset = Math.round(Math.min(tile.width, tile.height) * 0.1);
const inner = {
  left: tile.left + inset,
  top: tile.top + inset,
  width: tile.width - inset * 2,
  height: tile.height - inset * 2,
};

const { data: corner } = await sharp(SOURCE)
  .extract({ left: inner.left + 2, top: inner.top + 2, width: 4, height: 4 })
  .raw()
  .toBuffer({ resolveWithObject: true });
const background = { r: corner[0], g: corner[1], b: corner[2], alpha: 1 };
const hex = `#${[corner[0], corner[1], corner[2]].map((v) => v.toString(16).padStart(2, '0')).join('')}`;

// Le fond de la tuile est légèrement dégradé : recomposer un morceau tel quel laisserait une
// couture visible. On détoure donc le « S » clair, et on le repose sur un aplat.
const { data: pixels, info: innerInfo } = await sharp(SOURCE)
  .extract(inner)
  .raw()
  .toBuffer({ resolveWithObject: true });

const rgba = Buffer.alloc(innerInfo.width * innerInfo.height * 4);
for (let p = 0; p < innerInfo.width * innerInfo.height; p++) {
  const i = p * innerInfo.channels;
  const [r, g, b] = [pixels[i], pixels[i + 1], pixels[i + 2]];
  const brightness = (r + g + b) / 3;
  // Transition douce pour garder l'anticrénelage des bords arrondis.
  const alpha = Math.max(0, Math.min(255, Math.round(((brightness - 70) / 50) * 255)));
  rgba.set([r, g, b, alpha], p * 4);
}

const glyph = await sharp(rgba, {
  raw: { width: innerInfo.width, height: innerInfo.height, channels: 4 },
})
  .trim({ threshold: 1 })
  .png()
  .toBuffer();

/** Icône pleine : l'intérieur de la tuile, centré sur son fond, avec la marge demandée. */
async function icon(name, size, coverage) {
  const inset = Math.round((size * (1 - coverage)) / 2);
  const scaled = await sharp(glyph)
    .resize(size - inset * 2, size - inset * 2, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input: scaled, top: inset, left: inset }])
    .png()
    .toFile(`public/${name}`);
  console.log('✓', name);
}

await mkdir('public', { recursive: true });
await icon('icon-192.png', 192, 0.86);
await icon('icon-512.png', 512, 0.86);
// Android rogne les bords des icônes maskables : on laisse de la marge autour du symbole.
await icon('icon-maskable-512.png', 512, 0.64);
await icon('apple-touch-icon.png', 180, 0.86);
await icon('favicon.png', 64, 0.9);
console.log('Couleur de fond du logo :', hex);
