# nixie glyph sources

The **single source of truth** for the numeral filaments — the single-stroke cathode
wires the tube lights up. `src/nixie.ts` reads these SVGs directly (Vite inlines them at
build via `?raw` and lifts out the path data), so there is no second copy: **edit a glyph
here and the component uses it** — no paste-back, no regeneration.

## Convention

- **viewBox `0 0 60 100`, y-down.** Digits sit roughly between `y=6` and `y=94`; the
  centre is `(30, 50)`.
- Each digit is **one continuous stroke** — the bent wire — as a single `<path>`. It's a
  **centreline**, not an outline: edit the path the wire follows, not its edges. (The
  `fill`/`stroke`/`width` here are only so the file previews in a viewer; the renderer
  supplies its own stroke, round caps, glow, and per-style weighting.)
- **`colon.svg` is the separator** (two dots); the renderer fills it. `dash.svg` is `-`.
- Filenames map to symbols: `0.svg`…`9.svg`, `dash.svg` → `-`, `colon.svg` → `:`.

## Editing

1. Edit the `<path>`'s `d` in your editor. **Keep the 60×100 coordinates** (don't rescale
   — the renderer scales to fit) and **keep the path untransformed** (no `transform` on
   the `<path>` or a wrapping `<g>`; only `d` is read).
2. Any valid path syntax works (absolute/relative, commas or spaces) — it's fed straight
   to `Path2D`. Splitting a glyph into several `<path>` elements is fine; all their `d`
   are concatenated.
3. Re-run the demo / `yarn workspace @glowbox/nixie build` to pick it up.

All three tube styles (`classic` / `slim` / `tall`) share these centrelines; the styles
only squash (x/y) and re-weight the wire at render time, so each numeral is edited once.

## Notes

- **`1`** is intentionally a bare stroke (short top flag + vertical stem, no foot).
- **`2`** has a kink where the top bowl's curve meets the straight diagonal (the bezier
  end tangent at ~`32 54` doesn't line up with the line to `13 91`) — worth smoothing.
