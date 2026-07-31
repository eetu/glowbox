// Publish-integrity smoke test: exercise the packages EXACTLY as an npm consumer gets
// them. Everything else in the repo (demo, vitest, e2e) resolves @glowbox/* from source
// via aliases, so the published-artifact path — exports maps, `workspace:^` rewriting,
// bundled dist, shipped .d.ts — would otherwise never run before users hit it (1.0.0
// shipped a node-import crash this way).
//
//   node scripts/publish-smoke.mjs
//
// Steps: pack all six workspaces → npm-install the tarballs into a throwaway consumer
// (overrides pin the @glowbox/* transitive deps to the local tarballs — the versions
// under test aren't on the registry yet) → import each package in bare node → typecheck
// a consumer file against the shipped .d.ts → mount both rendering cores in headless
// chromium straight from the installed dist (import map, no bundler).
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGES = [
	'led-grid',
	'nixie',
	'seven-segment',
	'flip-dot',
	'split-flap',
	'neon',
	'vfd',
	'crt',
	'svelte',
	'react',
	'vue',
	'extras'
];
// @glowbox/svelte ships .svelte source (compiled by the consumer's bundler), so it gets
// the tsc types check but not a bare-node import.
const NODE_IMPORTABLE = PACKAGES.filter((p) => p !== 'svelte');

const log = (msg) => console.log(`[publish-smoke] ${msg}`);
const run = (cmd, args, opts = {}) =>
	execFileSync(cmd, args, { stdio: ['ignore', 'inherit', 'inherit'], ...opts });

