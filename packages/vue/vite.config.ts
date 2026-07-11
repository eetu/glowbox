import { resolve } from 'node:path';

import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

// @glowbox/vue ships as an ESM library (single entry + .d.ts). vue and @glowbox/core
// stay external (peer / sibling dep). It's a plain-TS render-function component (no
// SFC → no template compiler needed). The <LedGrid> test drives real WebGL, so it
// runs in headless chromium with the core resolved from source.
const coreSrc = resolve(import.meta.dirname, '../core/src/index.ts');
const nixieSrc = resolve(import.meta.dirname, '../nixie/src/index.ts');

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
		rollupOptions: { external: ['vue', '@glowbox/core', '@glowbox/nixie'] }
	},
	test: {
		alias: { '@glowbox/core': coreSrc, '@glowbox/nixie': nixieSrc },
		include: ['src/**/*.browser.test.ts'],
		browser: {
			enabled: true,
			headless: true,
			provider: playwright(),
			instances: [{ browser: 'chromium' }]
		}
	}
});
