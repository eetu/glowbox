// The uniform cross-framework instance-access contract: every component calls
// `oncreate` with its core handle after creation and with null on teardown —
// bound as a prop (`:oncreate="fn"`), not an `@create` listener.
import type { NixieTube as NixieTubeHandle } from '@glowbox/nixie';
import { mount } from '@vue/test-utils';
import { expect, test, vi } from 'vitest';

import { FlipDots } from '../FlipDots';
import { LedGrid } from '../LedGrid';
import { NeonSign } from '../NeonSign';
import { NixieTube } from '../NixieTube';
import { SevenSegment } from '../SevenSegment';
import { SplitFlap } from '../SplitFlap';
import { VfdPanel } from '../VfdPanel';

const nextFrame = () =>
	new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

// Mounted → handle, unmounted → null; the same assertions for every component.
const createdThenNull = async (
	name: string,
	wrapper: { unmount(): void },
	fn: ReturnType<typeof vi.fn>
) => {
	await nextFrame();
	expect(fn, name).toHaveBeenCalledTimes(1);
	expect(fn.mock.calls[0][0], name).not.toBeNull();
	wrapper.unmount();
	expect(fn.mock.lastCall?.[0], name).toBeNull();
};

test('every component hands its core handle to oncreate, and null on unmount', async () => {
	const to = document.body;
	let fn = vi.fn();
	await createdThenNull(
		'LedGrid',
		mount(LedGrid, {
			attachTo: to,
			props: {
				size: [3, 3, 3] as [number, number, number],
				camera: { autoOrbit: false },
				oncreate: fn
			}
		}),
		fn
	);
	fn = vi.fn();
	await createdThenNull(
		'NixieTube',
		mount(NixieTube, { attachTo: to, props: { value: 8, oncreate: fn } }),
		fn
	);
	fn = vi.fn();
	await createdThenNull(
		'SevenSegment',
		mount(SevenSegment, { attachTo: to, props: { value: 8, oncreate: fn } }),
		fn
	);
	fn = vi.fn();
	await createdThenNull(
		'FlipDots',
		mount(FlipDots, { attachTo: to, props: { cols: 4, rows: 4, flipMs: 0, oncreate: fn } }),
		fn
	);
	fn = vi.fn();
	await createdThenNull(
		'SplitFlap',
		mount(SplitFlap, { attachTo: to, props: { cols: 4, text: 'AB', flipMs: 0, oncreate: fn } }),
		fn
	);
	fn = vi.fn();
	await createdThenNull(
		'NeonSign',
		mount(NeonSign, { attachTo: to, props: { text: 'hi', strikeMs: 0, oncreate: fn } }),
		fn
	);
	fn = vi.fn();
	await createdThenNull('VfdPanel', mount(VfdPanel, { attachTo: to, props: { oncreate: fn } }), fn);
});

test('oncreate hands out the very handle the component exposes', async () => {
	const fn = vi.fn();
	const wrapper = mount(NixieTube, { attachTo: document.body, props: { value: 8, oncreate: fn } });
	await nextFrame();
	const tube = (wrapper.vm as unknown as { tube: NixieTubeHandle | null }).tube;
	expect(tube).not.toBeNull();
	expect(fn.mock.calls[0][0]).toBe(tube);
	wrapper.unmount();
});

test('a colour prop change still reaches setOptions (the unified deep watch)', async () => {
	const fn = vi.fn();
	const wrapper = mount(NixieTube, {
		attachTo: document.body,
		props: { value: 8, mesh: false, ghost: false, color: '#00ff00', oncreate: fn }
	});
	await nextFrame();
	const canvas = wrapper.element as HTMLCanvasElement;
	canvas.style.width = '84px';
	canvas.style.height = '150px';
	const tube = fn.mock.calls[0][0] as NixieTubeHandle;
	tube.resize();
	const channels = () => {
		const px = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
		let r = 0;
		let g = 0;
		for (let i = 0; i < px.length; i += 4) {
			r += px[i];
			g += px[i + 1];
		}
		return { r, g };
	};
	expect(channels().g).toBeGreaterThan(channels().r);
	await wrapper.setProps({ color: '#ff0000' });
	await nextFrame();
	expect(channels().r).toBeGreaterThan(channels().g);
	wrapper.unmount();
});