const dir = mkdtempSync(join(tmpdir(), 'glowbox-smoke-'));
let failed = false;
try {
	// --- pack every workspace (prepack builds each; workspace:^ is rewritten here) ---
	const releasesDir = join(root, '.yarn', 'releases');
	const yarnCjs = readdirSync(releasesDir).find((f) => f.endsWith('.cjs'));
	if (!yarnCjs) throw new Error(`no vendored yarn release (*.cjs) found in ${releasesDir}`);
	const yarnRelease = join(releasesDir, yarnCjs);
	for (const pkg of PACKAGES) {
		log(`pack @glowbox/${pkg}`);
		run(
			process.execPath,
			[yarnRelease, 'workspace', `@glowbox/${pkg}`, 'pack', '--out', join(dir, `${pkg}.tgz`)],
			{ cwd: root }
		);
	}

	// --- install the tarballs into a fresh consumer ---
	log('npm install into throwaway consumer');
	writeFileSync(
		join(dir, 'package.json'),
		JSON.stringify(
			{
				name: 'glowbox-smoke-consumer',
				private: true,
				type: 'module',
				dependencies: {
					...Object.fromEntries(PACKAGES.map((p) => [`@glowbox/${p}`, `file:./${p}.tgz`])),
					// Peers + type sources, so node imports and the tsc check resolve for real.
					'@types/react': '^19',
					react: '^19',
					svelte: '^5',
					vue: '^3'
				},
				// The wrappers depend on the cores by version range; the versions under
				// test aren't published yet, so pin those resolutions to the tarballs.
				overrides: {
					'@glowbox/led-grid': 'file:./led-grid.tgz',
					'@glowbox/nixie': 'file:./nixie.tgz'
				}
			},
			null,
			'\t'
		)
	);
	run('npm', ['install', '--no-audit', '--no-fund', '--silent'], { cwd: dir });

	// --- bare-node import of every runtime package (catches SSR import crashes) ---
	for (const pkg of NODE_IMPORTABLE) {
		log(`node import @glowbox/${pkg}`);
		run(
			process.execPath,
			[
				'--input-type=module',
				'-e',
				`const m = await import('@glowbox/${pkg}'); if (!m || typeof m !== 'object') throw new Error('empty module');`
			],
			{ cwd: dir }
		);
	}

	// --- typecheck a consumer against the shipped .d.ts (all six, svelte included) ---
	log('tsc against shipped types');
	writeFileSync(
		join(dir, 'check.ts'),
		`import { createLedDisplay, createVoxelGrid, type LedDisplay } from '@glowbox/led-grid';
import { createNixieTube, nixieCathodes, type NixieOptions } from '@glowbox/nixie';
import { createSevenSegment, segmentGeometry, type SevenSegmentOptions } from '@glowbox/seven-segment';
import { createFlipDots, createMechSound, ditherFrame, type FlipDotsOptions } from '@glowbox/flip-dot';
import { chromaDrum, createSplitFlap, DRUM_DIGITS, paletteFrame, type SplitFlapOptions } from '@glowbox/split-flap';
import { createHum, createNeonSign, HERSHEY_LICENSE, layoutTubes, type NeonSignOptions } from '@glowbox/neon';
import { compilePanel, createVfdPanel, layCells, type VfdElement, type VfdPanelOptions } from '@glowbox/vfd';
import { createCrtScreen, type CrtOptions } from '@glowbox/crt';
import { makeGifPlayer, text } from '@glowbox/extras';
import { FlipDots as SvelteFlipDots, LedGrid as SvelteLedGrid, NeonSign as SvelteNeonSign, NixieTube as SvelteNixieTube, SevenSegment as SvelteSevenSegment, SplitFlap as SvelteSplitFlap, VfdPanel as SvelteVfdPanel } from '@glowbox/svelte';
import { FlipDots as ReactFlipDots, LedGrid as ReactLedGrid, NeonSign as ReactNeonSign, NixieTube as ReactNixieTube, SevenSegment as ReactSevenSegment, SplitFlap as ReactSplitFlap, VfdPanel as ReactVfdPanel } from '@glowbox/react';
import { FlipDots as VueFlipDots, LedGrid as VueLedGrid, NeonSign as VueNeonSign, NixieTube as VueNixieTube, SevenSegment as VueSevenSegment, SplitFlap as VueSplitFlap, VfdPanel as VueVfdPanel } from '@glowbox/vue';

const g = createVoxelGrid(4, 4, 4);
g.plot(1, 2, 3, [1, 0.5, 0]);
const opts: NixieOptions = { value: 8, style: 'classic', label: 'eight' };
const segOpts: SevenSegmentOptions = { value: 8, style: 'vfd', age: 0.5 };
const dotOpts: FlipDotsOptions = { cols: 28, rows: 14, shape: 'square', sound: 0.4 };
const bits = ditherFrame((x, y) => (x + y) / 42, 28, 14, { mode: 'bayer' });
const sfOpts: SplitFlapOptions = { cols: 12, rows: 1, charset: DRUM_DIGITS, sound: 0.4 };
const sfDrum = chromaDrum({ hues: 6 });
const sfLines = paletteFrame([0, 0, 0, 1, 0, 0], 2, 1, sfDrum.palette);
const neonOpts: NeonSignOptions = {
	text: 'OPEN',
	font: 'sans',
	gas: 'argon',
	sound: 0.4,
	art: [{ d: 'M0 0L10 0 10 10 0 10Z', place: 'left', rotate: -10, opaque: true }]
};
const neonLay = layoutTubes('HI', 'sans');
const neonAck: string = HERSHEY_LICENSE;
const vfdLayout: VfdElement[] = [
	{ kind: 'digits', name: 'main', chars: 8, glyphs: '14seg', x: 8, y: 6, w: 150, h: 26 },
	{ kind: 'legend', name: 'db', text: '-30dB', printed: true, x: 170, y: 16, w: 30, h: 8 },
	{ kind: 'bars', name: 'spec', bands: 12, rows: 8, peakHold: true, x: 196, y: 6, w: 110, h: 34 },
	{ kind: 'icon', name: 'play', d: 'M0 0 L10 5 L0 10 Z', x: 300, y: 44, w: 10, h: 10 },
	{ kind: 'scale', name: 'tune', ticks: 9, steps: 20, x: 8, y: 50, w: 150, h: 10 },
	{ kind: 'dots', name: 'screen', cols: 24, rows: 8, x: 170, y: 44, w: 60, h: 20 }
];
const vfdOpts: VfdPanelOptions = { frame: [320, 64], layout: vfdLayout, phosphor: 'zn-o', filter: 'green' };
const vfdPanel = compilePanel([320, 64], vfdLayout);
const vfdCells = layCells('FM 98.50', 8, 'left', true);
const crtOpts: CrtOptions = { persistence: 0.5, events: true };
export const used = [
	createLedDisplay,
	createNixieTube,
	nixieCathodes,
	createSevenSegment,
	segmentGeometry,
	createFlipDots,
	createMechSound,
	createSplitFlap,
	createNeonSign,
	createHum,
	createVfdPanel,
	createCrtScreen,
	makeGifPlayer,
	text,
	SvelteLedGrid,
	SvelteNixieTube,
	SvelteSevenSegment,
	SvelteFlipDots,
	SvelteSplitFlap,
	SvelteNeonSign,
	SvelteVfdPanel,
	ReactLedGrid,
	ReactNixieTube,
	ReactSevenSegment,
	ReactFlipDots,
	ReactSplitFlap,
	ReactNeonSign,
	ReactVfdPanel,
	VueLedGrid,
	VueNixieTube,
	VueSevenSegment,
	VueFlipDots,
	VueSplitFlap,
	VueNeonSign,
	VueVfdPanel,
	opts,
	segOpts,
	dotOpts,
	bits,
	sfOpts,
	sfLines,
	neonOpts,
	neonLay,
	neonAck,
	vfdOpts,
	vfdPanel,
	vfdCells,
	crtOpts
] as const;
export type D = LedDisplay;
`
	);
	writeFileSync(
		join(dir, 'tsconfig.json'),
		JSON.stringify(
			{
				compilerOptions: {
					strict: true,
					noEmit: true,
					skipLibCheck: true,
					module: 'esnext',
					target: 'esnext',
					moduleResolution: 'bundler',
					// resolves @glowbox/svelte's `./X.svelte` d.ts imports (→ X.svelte.d.ts)
					allowArbitraryExtensions: true,
					jsx: 'react-jsx',
					lib: ['esnext', 'dom', 'dom.iterable']
				},
				include: ['check.ts']
			},
			null,
			'\t'
		)
	);
	run(process.execPath, [join(root, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', dir]);

	// --- mount both cores in a real browser from the installed dist (no bundler) ---
	log('browser mount from installed tarballs');
	writeFileSync(
		join(dir, 'smoke.html'),
		`<!doctype html>
<script type="importmap">
{
	"imports": {
		"@glowbox/led-grid": "/node_modules/@glowbox/led-grid/dist/index.js",
		"@glowbox/nixie": "/node_modules/@glowbox/nixie/dist/index.js",
		"@glowbox/seven-segment": "/node_modules/@glowbox/seven-segment/dist/index.js",
		"@glowbox/flip-dot": "/node_modules/@glowbox/flip-dot/dist/index.js",
		"@glowbox/split-flap": "/node_modules/@glowbox/split-flap/dist/index.js",
		"@glowbox/neon": "/node_modules/@glowbox/neon/dist/index.js",
		"@glowbox/vfd": "/node_modules/@glowbox/vfd/dist/index.js",
		"@glowbox/crt": "/node_modules/@glowbox/crt/dist/index.js",
		"@glowbox/extras": "/node_modules/@glowbox/extras/dist/index.js"
	}
}
</script>
<canvas id="g" style="width:160px;height:120px"></canvas>
<canvas id="n" style="width:60px;height:100px"></canvas>
<canvas id="s" style="width:60px;height:100px"></canvas>
<canvas id="f" style="width:280px;height:140px"></canvas>
<canvas id="sf" style="width:280px;height:40px"></canvas>
<canvas id="ne" style="width:280px;height:100px"></canvas>
<canvas id="vf" style="width:320px;height:64px"></canvas>
<script type="module">
	import { createLedDisplay } from '@glowbox/led-grid';
	import { createNixieTube } from '@glowbox/nixie';
	import { createSevenSegment } from '@glowbox/seven-segment';
	import { createFlipDots, ditherFrame } from '@glowbox/flip-dot';
	import { createSplitFlap } from '@glowbox/split-flap';
	import { createNeonSign } from '@glowbox/neon';
	import { createVfdPanel } from '@glowbox/vfd';
	import { createCrtScreen } from '@glowbox/crt';
	import { text } from '@glowbox/extras';
	const d = createLedDisplay(document.getElementById('g'), {
		size: [8, 8, 8],
		quality: { paused: true }
	});
	if (!d) throw new Error('createLedDisplay returned null');
	d.sphere([4, 4, 4], 3, [0, 0.6, 1]);
	text(d, 'A');
	d.render();
	const t = createNixieTube(document.getElementById('n'), { value: 8 });
	if (!t) throw new Error('createNixieTube returned null');
	const s = createSevenSegment(document.getElementById('s'), { value: 8, transition: 0 });
	if (!s) throw new Error('createSevenSegment returned null');
	const f = createFlipDots(document.getElementById('f'), { cols: 28, rows: 14, flipMs: 0 });
	if (!f) throw new Error('createFlipDots returned null');
	f.setFrame(ditherFrame((x, y) => (x + y) / 42, 28, 14));
	const sf = createSplitFlap(document.getElementById('sf'), { cols: 8, rows: 1, flipMs: 0 });
	if (!sf) throw new Error('createSplitFlap returned null');
	sf.setText('GLOWBOX');
	const ne = createNeonSign(document.getElementById('ne'), { text: 'Glow', strikeMs: 0 });
	if (!ne) throw new Error('createNeonSign returned null');
	const vf = createVfdPanel(document.getElementById('vf'), {
		frame: [320, 64],
		selfTest: false,
		persistence: 0,
		layout: [
			{ kind: 'digits', name: 'main', chars: 8, glyphs: '14seg', x: 8, y: 6, w: 150, h: 26 },
			{ kind: 'legend', name: 'st', text: 'ST', x: 170, y: 4, w: 14, h: 8 },
			{ kind: 'bars', name: 'spec', bands: 12, rows: 8, x: 196, y: 6, w: 110, h: 34 },
			{ kind: 'dots', name: 'screen', cols: 24, rows: 8, x: 8, y: 40, w: 60, h: 20 }
		]
	});
	if (!vf) throw new Error('createVfdPanel returned null');
	vf.set('main', 'FM 98.50');
	vf.light('st', true);
	vf.bars('spec', [0.2, 0.4, 0.6, 0.8, 1, 0.8, 0.6, 0.4, 0.2, 0.5, 0.7, 0.3]);
	vf.dots('screen', (x, y) => ((x + y) % 3 === 0 ? 1 : 0.2));
	const crt = createCrtScreen(document.getElementById('n'));
	if (!crt) throw new Error('createCrtScreen returned null');
	window.__ok = true;
</script>
`
	);
	const server = createServer((req, res) => {
		const path = join(dir, decodeURIComponent(new URL(req.url, 'http://x').pathname));
		try {
			const body = readFileSync(path);
			const type = { '.js': 'text/javascript', '.html': 'text/html' }[extname(path)] ?? '';
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
	const browser = await chromium.launch();
	try {
		const page = await browser.newPage();
		const errors = [];
		page.on('pageerror', (e) => errors.push(e));
		await page.goto(`http://127.0.0.1:${port}/smoke.html`);
		await page.waitForFunction(() => window.__ok === true, undefined, { timeout: 15_000 });
		if (errors.length) throw new AggregateError(errors, 'page errors during mount');
	} finally {
		await browser.close();
		server.close();
	}

	log('OK — pack, install, import, types and browser mount all pass');
} catch (e) {
	failed = true;
	console.error(`[publish-smoke] FAILED: ${e?.message ?? e}`);
} finally {
	rmSync(dir, { force: true, recursive: true });
}
if (failed) process.exit(1);
