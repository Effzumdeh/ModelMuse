/**
 * F3/F4-Fallback: Canvas-2D-Ersatzansicht mit Bauteilliste und Massen.
 * Bauplan Abschnitt 4 (renderFallback2D) und Abschnitt 9 (F3/F4).
 */

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ title?: string, labels?: string[], measurements?: Array<{ text?: string, unit?: string }>, objectives?: string[] }} manifest
 * @param {string} level
 */
export function renderFallback2D(canvas, manifest, level) {
  if (!canvas || typeof canvas.getContext !== 'function') {
    throw Object.assign(new Error('E-FALLBACK-2D: kein Canvas'), { code: 'E-FALLBACK-2D' });
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw Object.assign(new Error('E-FALLBACK-2D: kein 2d-Kontext'), { code: 'E-FALLBACK-2D' });
  }
  const W = canvas.width || 1280;
  const H = canvas.height || 720;
  ctx.fillStyle = '#10141c';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ffd34d';
  ctx.fillRect(0, 0, W, 64);
  ctx.fillStyle = '#10141c';
  ctx.font = 'bold 28px system-ui, sans-serif';
  ctx.fillText('2D-Modus (Fallback F3)', 24, 42);
  ctx.fillStyle = '#f5f7fa';
  ctx.font = 'bold 30px system-ui, sans-serif';
  const title = typeof manifest?.title === 'string' ? manifest.title : 'Modell';
  ctx.fillText(title, 24, 110);
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillStyle = '#9fb2c8';
  ctx.fillText(`Niveau: ${level}`, 24, 142);
  const labels = Array.isArray(manifest?.labels) ? manifest.labels : [];
  const shown = level === 'basis' ? labels.slice(0, 5) : labels;
  ctx.fillStyle = '#f5f7fa';
  ctx.font = '22px system-ui, sans-serif';
  ctx.fillText('Bauteile:', 24, 184);
  ctx.font = '20px system-ui, sans-serif';
  let y = 214;
  const max = level === 'basis' ? 5 : 24;
  for (const label of shown.slice(0, max)) {
    if (y > H - 120) break;
    ctx.fillStyle = '#4dd2ff';
    ctx.fillRect(24, y - 14, 10, 10);
    ctx.fillStyle = '#e8edf3';
    ctx.fillText(String(label), 44, y);
    y += 30;
  }
  const measurements = Array.isArray(manifest?.measurements) ? manifest.measurements : [];
  if (level !== 'basis' && measurements.length > 0) {
    y += 10;
    ctx.fillStyle = '#f5f7fa';
    ctx.font = '22px system-ui, sans-serif';
    ctx.fillText('Bemaßung:', 24, y);
    y += 30;
    ctx.font = '20px system-ui, sans-serif';
    for (const m of measurements.slice(0, 6)) {
      if (y > H - 60) break;
      ctx.fillStyle = '#ffd34d';
      ctx.fillText(`↔ ${m?.text ?? ''}`, 44, y);
      y += 30;
    }
  }
  // Schematische Karte rechts: Bauteil-Kaestchen als Platzhalter.
  const boxX = Math.floor(W * 0.45);
  const boxW = W - boxX - 40;
  ctx.strokeStyle = '#3a4657';
  ctx.lineWidth = 2;
  ctx.strokeRect(boxX, 90, boxW, H - 140);
  ctx.fillStyle = '#9fb2c8';
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillText('Schematische Ansicht (3D nicht verfuegbar)', boxX + 16, 120);
  const n = Math.min(shown.length, 10);
  for (let i = 0; i < n; i += 1) {
    const bx = boxX + 30 + (i % 2) * (boxW / 2 - 20);
    const by = 150 + Math.floor(i / 2) * 96;
    if (by > H - 90) break;
    ctx.fillStyle = i % 2 === 0 ? '#1d3a52' : '#3a2f14';
    ctx.fillRect(bx, by, boxW / 2 - 50, 64);
    ctx.fillStyle = '#e8edf3';
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText(String(shown[i]).slice(0, 26), bx + 10, by + 38);
  }
  ctx.fillStyle = '#9fb2c8';
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillText('Status-Badge: auto-geprueft mit Einschraenkung (F3)', 24, H - 24);
}
