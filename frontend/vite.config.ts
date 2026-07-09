import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		// Dev: proxy the backend so the SPA is same-origin in dev as in prod.
		// The backend listens on 3016 (VOXL_BIND default). voxl has no /api —
		// only the unauth /status liveness probe.
		proxy: {
			'/status': 'http://localhost:3016'
		}
	}
});
