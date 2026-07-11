import { resolve } from 'node:path';

import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

// @glowbox/nixie ships as an ESM library. @glowbox/core stays external (only its pure
// colour helper is used, tree-shaken). The 2D-canvas render only runs in a real
// browser, so the test uses headless chromium with core resolved from source.
const coreSrc = resolve(import.meta.dirname, '../core/src/index.ts');

export default defineConfig({
	plugins: [dts({ include: ['src'], exclude: ['src/**/*.browser.test.ts'] })],
	build: {
		target: 'esnext',
		sourcemap: true,
		lib: {
			entry: resolve(import.meta.dirname, 'src/index.ts'),
			formats: ['es'],
			fileName: 'index'
		},
		rollupOptions: { external: ['@glowbox/core'] }
	},
	test: {
		alias: { '@glowbox/core': coreSrc },
		include: ['src/**/*.browser.test.ts'],
		browser: {
			enabled: true,
			headless: true,
			provider: playwright(),
			instances: [{ browser: 'chromium' }]
		}
	}
});
