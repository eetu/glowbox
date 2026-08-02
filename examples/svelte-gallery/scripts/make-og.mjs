// Generate the social card (static/og.png, 1200×630) with the library itself —
// the neon core bends the wordmark, so the card can never drift from what the
// packages actually render. Needs the cores BUILT (`yarn build`), then:
//
//   node scripts/make-og.mjs
//
// Re-run it when the wordmark, the core list or the neon renderer changes, and commit
// the PNG — it is a static asset, not a build artefact.
//
// The bold entry is NEON because neon draws this card. It is not "the newest core", so
// it does not move when one is added; the list carries no count for the same reason.
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..'); // repo root: packages/* are served from it
const require = createRequire(join(here, '../package.json'));
const { chromium } = require('playwright');

const html = `<!doctype html>
<meta charset="utf-8" />
<style>
  html, body { margin: 0; background: #08080b; }
  .card {
    width: 1200px; height: 630px; position: relative; overflow: hidden;
    font-family: -apple-system, system-ui, sans-serif;
    background: #0a0a0e;
  }
  /* Full-bleed: the sign paints its own wall edge to edge, so no canvas box can
     seam against the CSS background (canvas compositing isn't bit-identical). */
  /* Taller than the card and hung above it: the sign centres in ITS box, which
     lifts the wordmark clear of the captions while the wall still covers every
     edge of the card. */
  #sign { position: absolute; top: -215px; left: 0; width: 1200px; height: 900px; display: block; }
  .cores {
    position: absolute; left: 0; right: 0; top: 462px; text-align: center;
    color: #8b8b96; font-size: 25px; letter-spacing: 0.02em; font-weight: 500;
  }
  .cores b { color: #ffb457; font-weight: 600; }
  .tag {
    position: absolute; bottom: 34px; left: 0; right: 0; text-align: center;
    color: #6a6a75; font-size: 21px;
    letter-spacing: 0.06em; text-transform: uppercase;
  }
</style>
<div class="card">
  <canvas id="sign"></canvas>
  <div class="cores">
    LED grid · nixie · seven-segment · flip-dot · split-flap · <b>neon</b> · VFD · LCD
  </div>
  <div class="tag">glowing display components for the web</div>
</div>
<script type="module">
  import { createNeonSign } from '/packages/neon/dist/index.js';
  // The newest core draws the product name: script glass, warm gold, on the wall.
  const sign = createNeonSign(document.getElementById('sign'), {
    text: 'glowbox',
    gas: 'gold',
    glow: 0.8,
    wall: '#0a0a0e',   // the sign IS the card's background
    strikeMs: 0,       // a still frame wants the settled sign
    padding: 0.13,
    tilt: -3,          // the faintest rise, like a real window sign
    label: ''
  });
  window.__ready = !!sign;
</script>`;

const server = createServer((req, res) => {
	const url = new URL(req.url, 'http://x').pathname;
	if (url === '/') {
		res.writeHead(200, { 'content-type': 'text/html' });
		return res.end(html);
	}
	try {
		const body = readFileSync(join(root, decodeURIComponent(url)));
		res.writeHead(200, extname(url) === '.js' ? { 'content-type': 'text/javascript' } : {});
		res.end(body);
	} catch {
		res.writeHead(404);
		res.end();
	}
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const { port } = server.address();
const browser = await chromium.launch();
const page = await browser.newPage({
	viewport: { width: 1200, height: 630 },
	deviceScaleFactor: 1
});
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
await page.goto(`http://127.0.0.1:${port}/`);
await page.waitForFunction(() => window.__ready === true, undefined, { timeout: 15000 });
await page.waitForTimeout(600);
const out = join(here, '../static/og.png');
await page.locator('.card').screenshot({ path: out });
if (errs.length) console.log('ERRORS', errs);
console.log('wrote', out);
await browser.close();
server.close();
