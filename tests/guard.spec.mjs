/**
 * Standalone-Guard-Suite: registerFree wirft E-FREE-FORBID nur noch fuer echte
 * Frame-Flucht (window.top, parent.document), nicht fuer Torlatte/Kommentare.
 */
import { test, expect } from '@playwright/test';

const URL = '/dist-standalone/modelmuse-standalone.html';

async function ready(page) {
  await page.goto(URL);
  await page.waitForFunction(
    () => (document.querySelector('aside h2')?.textContent ?? '').includes('Modelle'),
    { timeout: 60000 },
  );
  await page.waitForSelector('aside li', { timeout: 30000 });
}

const MOD = (extra) => `import { Mesh } from 'three';\nexport const meta = {title:"Torlatte H1",parts:["A","B","C"],category:"hardware"};\nexport function init(c){ ${extra} return {update(){},dispose(){}}; }`;

async function check(page, id, src) {
  return page.evaluate(
    ({ id, src }) => {
      try {
        const r = window.__viewer.registerFree(id, src);
        return { ok: true, title: r.meta.title };
      } catch (e) {
        return { ok: false, err: String((e && e.message) || e) };
      }
    },
    { id, src },
  );
}

test('Guard: const top + Kommentar ok, window.top/parent.document weiter FORBID', async ({ page }) => {
  await ready(page);
  const tor = await check(page, 'g-torlatte', MOD('const top = 2.44;'));
  expect(tor.ok, `Torlatte muss laden, got: ${JSON.stringify(tor)}`).toBe(true);
  const com = await check(page, 'g-comment', MOD('const label = "top edge";\n// top edge\n'));
  expect(com.ok, `Kommentar/String muss laden, got: ${JSON.stringify(com)}`).toBe(true);
  const wtop = await check(page, 'g-wtop', MOD('var x = window.top;'));
  expect(wtop.ok).toBe(false);
  expect(wtop.err).toMatch(/E-FREE-FORBID/);
  const pdoc = await check(page, 'g-pdoc', MOD('var d = parent.document;'));
  expect(pdoc.ok).toBe(false);
  expect(pdoc.err).toMatch(/E-FREE-FORBID/);
  const post = await check(page, 'g-post', MOD('top.postMessage("x","*");'));
  expect(post.ok).toBe(false);
  expect(post.err).toMatch(/E-FREE-FORBID: top/);
});
