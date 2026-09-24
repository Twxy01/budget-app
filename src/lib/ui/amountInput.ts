/** Touches du pavé numérique, dans l'ordre d'affichage. */
export const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'];

/** Applique une touche à la saisie en cours (au plus 2 décimales et 6 chiffres). */
export function pressKey(raw: string, key: string): string {
  if (key === '⌫') return raw.slice(0, -1);
  if (key === '.') return raw.includes('.') ? raw : (raw || '0') + '.';
  const [int, dec] = raw.split('.');
  if (dec !== undefined ? dec.length >= 2 : int.length >= 6) return raw;
  return raw === '0' ? key : raw + key;
}

/** Touche correspondant à un évènement clavier, ou null si la touche ne nous concerne pas. */
export function keyFromEvent(key: string): string | null {
  if (key === 'Backspace') return '⌫';
  if (key === ',' || key === '.') return '.';
  return /^\d$/.test(key) ? key : null;
}
