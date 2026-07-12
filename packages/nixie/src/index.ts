// @glowbox/nixie — a nixie-tube display component (a sibling rendering core to
// @glowbox/led-grid's LED grid):
//   import { createNixieTube } from "@glowbox/nixie";
//   const tube = createNixieTube(canvas, { value: 7, style: "classic" });
//   tube?.setValue(8);
// For 3D scenes, the tube's parts come from here so you only supply the glass + effects:
// `nixieCathodes()` is the full front→back digit stack (paths + depths) to extrude and
// light one of; `nixieStyle(style)` gives the wire thickness + squash; `nixieMesh(w,h)` is
// the honeycomb anode grille; `glyphPath(symbol)` / `GLYPH_VIEWBOX` are the raw centreline +
// its coordinate space; and `{ bare: true }` renders a tube's glowing contents on a
// transparent canvas (no 2D glass) for compositing.
export {
	createNixieTube,
	GLYPH_VIEWBOX,
	glyphPath,
	NIXIE_WIRE_COLOR,
	type NixieCathode,
	nixieCathodes,
	nixieMesh,
	type NixieMeshCell,
	type NixieOptions,
	type NixieStyle,
	nixieStyle,
	type NixieTube
} from './nixie';
