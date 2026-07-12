import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, type Plugin } from 'vite';

// Dev-only: the nixie glyph sources (packages/nixie/glyphs/*.svg) are inlined into
// @glowbox/nixie via `import.meta.glob(..., '?raw', { eager: true })`, and editing a
// raw-imported asset doesn't propagate through the glob aggregator on its own — so a glyph
// tweak wouldn't show without restarting the dev server. Invalidate the changed SVG and
// full-reload, so editing a glyph updates the demo live.
const reloadOnGlyphEdit: Plugin = {
	name: 'glowbox:reload-on-glyph-edit',
	handleHotUpdate({ file, server, modules }) {
		if (file.replace(/\\/g, '/').includes('/packages/nixie/glyphs/') && file.endsWith('.svg')) {
			for (const m of modules) server.moduleGraph.invalidateModule(m);
			server.ws.send({ type: 'full-reload' });
			return [];
		}
	}
};

// Pure client-side demo — no backend, no proxy. The @glowbox/* aliases live in
// svelte.config.js (kit.alias) so they apply to Vite and svelte-check alike.
export default defineConfig({
	plugins: [sveltekit(), reloadOnGlyphEdit]
});
