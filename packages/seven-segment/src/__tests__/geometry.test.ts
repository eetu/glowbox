// The 3D-compositing exports are pure data — node-testable by design.
import { expect, test } from 'vitest';

import { litSegments, SEGMENT_SLANT, SEGMENT_VIEWBOX, segmentGeometry } from '../seven';

test('segmentGeometry: seven hexagonal segments + the dp circle, inside the viewBox', () => {
	const { segments, dp } = segmentGeometry();
	expect(segments.map((s) => s.name)).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g']);
	for (const s of segments) {
		expect(s.polygon).toHaveLength(6); // pointed-end hexagons
		for (const [x, y] of s.polygon) {
			expect(x).toBeGreaterThanOrEqual(0);
			expect(x).toBeLessThanOrEqual(SEGMENT_VIEWBOX.width);
			expect(y).toBeGreaterThanOrEqual(0);
			expect(y).toBeLessThanOrEqual(SEGMENT_VIEWBOX.height);
		}
	}
	expect(dp.r).toBeGreaterThan(0);
	expect(SEGMENT_SLANT).toBeGreaterThan(0);
});

test('litSegments matches the driver-chip font', () => {
	expect(litSegments(8)).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g']);
	expect(litSegments('1')).toEqual(['b', 'c']);
	expect(litSegments('-')).toEqual(['g']);
	expect(litSegments('a')).toEqual(litSegments('A')); // hex, case-tolerant
	expect(litSegments('B')).toEqual(litSegments('b')); // …in both directions
	expect(litSegments(null)).toEqual([]);
	expect(litSegments('x')).toEqual([]);
});
