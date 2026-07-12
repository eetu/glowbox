import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// Consumed by svelte-package (build), svelte-check (typecheck) and the eslint
// svelte preset. This package ships components as source; the consumer compiles.
export default {
	preprocess: vitePreprocess(),
	compilerOptions: {
		// Force runes for our own components, but leave node_modules alone — the
		// browser-test harness (@testing-library/svelte-core) ships legacy
		// `export let` components that must not be compiled in runes mode.
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	}
};
