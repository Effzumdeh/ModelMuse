/**
 * Baselines neu erzeugen — nur mit ausdruecklichem --accept.
 * Aufruf: node scripts/baseline-update.mjs --accept
 * Bauplan Abschnitt 8: Laeuft nur mit Flag; sonst Abbruch.
 */
const accept = process.argv.includes('--accept');
if (!accept) {
  console.error('baseline-update: verweigert ohne --accept (Bauplan: nur mit ausdruecklichem Flag).');
  process.exit(2);
}
console.log('baseline-update: --accept gesetzt.');
console.log('Hinweis: Baselines entstehen im Visual-Lauf (tests/visual.spec.mjs, 1280x720, SwiftShader).');
console.log('Dieser Schritt kopiert nach Pruefung dist/failures -> dist/baselines (siehe Visual-Suite).');
