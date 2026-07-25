// @glowbox/seven-segment — a seven-segment display component (a sibling rendering
// core to @glowbox/nixie's tube):
//   import { createSevenSegment } from "@glowbox/seven-segment";
//   const digit = createSevenSegment(canvas, { value: 7, style: "vfd" });
//   digit?.setValue(8);
export { type Color, parseColor, type RGB } from './color';
export {
	createSevenSegment,
	litSegments,
	SEGMENT_SLANT,
	SEGMENT_VIEWBOX,
	segmentGeometry,
	type SegmentName,
	type SevenSegmentDisplay,
	type SevenSegmentOptions,
	type SevenSegmentStyle
} from './seven';
