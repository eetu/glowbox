import { resolve } from 'node:path';

import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

// @glowbox/extras ships as an ESM library. @glowbox/led-grid stays external; gifuct-js is
// bundled (small). Tests use two projects: pure image-sampling + GIF compositing in
// node, and the paint-onto-a-display path in real headless chromium (needs WebGL).
const coreSrc = resolve(import.meta.dirname, '../led-grid/src/index.ts');

export default defineConfig({
	plugins: [dts({ include: ['src'], exclude: ['src/**/*.test.ts', 'src/**/*.browser.test.ts'] })],
	build: {
		target: 'esnext',
		sourcemap: true,
		lib: {
			entry: resolve(import.meta.dirname, 'src/index.ts'),
			formats: ['es'],
			fileName: 'index'
		},
		rollupOptions: { external: ['@glowbox/led-grid'] }
	},
	test: {
		projects: [
			{
				test: {
					name: 'unit',
					environment: 'node',
					alias: { '@glowbox/led-grid': coreSrc },
					include: ['src/**/*.test.ts'],
					exclude: ['src/**/*.browser.test.ts']
				}
			},
			{
				test: {
					name: 'browser',
					alias: { '@glowbox/led-grid': coreSrc },
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
