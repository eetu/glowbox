// Manual benchmark for @glowbox/flip-dot — frame throughput of the board renderer,
// measured on the BUILT package in a real browser with vsync uncapped:
//
//   node scripts/bench-flip-dot.mjs
//
// Each scenario keeps the whole board flipping continuously (alternating frames on
// a scan sweep — the worst case: every rAF redraws every dot), and counts rAF ticks
// for a few seconds. An idle board runs NO rAF at all, so idle isn't measured — it
// costs nothing by construction.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SECONDS = 3;
const SCENARIOS = [
	{ name: 'flat 56×28 (demo default)', cols: 56, rows: 28 },
	{ name: 'shaded 56×28', cols: 56, rows: 28, opts: { shaded: true } },
	{ name: 'flat 56×28 square', cols: 56, rows: 28, opts: { shape: 'square' } },
	{ name: 'flat 168×84 (14k dots)', cols: 168, rows: 84 },
	{ name: 'shaded 168×84', cols: 168, rows: 84, opts: { shaded: true } }
];

const PAGE = `<!doctype html>
<script type="importmap">
{ "imports": { "@glowbox/flip-dot": "/packages/flip-dot/dist/index.js" } }
</script>
<script type="module">
	import { createFlipDots } from '@glowbox/flip-dot';

	window.__bench = async ({ cols, rows, opts, seconds }) => {
		const c = document.createElement('canvas');
		c.style.width = '840px';
		c.style.height = '420px';
		document.body.appendChild(c);
		const board = createFlipDots(c, { cols, rows, flipMs: 120, scanMs: 260, ...opts });
		if (!board) return null;

		// Keep every dot in flight: alternate inverse checkerboard-ish frames faster
		// than they can settle.
		let phase = 0;
		const flip = setInterval(() => {
			phase ^= 1;
			board.setFrame((x, y) => ((x + y) & 1) === phase);
		}, 400);
		board.setFrame((x, y) => ((x + y) & 1) === 0);

		let frames = 0;
		let running = true;
		const loop = () => {
			if (!running) return;
			frames++;
			requestAnimationFrame(loop);
		};
		requestAnimationFrame(loop);
		await new Promise((r) => setTimeout(r, seconds * 1000));
		running = false;
		clearInterval(flip);
		board.dispose();
		c.remove();
		return { fps: frames / seconds };
	};
	window.__ready = true;
</script>`;

// The built dist is what users run — rebuild so the bench reflects the working tree.
const releases = join(root, '.yarn', 'releases');
const yarn = join(
	releases,
	readdirSync(releases).find((f) => f.endsWith('.cjs'))
);
execFileSync(process.execPath, [yarn, 'workspace', '@glowbox/flip-dot', 'build'], {
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
	console.log('| scenario | fps |');
	console.log('| -------- | --- |');
	for (const s of SCENARIOS) {
		const r = await page.evaluate((args) => window.__bench(args), { ...s, seconds: SECONDS });
		console.log(`| ${s.name} | ${r ? r.fps.toFixed(0) : 'canvas unavailable'} |`);
	}
} finally {
	await browser.close();
	server.close();
}
