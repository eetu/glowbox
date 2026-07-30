import { resolve } from 'node:path';

import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

// @glowbox/neon ships as an ESM library with zero runtime deps (the colour parser
// and mech-sound synth are vendored copies of siblings'; the Hershey stroke faces
// are vendored data). Tests use two vitest projects: node for import-safety + the
// pure font/layout arithmetic, and real headless chromium for the 2D-canvas render
// path.
export default defineConfig({
	plugins: [
		dts({
			include: ['src'],
			exclude: ['src/**/*.test.ts', 'src/**/*.browser.test.ts']
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
					exclude: ['src/**/*.browser.test.ts']
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
						instances: [{ browser: 'chromium' }]
					}
				}
			}
		]
	}
});
