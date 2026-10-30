/**
 * Render-Dispatcher fuer alle fuenf 2D-Varianten (hostseitig, kein Guest).
 * Lib liegt im Vendor (src/vendor/*-2d.js), Module liefern nur Daten.
 * Ein Einstieg fuer Player, Standalone, Shot- und Smoke-Skripte.
 */
import { renderDiagram2D } from '../vendor/diagram-2d.js';
import { renderMermaid2D } from '../vendor/mermaid-2d.js';
import { renderChart2D } from '../vendor/chart-2d.js';
import { renderGraph2D } from '../vendor/d3-2d.js';
import { renderMath2D } from '../vendor/katex-2d.js';
import { twoDVariantOf, extractTwoDLiteral, TWOD_VARIANT_LITERAL } from './verify-2d.js';

/**
 * Rendert ein 2D-Datenmodul in einen Container (dispatch per 2d-*-Import).
 * @param {HTMLElement} container
 * @param {string} source Modulquelle
 */
export function renderTwoDSource(container, source) {
  const variant = twoDVariantOf(String(source));
  if (!variant) {
    throw Object.assign(new Error('E-2D-VARIANTE: kein 2d-*-Import'), { code: 'E-2D-VARIANTE' });
  }
  const data = extractTwoDLiteral(String(source), TWOD_VARIANT_LITERAL[variant]) ?? {};
  if (variant === 'svg') return { variant, ...renderDiagram2D(container, /** @type {any} */ (data ?? {})) };
  if (variant === 'mermaid') return { variant, ...renderMermaid2D(container, /** @type {any} */ (data ?? {})) };
  if (variant === 'chart') return { variant, ...renderChart2D(container, /** @type {any} */ (data ?? {})) };
  if (variant === 'd3') return { variant, ...renderGraph2D(container, /** @type {any} */ (data ?? {})) };
  return { variant, ...renderMath2D(container, /** @type {any} */ (data ?? {})) };
}
