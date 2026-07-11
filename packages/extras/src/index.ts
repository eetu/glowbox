// @glowbox/extras — content helpers layered on @glowbox/core's draw API. Each helper
// works with any wrapper (they operate on the plain VoxelGrid / LedDisplay):
//   import { makeGifPlayer, makeImagePlayer, text } from "@glowbox/extras";
//   display.onFrame(makeGifPlayer("/loop.gif", { plane: "xy" }));
export { decodeGif, frameAt, framesFromBuffer, type GifFrame, makeGifPlayer } from './gif';
export { decodeImage, type DrawFn, makeImagePlayer, type PlayerOptions } from './image';
export { paintImage, type PaintOptions, type Plane } from './plane';
export { type Fit, type GridSample, type ImageSource, sampleImageToGrid } from './sample';
export { text, type TextOptions } from './text';
