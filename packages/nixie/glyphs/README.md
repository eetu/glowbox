# nixie glyph sources

The **single source of truth** for the numeral filaments — the single-stroke cathode
wires the tube lights up. `src/nixie.ts` reads these SVGs directly (Vite inlines them at
build via `?raw` and lifts out the path data), so there is no second copy: **edit a glyph
here and the component uses it** — no paste-back, no regeneration.

## Convention

- **viewBox `0 0 60 100`, y-down.** The renderer centres this box on the glass and
  scales it to fit — it never clips against it, so ink may touch (or slightly spill past)
  the box edges. Most digits run `y=7` → `y=84`; the round ones deliberately overshoot
  (`0` to `3.5–87.5`, `6`/`9` bowls to `91`, `8` to `3.5–94.5`) — see Notes.
- Each digit is **one continuous stroke** — the bent wire — as a single `<path>`. It's a
  **centreline**, not an outline: edit the path the wire follows, not its edges. (The
  `fill`/`stroke`/`width` here are only so the file previews in a viewer; the renderer
  supplies its own stroke, round caps, glow, and per-style weighting.)
- **`colon.svg` is the separator** (two dots); the renderer fills it. `dash.svg` is `-`.
- Filenames map to symbols: `0.svg`…`9.svg`, `dash.svg` → `-`, `colon.svg` → `:`,
  `dot.svg` → `.` (the decimal point — a single low dot, authentic to real tubes).

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

- **The digits are deliberately not normalized.** Real nixie filaments are bent wires
  packed inside a glass envelope, so each numeral sits a little off the common cap/base
  lines and off optical centre — small kinks and varied bowl depths are the character,
  and it reads better on screen than a typographically evened-out set. Don't "fix" a
  digit to match its neighbours' extents.
- **`1`** is intentionally a bare stroke (a single vertical stem — no top flag, no foot).
