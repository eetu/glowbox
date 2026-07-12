// Pure SPA: render entirely on the client. There is no server runtime in prod
// (static files, e.g. on GitHub Pages), so SSR and prerender are both off
// — every route is delivered via the adapter-static fallback (index.html) and
// hydrated client-side.
export const ssr = false;
export const prerender = false;
