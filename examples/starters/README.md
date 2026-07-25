# StackBlitz starters

Minimal Vite apps — one per framework wrapper — that the READMEs' **"Open in
StackBlitz"** links boot straight from this repo: a running `<LedGrid>` (pulsing
sphere + torus) and a ticking `<NixieTube>`, editable in the browser, no install.

Unlike everything else in the monorepo, these depend on the **published npm
packages** (`@glowbox/*@^1.2.0`, not `workspace:^`) — they're what a fresh consumer
gets, so keep them boring and current. They are deliberately **not** yarn workspaces
(two levels deep, so the `examples/*` glob skips them) and are excluded from the
repo's build/test loop; verify one by `npm install && npm run build` inside its
folder after bumping.

| starter   | boots at                                                                        |
| --------- | ------------------------------------------------------------------------------- |
| `svelte/` | <https://stackblitz.com/github/eetu/glowbox/tree/main/examples/starters/svelte> |
| `react/`  | <https://stackblitz.com/github/eetu/glowbox/tree/main/examples/starters/react>  |
| `vue/`    | <https://stackblitz.com/github/eetu/glowbox/tree/main/examples/starters/vue>    |
