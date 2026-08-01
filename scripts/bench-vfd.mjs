// Manual benchmark for @glowbox/vfd — frame throughput of the panel renderer, measured on
// the BUILT package in a real browser with vsync uncapped:
//
//   node scripts/bench-vfd.mjs
//
// Every scenario keeps the panel genuinely in flight (a spectrum fed fresh levels each
// rAF, character fields changing) so each frame really redraws. A settled panel runs NO
// rAF at all, so idle isn't measured — it costs nothing by construction.
//
// The scenarios are chosen to price one thing at a time: a matrix field is one anode per
// dot, so it is the stress case, and the `glow: 0` rows isolate what the halo pass costs
// (shadowBlur is by far the most expensive thing a 2D canvas does).
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SECONDS = 3;

// The gallery faceplate, minus the title strip (added per-scenario).
const FACE = [
	{ kind: 'rule', name: 'split', shape: 'line', x: 185, y: 4, w: 1.2, h: 70 },
	{ kind: 'icon', name: 'play', d: 'M0 0 L10 5.5 L0 11 Z', x: 6, y: 4, w: 8, h: 9 },
	{ kind: 'legend', name: 'st', text: 'ST', x: 28, y: 4, w: 11, h: 8 },
	{ kind: 'legend', name: 'dolby', text: 'DOLBY NR', x: 69, y: 4, w: 43, h: 8 },
	{ kind: 'legend', name: 'rand', text: 'RANDOM', x: 144, y: 4, w: 34, h: 8 },
	{ kind: 'digits', name: 'main', chars: 8, glyphs: '14seg', x: 6, y: 16, w: 148, h: 30 },
	{ kind: 'legend', name: 'tuner', text: 'TUNER', x: 6, y: 49, w: 28, h: 8 },
	{ kind: 'scale', name: 'tune', steps: 30, ticks: 11, x: 6, y: 59, w: 172, h: 16 },
	{
		kind: 'bars',
		name: 'spec',
		bands: 12,
		rows: 9,
		peakHold: true,
		scale: ['63', '1k', '16k'],
		filter: 'amber',
		x: 192,
		y: 4,
		w: 122,
		h: 44
	},
	{ kind: 'digits', name: 'trk', chars: 2, glyphs: '7seg', x: 220, y: 50, w: 26, h: 20 }
];
// The character-cell strip (one anode per dot of every cell) and the raw dots ticker the
// demo actually uses — both are the anode-count stress case, from opposite directions.
const cellStrip = (cells) => ({
	kind: 'digits',
	name: 'title',
	chars: cells,
	glyphs: 'matrix',
	x: 8,
	y: 80,
	w: 304,
	h: 12
});
const dotStrip = (cols, rows = 7) => ({
	kind: 'dots',
	name: 'ticker',
	cols,
	rows,
	x: 8,
	y: 80,
	w: 304,
	h: 18
});

const SCENARIOS = [
	{ name: 'faceplate alone, no strip', frame: [320, 78], layout: FACE },
	{ name: 'faceplate + 120x7 dots ticker (demo default)', layout: [...FACE, dotStrip(120)] },
	{
		name: 'faceplate + 120x7 ticker, glow 0 (prices the bloom)',
		layout: [...FACE, dotStrip(120)],
		opts: { glow: 0 }
	},
	{ name: 'faceplate + 200x9 dots ticker', layout: [...FACE, dotStrip(200, 9)] },
	{ name: 'dots ticker alone, 120x7', layout: [dotStrip(120)] },
	{ name: 'faceplate + 16-cell matrix digits strip', layout: [...FACE, cellStrip(16)] },
	{
		name: 'spectrum alone, 24 x 16',
		layout: [
			{ kind: 'bars', name: 'spec', bands: 24, rows: 16, peakHold: true, x: 6, y: 6, w: 308, h: 86 }
		]
	},
	{
		name: 'worn faceplate + ticker (age 0.8)',
		layout: [...FACE, dotStrip(120)],
		opts: { age: 0.8 }
	}
];

