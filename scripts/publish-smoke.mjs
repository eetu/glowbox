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
const PACKAGES = ['led-grid', 'nixie', 'svelte', 'react', 'vue', 'extras'];
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
	const yarnRelease = join(
		releasesDir,
		readdirSync(releasesDir).find((f) => f.endsWith('.cjs'))
	);
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
import { makeGifPlayer, text } from '@glowbox/extras';
import { LedGrid as SvelteLedGrid, NixieTube as SvelteNixieTube } from '@glowbox/svelte';
import { LedGrid as ReactLedGrid } from '@glowbox/react';
import { LedGrid as VueLedGrid } from '@glowbox/vue';

const g = createVoxelGrid(4, 4, 4);
g.plot(1, 2, 3, [1, 0.5, 0]);
const opts: NixieOptions = { value: 8, style: 'classic', label: 'eight' };
export const used = [
	createLedDisplay,
	createNixieTube,
	nixieCathodes,
	makeGifPlayer,
	text,
	SvelteLedGrid,
	SvelteNixieTube,
	ReactLedGrid,
	VueLedGrid,
	opts
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
		"@glowbox/extras": "/node_modules/@glowbox/extras/dist/index.js"
	}
}
</script>
<canvas id="g" style="width:160px;height:120px"></canvas>
<canvas id="n" style="width:60px;height:100px"></canvas>
<script type="module">
	import { createLedDisplay } from '@glowbox/led-grid';
	import { createNixieTube } from '@glowbox/nixie';
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
