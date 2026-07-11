import { resolve } from 'node:path';

import { svelte } from '@sveltejs/vite-plugin-svelte';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vite';

// Test-only config (the library itself is built by svelte-package). The
// <LedGrid> "as-shipped" test drives real WebGL, so it runs in headless chromium.
export default defineConfig({
	plugins: [svelte()],
	resolve: {
		// Resolve the sibling cores from source at test time (no prior build needed).
		alias: {
			'@glowbox/core': resolve(import.meta.dirname, '../core/src/index.ts'),
			'@glowbox/nixie': resolve(import.meta.dirname, '../nixie/src/index.ts')
		}
	},
	test: {
		setupFiles: ['vitest-browser-svelte'],
		include: ['src/**/*.svelte.test.ts'],
		browser: {
			enabled: true,
			headless: true,
			provider: playwright(),
			instances: [{ browser: 'chromium' }]
		}
	}
});
