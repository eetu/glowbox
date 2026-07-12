import { resolve } from 'node:path';

import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

// @glowbox/react ships as an ESM library (single entry + .d.ts). react and
// @glowbox/led-grid stay external (peer / sibling dep). The <LedGrid> test drives real
// WebGL, so it runs in headless chromium with the core resolved from source.
const coreSrc = resolve(import.meta.dirname, '../led-grid/src/index.ts');
const nixieSrc = resolve(import.meta.dirname, '../nixie/src/index.ts');

export default defineConfig({
	plugins: [react(), dts({ include: ['src'], exclude: ['src/**/*.test.ts', 'src/**/*.test.tsx'] })],
	build: {
		target: 'esnext',
		sourcemap: true,
		lib: {
			entry: resolve(import.meta.dirname, 'src/index.ts'),
			formats: ['es'],
			fileName: 'index'
		},
		rollupOptions: {
			external: ['react', 'react-dom', 'react/jsx-runtime', '@glowbox/led-grid', '@glowbox/nixie']
		}
	},
	test: {
		// Resolve the sibling cores from source at test time (no prior build needed).
		alias: { '@glowbox/led-grid': coreSrc, '@glowbox/nixie': nixieSrc },
		include: ['src/**/*.browser.test.tsx'],
		browser: {
			enabled: true,
			headless: true,
			provider: playwright(),
			instances: [{ browser: 'chromium' }]
		}
	}
});
