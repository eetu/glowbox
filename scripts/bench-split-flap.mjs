// Manual benchmark for @glowbox/split-flap — frame throughput AND canvas budget, measured
// on the BUILT package in a real browser with vsync uncapped:
//
//   node scripts/bench-split-flap.mjs
//
// This core is sprite-based: every flap face is baked once into its own small canvas
// (top half + bottom half), the shaded look adds two board-sized layers, and a frame is
// then drawImage calls. That trades memory for per-frame cost, so the interesting
// numbers are BOTH — fps while the whole board is mid-cascade (the worst case: a wrapping
// drum flips every module at once) and how much canvas backing store the bake allocated
// to get there.
//
// `canvases` counts every canvas the core created during setup + the run, and `alloc`
// sums their backing stores (w × h × 4 B) at creation time. Temporaries (the full card
// and its glyph layer, both dropped once the halves are sliced) are counted too, since
// they are what the GC sees; `retained` is the part still held in the face cache and the
// board layers afterwards.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SECONDS = 3;

const DIGITS = ' 0123456789:.-';

const SCENARIOS = [
	{ name: 'one line, 12x1, flat', cols: 12, rows: 1 },
	{ name: 'departures, 18x6, flat (gallery default)', cols: 18, rows: 6 },
	{ name: 'departures, 18x6, shaded', cols: 18, rows: 6, opts: { shaded: true } },
	{ name: 'departures, 18x6, flat, digits-only drum', cols: 18, rows: 6, charset: DIGITS },
	{ name: 'hall, 40x12, flat', cols: 40, rows: 12 },
	{ name: 'hall, 40x12, shaded', cols: 40, rows: 12, opts: { shaded: true } },
	{ name: 'wall, 64x24, flat', cols: 64, rows: 24 },
	{ name: 'wall, 64x24, flat, instant flips', cols: 64, rows: 24, opts: { flipMs: 0 } },
	// Same board, quarter of the canvas pixels: prices the per-frame full-canvas work
	// (the clear and the board fill) against everything the sprites cost.
	{ name: 'departures, 18x6, flat, 600x350 canvas', cols: 18, rows: 6, css: [600, 350] },
	{ name: 'hall, 40x12, flat, 600x350 canvas', cols: 40, rows: 12, css: [600, 350] }
];

const PAGE = `<!doctype html>
<script type="importmap">
{ "imports": { "@glowbox/split-flap": "/packages/split-flap/dist/index.js" } }
</script>
<script type="module">
	import { createSplitFlap, DEFAULT_CHARSET } from '@glowbox/split-flap';

	// Count what the core allocates. Faces bake LAZILY — the first frame that shows a
	// character is what pays for it — so the patch has to stay on for the whole run, not
	// just the constructor.
	const real = document.createElement.bind(document);
	let made = null;
	document.createElement = (tag, ...rest) => {
		const el = real(tag, ...rest);
		if (made && String(tag).toLowerCase() === 'canvas') made.push(el);
		return el;
	};
	const bytes = (list) => list.reduce((n, c) => n + c.width * c.height * 4, 0);

	window.__bench = async ({ cols, rows, charset, css, opts, seconds }) => {
		const c = real('canvas');
		c.style.width = (css?.[0] ?? 1200) + 'px';
		c.style.height = (css?.[1] ?? 700) + 'px';
		c.style.display = 'block';
		document.body.appendChild(c);

		const drum = charset ?? DEFAULT_CHARSET;
		made = [];
		const board = createSplitFlap(c, { cols, rows, charset: drum, ...opts });
		if (!board) {
			made = null;
			return null;
		}

		// Every module lands on a character, so every flap face in play gets baked.
		const line = (n) =>
			Array.from({ length: cols }, (_, i) => drum[(i + n * 7 + 1) % drum.length]).join('');
		const page = (n) => Array.from({ length: rows }, (_, r) => line(n + r));
		board.setText(page(0));
		await new Promise((r) => setTimeout(r, 600));
		const baked = { n: made.length, mb: bytes(made) / 1048576 };

		// The worst case: a fresh page every 250 ms, so the drums are always wrapping and
		// most modules are mid-fall for most of the run.
		let frames = 0;
		let running = true;
		let n = 1;
		const tick = setInterval(() => board.setText(page(n++)), 250);
		const count = () => {
			if (!running) return;
			frames++;
			requestAnimationFrame(count);
		};
		requestAnimationFrame(count);
		await new Promise((r) => setTimeout(r, seconds * 1000));
		running = false;
		clearInterval(tick);

		const total = { n: made.length, mb: bytes(made) / 1048576 };
		// What the face cache HOLDS once the dust settles: two half-card sprites per drum
		// character, which together come to one card. That is the number that has to fit in
		// a tab's canvas budget, and it scales with CARD SIZE — a short board in a tall box
		// bakes huge cards.
		const card = board.cellRect(0, 0);
		const dpr = c.width / parseFloat(c.style.width);
		const retainedMB = (drum.length * (card.width * dpr) * (card.height * dpr) * 4) / 1048576;
		made = null;
		board.dispose();
		c.remove();
		return {
			fps: frames / seconds,
			baked,
			total,
			retainedMB,
			card: [Math.round(card.width), Math.round(card.height)],
			modules: cols * rows,
			drum: drum.length,
			canvasPx: (c.width * c.height) / 1e6
		};
	};
	window.__ready = true;
</script>`;

const releases = join(root, '.yarn', 'releases');
const yarn = join(
	releases,
	readdirSync(releases).find((f) => f.endsWith('.cjs'))
);
execFileSync(process.execPath, [yarn, 'workspace', '@glowbox/split-flap', 'build'], {
	cwd: root,
	stdio: ['ignore', 'ignore', 'inherit']
});

const server = createServer((req, res) => {
	const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
	if (path === '/bench.html') {
		res.writeHead(200, { 'content-type': 'text/html' });
		return res.end(PAGE);
	}
	try {
		const body = readFileSync(join(root, path));
		const type = { '.js': 'text/javascript' }[extname(path)] ?? '';
		res.writeHead(200, type ? { 'content-type': type } : {});
		res.end(body);
	} catch {
		res.writeHead(404);
		res.end();
	}
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const { port } = server.address();

const { chromium } = await import('playwright');
const browser = await chromium.launch({
	args: ['--disable-frame-rate-limit', '--disable-gpu-vsync']
});
try {
	const page = await browser.newPage({
		viewport: { width: 1400, height: 900 },
		deviceScaleFactor: 2
	});
	await page.goto(`http://127.0.0.1:${port}/bench.html`);
	await page.waitForFunction(() => window.__ready === true);
	console.log(`\nchromium ${browser.version()} · ${process.platform} ${process.arch} · dpr 2`);
	console.log('board fitted into 1200 x 700 CSS px, every module flipping\n');
	console.log(
		'| scenario | modules | card css px | canvases (baked / run) | face cache MB | fps |'
	);
	console.log(
		'| -------- | ------- | ----------- | ---------------------- | ------------- | --- |'
	);
	for (const s of SCENARIOS) {
		const r = await page.evaluate((args) => window.__bench(args), { ...s, seconds: SECONDS });
		if (!r) {
			console.log(`| ${s.name} | — | — | — | — | canvas unavailable |`);
			continue;
		}
		console.log(
			`| ${s.name} | ${r.modules} | ${r.card[0]}x${r.card[1]} | ${r.baked.n} / ${r.total.n} | ${r.retainedMB.toFixed(1)} | ${r.fps.toFixed(0)} |`
		);
	}
} finally {
	await browser.close();
	server.close();
}
