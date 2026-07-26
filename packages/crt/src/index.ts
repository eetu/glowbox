// @glowbox/crt — a composable CRT viewing layer for any canvas (glowbox cores or not):
//   import { createCrtScreen } from "@glowbox/crt";
//   const crt = createCrtScreen(displayCanvas, { persistence: 0.5 });
//   overlay.appendChild(crt.canvas); // pointer/wheel forward to the source
export { createCrtScreen, type CrtOptions, type CrtScreen } from './crt';
