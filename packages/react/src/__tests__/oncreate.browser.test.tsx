// The uniform cross-framework instance-access contract: every component calls
// `oncreate` with its core handle after creation and with null on teardown —
// the signal the forwarded ref can't give (it flips silently).
import type { LedDisplay } from '@glowbox/led-grid';
import { createRef, type ReactElement } from 'react';
import { expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';

import { FlipDots } from '../FlipDots';
import { LedGrid } from '../LedGrid';
import { NeonSign } from '../NeonSign';
import { NixieTube } from '../NixieTube';
import { SevenSegment } from '../SevenSegment';
import { SplitFlap } from '../SplitFlap';
import { VfdPanel } from '../VfdPanel';

const nextFrame = () =>
	new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

// One element per component — oncreate is the same prop name and shape on all seven.
const mounts: [string, (fn: (h: unknown) => void) => ReactElement][] = [
	['LedGrid', (fn) => <LedGrid size={[3, 3, 3]} camera={{ autoOrbit: false }} oncreate={fn} />],
	['NixieTube', (fn) => <NixieTube value={8} oncreate={fn} />],
	['SevenSegment', (fn) => <SevenSegment value={8} oncreate={fn} />],
	['FlipDots', (fn) => <FlipDots cols={4} rows={4} flipMs={0} oncreate={fn} />],
	['SplitFlap', (fn) => <SplitFlap cols={4} text="AB" flipMs={0} oncreate={fn} />],
	['NeonSign', (fn) => <NeonSign text="hi" strikeMs={0} oncreate={fn} />],
	['VfdPanel', (fn) => <VfdPanel oncreate={fn} />]
];

test('every component hands its core handle to oncreate, and null on teardown', async () => {
	for (const [name, el] of mounts) {
		const fn = vi.fn();
		const screen = await render(el(fn));
		await nextFrame();
		expect(fn, name).toHaveBeenCalledTimes(1);
		expect(fn.mock.calls[0][0], name).not.toBeNull();
		await screen.unmount();
		expect(fn.mock.lastCall?.[0], name).toBeNull();
	}
});

test('oncreate hands out the very handle the forwarded ref holds', async () => {
	const ref = createRef<LedDisplay | null>();
	const fn = vi.fn();
	await render(<LedGrid ref={ref} size={[3, 3, 3]} camera={{ autoOrbit: false }} oncreate={fn} />);
	await nextFrame();
	expect(ref.current).not.toBeNull();
	expect(fn.mock.calls[0][0]).toBe(ref.current);
});
