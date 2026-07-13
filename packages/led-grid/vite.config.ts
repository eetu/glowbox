import { resolve } from 'node:path';

import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

// @glowbox/led-grid ships as an ESM library (single bundled entry + per-module .d.ts).
// Tests use three vitest projects:
//   • unit    — pure voxel-grid geometry in node (jsdom has no GL).
//   • browser — the WebGL render path in real headless chromium AND webkit (Safari is
//     the risk browser for the WebGL1 half-float HDR extensions).
//   • golden  — screenshot baselines, chromium pinned to SwiftShader (software GL) so
//     the rendered pixels are platform-independent: one committed baseline serves both
//     macOS dev and Linux CI. Baselines live in src/__tests__/golden (committed —
//     the default __screenshots__ dir is gitignored for failure artifacts).
export default defineConfig({
	plugins: [
		dts({
			include: ['src'],
			exclude: ['src/**/*.test.ts', 'src/**/*.browser.test.ts', 'src/**/*.golden.test.ts']
		})
	],
	build: {
		target: 'esnext',
		sourcemap: true,
		lib: {
			entry: resolve(import.meta.dirname, 'src/index.ts'),
			formats: ['es'],
			fileName: 'index'
		}
	},
	test: {
		projects: [
			{
				test: {
					name: 'unit',
					environment: 'node',
					include: ['src/**/*.test.ts'],
					exclude: ['src/**/*.browser.test.ts', 'src/**/*.golden.test.ts']
				}
			},
			{
				test: {
					name: 'browser',
					include: ['src/**/*.browser.test.ts'],
					browser: {
						enabled: true,
						headless: true,
						provider: playwright(),
						instances: [{ browser: 'chromium' }, { browser: 'webkit' }]
					}
				}
			},
			{
				test: {
					name: 'golden',
					include: ['src/**/*.golden.test.ts'],
					browser: {
						enabled: true,
						headless: true,
						provider: playwright({
							// SwiftShader = deterministic software rasterizer, identical output
							// on every OS — the whole basis for shared golden baselines.
							launchOptions: { args: ['--use-gl=angle', '--use-angle=swiftshader'] }
						}),
						instances: [{ browser: 'chromium' }],
						expect: {
							toMatchScreenshot: {
								comparatorName: 'pixelmatch',
								comparatorOptions: { allowedMismatchedPixelRatio: 0.02 },
								// One platform-agnostic baseline (no `-darwin`/`-linux` suffix),
								// in a committed dir (default __screenshots__ is gitignored).
								resolveScreenshotPath: ({
									arg,
									browserName,
									ext,
									root
								}: {
									arg: string;
									browserName: string;
									ext: string;
									root: string;
								}) => resolve(root, 'src/__tests__/golden', `${arg}-${browserName}${ext}`)
							}
						}
					}
				}
			}
		]
	}
});
