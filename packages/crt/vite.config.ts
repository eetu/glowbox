import { resolve } from 'node:path';

import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

// @glowbox/crt ships as an ESM library with zero runtime deps. Tests use three vitest
// projects (the led-grid pattern — this is the family's second WebGL surface):
//   • unit    — import-safety in node.
//   • browser — the effect pipeline in real headless chromium AND webkit (the house
//     risk browser for WebGL).
//   • golden  — a screenshot baseline of the tube look, chromium pinned to SwiftShader
//     so one committed baseline (src/__tests__/golden) serves macOS dev and Linux CI.
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
