// Pure SPA: render entirely on the client (no server runtime in prod — static files
// on GitHub Pages). SSR stays off, but every (static) route is prerendered as an empty
// shell page so it exists as a real file — Pages has no rewrites, so without a per-route
// HTML a hard refresh on /nixie would 404. Unknown paths fall back to 404.html (see
// svelte.config.js), which boots the SPA router.
export const ssr = false;
export const prerender = true;
