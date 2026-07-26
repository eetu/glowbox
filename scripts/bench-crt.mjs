// Manual benchmark for @glowbox/crt — frame throughput of the effect pipeline,
// measured on the BUILT package in a real browser with vsync uncapped:
//
//   node scripts/bench-crt.mjs
//
// Each scenario animates a cheap 2D source (moving bars — the source cost is
// negligible, so the numbers are the effect's), wraps it, and counts rAF ticks for a
// few seconds. `baseline` is the same source with no CRT. The GL renderer string is
// printed with the results — SwiftShader and a real GPU are different animals.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SECONDS = 3;
const SCENARIOS = [
	{ name: 'baseline 1280×720 (no crt)', w: 1280, h: 720, crt: false },
	{ name: 'crt 1280×720 defaults', w: 1280, h: 720, crt: true },
	{ name: 'crt 1280×720 persistence:0', w: 1280, h: 720, crt: true, opts: { persistence: 0 } },
	{ name: 'crt 1920×1080 defaults', w: 1920, h: 1080, crt: true },
	{ name: 'crt element mode · 8 canvases 800×200', w: 800, h: 200, crt: true, row: 8 }
];

const PAGE = `<!doctype html>
<script type="importmap">
{ "imports": { "@glowbox/crt": "/packages/crt/dist/index.js" } }
</script>
<script type="module">
	import { createCrtScreen } from '@glowbox/crt';

	window.__glInfo = () => {
		const gl = document.createElement('canvas').getContext('webgl');
		const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
		return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown';
	};

	const makeAnimatedCanvas = (w, h) => {
		const c = document.createElement('canvas');
		c.width = w;
		c.height = h;
		c.style.width = w + 'px';
		c.style.height = h + 'px';
		const ctx = c.getContext('2d');
		let t = 0;
		const tick = () => {
			t += 1 / 60;
			ctx.fillStyle = '#000';
			ctx.fillRect(0, 0, w, h);
			for (let i = 0; i < 6; i++) {
				ctx.fillStyle = ['#f80', '#0cf', '#8f0'][i % 3];
				ctx.fillRect(((t * 90 + i * w * 0.17) % w) - 20, 0, 24, h);
			}
		};
		return { c, tick };
	};

	window.__bench = async ({ w, h, crt, row, opts, seconds }) => {
		const host = document.createElement('div');
		host.style.cssText = 'position:relative;width:' + w + 'px;height:' + h + 'px';
		document.body.appendChild(host);
		const sources = [];
		if (row) {
			const sw = Math.floor(w / row);
			for (let i = 0; i < row; i++) {
				const s = makeAnimatedCanvas(sw - 6, h - 8);
				s.c.style.cssText = 'position:absolute;top:4px;left:' + (i * sw + 3) + 'px;width:' + (sw - 6) + 'px;height:' + (h - 8) + 'px';
				host.appendChild(s.c);
				sources.push(s);
			}
		} else {
			const s = makeAnimatedCanvas(w, h);
			host.appendChild(s.c);
			sources.push(s);
		}

		let screen = null;
		if (crt) {
			screen = createCrtScreen(host, opts ?? {});
			if (!screen) return null;
		}

		let frames = 0;
		let running = true;
		const loop = () => {
			if (!running) return;
			frames++;
			for (const s of sources) s.tick();
			requestAnimationFrame(loop);
		};
		requestAnimationFrame(loop);
		await new Promise((r) => setTimeout(r, seconds * 1000));
		running = false;
		screen?.dispose();
		host.remove();
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
execFileSync(process.execPath, [yarn, 'workspace', '@glowbox/crt', 'build'], {
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
// vsync/frame-rate caps off so fps reflects pipeline throughput, not the display.
const browser = await chromium.launch({
	args: [
		'--disable-frame-rate-limit',
		'--disable-gpu-vsync',
		...(process.platform === 'darwin' ? ['--use-angle=metal'] : [])
	]
});
try {
	const page = await browser.newPage({ viewport: { width: 2000, height: 1200 } });
	await page.goto(`http://127.0.0.1:${port}/bench.html`);
	await page.waitForFunction(() => window.__ready === true);
	const renderer = await page.evaluate(() => window.__glInfo());
	console.log(`\nGL renderer: ${renderer}`);
	console.log(`chromium ${browser.version()} · ${process.platform} ${process.arch}\n`);
	console.log('| scenario | fps |');
	console.log('| -------- | --- |');
	for (const s of SCENARIOS) {
		const r = await page.evaluate((args) => window.__bench(args), { ...s, seconds: SECONDS });
		console.log(`| ${s.name} | ${r ? r.fps.toFixed(0) : 'WebGL unavailable'} |`);
	}
} finally {
	await browser.close();
	server.close();
}
