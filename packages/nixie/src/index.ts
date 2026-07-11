// @glowbox/nixie — a nixie-tube display component (a sibling rendering core to
// @glowbox/core's LED grid):
//   import { createNixieTube } from "@glowbox/nixie";
//   const tube = createNixieTube(canvas, { value: 7, style: "classic" });
//   tube?.setValue(8);
export { createNixieTube, type NixieOptions, type NixieStyle, type NixieTube } from './nixie';
