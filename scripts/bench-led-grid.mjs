// Manual benchmark for @glowbox/led-grid — real numbers for the README's perf
// guidance, measured on the BUILT package in a real browser:
//
//   node scripts/bench-led-grid.mjs
//
// Each scenario runs an unpaused display at 640×480 for a few seconds with a
// representative per-frame program (sparse = the new torus primitive, ~surface-load;
// dense = fill(), the documented worst case where every voxel draws), then reads the
// display's own EMA `stats`. The GL renderer string is printed with the results —
// numbers on SwiftShader (software) and on a real GPU are different animals.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SECONDS = 4;
const SCENARIOS = [
	{ size: [16, 16, 16], mode: 'sparse' },
	{ size: [16, 16, 16], mode: 'dense' },
	{ size: [32, 32, 32], mode: 'sparse' },
	{ size: [32, 32, 32], mode: 'dense' },
	{ size: [64, 64, 64], mode: 'sparse' },
	{ size: [64, 64, 64], mode: 'dense' }
];

const PAGE = `<!doctype html>
<script type="importmap">
{ "imports": { "@glowbox/led-grid": "/packages/led-grid/dist/index.js" } }
</script>
<script type="module">
	import { createLedDisplay } from '@glowbox/led-grid';

	window.__glInfo = () => {
		const gl = document.createElement('canvas').getContext('webgl');
		const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
		return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown';
	};

	window.__bench = async ({ size, mode, seconds }) => {
		const canvas = document.createElement('canvas');
		canvas.style.width = '640px';
		canvas.style.height = '480px';
		canvas.width = 640;
		canvas.height = 480;
		document.body.appendChild(canvas);
		const d = createLedDisplay(canvas, { size, camera: { autoOrbit: true } });
		if (!d) return null;
		const [nx, ny, nz] = size;
		const c = [nx / 2 - 0.5, ny / 2 - 0.5, nz / 2 - 0.5];
		let lit = 0;
		d.onFrame((g) => {
			g.clear();
			if (mode === 'dense') g.fill([0.35, 0.25, 0.15]);
			else g.torus(c, nx * 0.32, nx * 0.12, [0, 0.6, 1]);
			if (!lit) {
				for (let i = 0; i < g.leds.length; i += 3)
					if (g.leds[i] + g.leds[i + 1] + g.leds[i + 2] > 0) lit++;
			}
		});
		await new Promise((r) => setTimeout(r, seconds * 1000));
		const stats = { ...d.stats, lit };
		d.dispose();
		canvas.remove();
		return stats;
	};
	window.__ready = true;
</script>`;

// The built dist is what users run — rebuild so the bench reflects the working tree.
const releases = join(root, '.yarn', 'releases');
const yarn = join(
	releases,
	readdirSync(releases).find((f) => f.endsWith('.cjs'))
);
execFileSync(process.execPath, [yarn, 'workspace', '@glowbox/led-grid', 'build'], {
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
// Ask for the platform's real GPU (ANGLE Metal on macOS); headless may still fall back
// to SwiftShader — the printed renderer string is the truth.
const browser = await chromium.launch({
	args: process.platform === 'darwin' ? ['--use-angle=metal'] : []
});
try {
	const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
	await page.goto(`http://127.0.0.1:${port}/bench.html`);
	await page.waitForFunction(() => window.__ready === true);
	const renderer = await page.evaluate(() => window.__glInfo());
	console.log(`\nGL renderer: ${renderer}`);
	console.log(`chromium ${browser.version()} · ${process.platform} ${process.arch}\n`);
	console.log('| grid | lit voxels | fps | frame ms | draw ms | render ms |');
	console.log('| ---- | ---------- | --- | -------- | ------- | --------- |');
	for (const s of SCENARIOS) {
		const r = await page.evaluate(
			({ size, mode, seconds }) => window.__bench({ size, mode, seconds }),
			{ ...s, seconds: SECONDS }
		);
		if (!r) {
			console.log(`| ${s.size.join('×')} ${s.mode} | — | WebGL unavailable |`);
			continue;
		}
		const f = (n) => (n >= 100 ? n.toFixed(0) : n.toFixed(1));
		console.log(
			`| ${s.size.join('×')} ${s.mode} | ${r.lit.toLocaleString('en')} | ${f(r.fps)} | ${f(r.frameMs)} | ${f(r.drawMs)} | ${f(r.renderMs)} |`
		);
	}
} finally {
	await browser.close();
	server.close();
}
