// A regrid (cols/rows) re-tiles the core blank, so the declarative content prop
// must land after it: whatever the props say is what the board shows.
import type { FlipDotBoard } from '@glowbox/flip-dot';
import type { SplitFlapBoard } from '@glowbox/split-flap';
import { createRef } from 'react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

import { FlipDots } from '../FlipDots';
import { LcdModule } from '../LcdModule';
import { SplitFlap } from '../SplitFlap';

const nextFrame = () =>
	new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

const box = { width: 300, height: 80 };

test('SplitFlap: a cols change keeps the text', async () => {
	const ref = createRef<SplitFlapBoard | null>();
	const el = (cols: number) => (
		<div style={box}>
			<SplitFlap ref={ref} cols={cols} text="AB" flipMs={0} />
		</div>
	);
	const screen = await render(el(4));
	await nextFrame();
	expect(ref.current!.getText()).toEqual(['AB']);
	await screen.rerender(el(6));
	await nextFrame();
	expect(ref.current!.cols).toBe(6);
	expect(ref.current!.getText()).toEqual(['AB']);
});

test('SplitFlap: cols and text changed together show the new text', async () => {
	const ref = createRef<SplitFlapBoard | null>();
	const el = (cols: number, text: string) => (
		<div style={box}>
			<SplitFlap ref={ref} cols={cols} text={text} flipMs={0} />
		</div>
	);
	const screen = await render(el(4, 'AB'));
	await nextFrame();
	await screen.rerender(el(8, 'ABCDEFGH'));
	await nextFrame();
	expect(ref.current!.getText()).toEqual(['ABCDEFGH']);
});

test('FlipDots: cols and frame changed together show the frame', async () => {
	const ref = createRef<FlipDotBoard | null>();
	const el = (frame: number[]) => (
		<div style={box}>
			<FlipDots ref={ref} cols={frame.length} rows={1} frame={frame} flipMs={0} />
		</div>
	);
	const screen = await render(el([1, 1]));
	await nextFrame();
	await screen.rerender(el([1, 0, 1]));
	await nextFrame();
	expect([0, 1, 2].map((x) => ref.current!.get(x, 0))).toEqual([true, false, true]);
});

test('FlipDots: a rows change keeps the frame', async () => {
	const ref = createRef<FlipDotBoard | null>();
	const frame = (x: number, y: number) => x === y;
	const el = (rows: number) => (
		<div style={box}>
			<FlipDots ref={ref} cols={3} rows={rows} frame={frame} flipMs={0} />
		</div>
	);
	const screen = await render(el(2));
	await nextFrame();
	await screen.rerender(el(3));
	await nextFrame();
	expect([0, 1, 2].map((i) => ref.current!.get(i, i))).toEqual([true, true, true]);
});

test('LcdModule: widening cols with a text that needs it shows all of it', async () => {
	const el = (cols: number, text: string) => (
		<div style={box}>
			<LcdModule cols={cols} rows={1} text={text} boot={false} response={0} label="lcd" />
		</div>
	);
	const screen = await render(el(16, 'A'.repeat(16)));
	await nextFrame();
	await screen.rerender(el(20, 'B'.repeat(20)));
	await nextFrame();
	const canvas = screen.container.querySelector('canvas')!;
	expect(canvas.getAttribute('aria-label')).toBe(`lcd: ${'B'.repeat(20)}`);
});