const PAGE = `<!doctype html>
<script type="importmap">
{ "imports": { "@glowbox/vfd": "/packages/vfd/dist/index.js" } }
</script>
<script type="module">
	import { createVfdPanel } from '@glowbox/vfd';

	window.__bench = async ({ frame, layout, opts, seconds }) => {
		const c = document.createElement('canvas');
		c.style.width = '960px';
		c.style.height = '294px';
		document.body.appendChild(c);
		const panel = createVfdPanel(c, {
			frame: frame ?? [320, 98],
			layout,
			selfTest: false,
			...opts
		});
		if (!panel) return null;

		const names = layout.map((e) => e.name);
		const bands = layout.find((e) => e.kind === 'bars');
		const levels = bands ? new Array(bands.bands).fill(0) : null;
		const ticker = layout.some((e) => e.kind === 'dots');

		// Drive it hard: fresh spectrum every frame, and the character fields cycling fast
		// enough that they never settle — the worst case for the physics + render loop.
		let frames = 0;
		let running = true;
		const loop = (t) => {
			if (!running) return;
			if (levels) {
				for (let b = 0; b < levels.length; b++)
					levels[b] = 0.5 + 0.5 * Math.sin(t / 200 + b);
				panel.setBars('spec', levels);
			}
			const n = Math.floor(t / 100);
			if (names.includes('main')) panel.set('main', 'FM ' + (90 + (n % 100)) + '.5');
			if (names.includes('trk')) panel.set('trk', String(n % 100).padStart(2, '0'));
			if (names.includes('title'))
				panel.set('title', 'PHOSPHOR DECAY ' + (n % 10) + ' TRACK ' + (n % 90));
			if (names.includes('tune')) panel.set('tune', (n % 100) / 100);
			// A fresh bitmap every frame: the dots path's worst case.
			if (ticker) panel.setDots('ticker', (x, y) => ((x + y + ((t / 30) | 0)) % 7 < 3 ? 1 : 0));
			frames++;
			requestAnimationFrame(loop);
		};
		requestAnimationFrame(loop);
		await new Promise((r) => setTimeout(r, seconds * 1000));
		running = false;
		panel.dispose();
		c.remove();
		return { fps: frames / seconds };
	};
	window.__count = (frame, layout) => {
		// Anode count is pure arithmetic, so it needs no canvas.
		return window.__compile(frame ?? [320, 98], layout).anodes.length;
	};
	import { compilePanel } from '@glowbox/vfd';
	window.__compile = compilePanel;
	window.__ready = true;
</script>`;

// The built dist is what users run — rebuild so the bench reflects the working tree.
const releases = join(root, '.yarn', 'releases');
const yarn = join(
	releases,
	readdirSync(releases).find((f) => f.endsWith('.cjs'))
);
execFileSync(process.execPath, [yarn, 'workspace', '@glowbox/vfd', 'build'], {
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
// vsync/frame-rate caps off so fps reflects renderer throughput, not the display.
const browser = await chromium.launch({
	args: ['--disable-frame-rate-limit', '--disable-gpu-vsync']
});
try {
	// deviceScaleFactor 2 = the retina case the pixelRatio cap targets.
	const page = await browser.newPage({
		viewport: { width: 1200, height: 800 },
		deviceScaleFactor: 2
	});
	await page.goto(`http://127.0.0.1:${port}/bench.html`);
	await page.waitForFunction(() => window.__ready === true);
	console.log(`\nchromium ${browser.version()} · ${process.platform} ${process.arch} · dpr 2\n`);
	console.log('| scenario | anodes | fps |');
	console.log('| -------- | ------ | --- |');
	for (const s of SCENARIOS) {
		const anodes = await page.evaluate((args) => window.__count(args.frame, args.layout), {
			frame: s.frame,
			layout: s.layout
		});
		const r = await page.evaluate((args) => window.__bench(args), { ...s, seconds: SECONDS });
		console.log(`| ${s.name} | ${anodes} | ${r ? r.fps.toFixed(0) : 'canvas unavailable'} |`);
	}
} finally {
	await browser.close();
	server.close();
}
