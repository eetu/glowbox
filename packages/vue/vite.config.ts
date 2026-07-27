import { resolve } from 'node:path';

import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

// @glowbox/vue ships as an ESM library (single entry + .d.ts). vue and @glowbox/led-grid
// stay external (peer / sibling dep). It's a plain-TS render-function component (no
// SFC → no template compiler needed). The <LedGrid> test drives real WebGL, so it
// runs in headless chromium with the core resolved from source.
const coreSrc = resolve(import.meta.dirname, '../led-grid/src/index.ts');
const nixieSrc = resolve(import.meta.dirname, '../nixie/src/index.ts');
const sevenSrc = resolve(import.meta.dirname, '../seven-segment/src/index.ts');

export default defineConfig({
	plugins: [dts({ include: ['src'], exclude: ['src/**/*.test.ts'] })],
	build: {
		target: 'esnext',
		sourcemap: true,
		lib: {
			entry: resolve(import.meta.dirname, 'src/index.ts'),
			formats: ['es'],
			fileName: 'index'
		},
		rollupOptions: {
			external: [
				'vue',
				'@glowbox/flip-dot',
				'@glowbox/led-grid',
				'@glowbox/nixie',
				'@glowbox/seven-segment'
			]
		}
	},
	test: {
		alias: {
			'@glowbox/flip-dot': resolve(import.meta.dirname, '../flip-dot/src/index.ts'),
			'@glowbox/led-grid': coreSrc,
			'@glowbox/nixie': nixieSrc,
			'@glowbox/seven-segment': sevenSrc
		},
		include: ['src/**/*.browser.test.ts'],
		browser: {
			enabled: true,
			headless: true,
			provider: playwright(),
			instances: [{ browser: 'chromium' }]
		}
	}
});
