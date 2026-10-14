// A regrid (cols/rows) re-tiles the core blank, so the declarative content prop
// must land after it: whatever the props say is what the board shows.
import type { FlipDotBoard } from '@glowbox/flip-dot';
import type { LcdModule } from '@glowbox/lcd';
import type { SplitFlapBoard } from '@glowbox/split-flap';
import { tick } from 'svelte';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-svelte';

import FlipDots from '../lib/FlipDots.svelte';
import LcdModuleComp from '../lib/LcdModule.svelte';
import SplitFlap from '../lib/SplitFlap.svelte';

const nextFrame = () =>
	new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

test('SplitFlap: a cols change keeps the text', async () => {
	let board: SplitFlapBoard | null = null;
	const screen = await render(SplitFlap, {
		cols: 4,
		text: 'AB',
		flipMs: 0,
		oncreate: (b: SplitFlapBoard | null) => (board = b)
	});
	await tick();
	expect(board!.getText()).toEqual(['AB']);
	await screen.rerender({ cols: 6 });
	await tick();
	await nextFrame();
	expect(board!.cols).toBe(6);
	expect(board!.getText()).toEqual(['AB']);
});

test('SplitFlap: cols and text changed together show the new text', async () => {
	let board: SplitFlapBoard | null = null;
	const screen = await render(SplitFlap, {
		cols: 4,
		text: 'AB',
		flipMs: 0,
		oncreate: (b: SplitFlapBoard | null) => (board = b)
	});
	await tick();
	await screen.rerender({ cols: 8, text: 'ABCDEFGH' });
	await tick();
	await nextFrame();
	expect(board!.getText()).toEqual(['ABCDEFGH']);
});

test('FlipDots: cols and frame changed together show the frame', async () => {
	let board: FlipDotBoard | null = null;
	const screen = await render(FlipDots, {
		cols: 2,
		rows: 1,
		frame: [1, 1],
		flipMs: 0,
		oncreate: (b: FlipDotBoard | null) => (board = b)
	});
	await tick();
	await screen.rerender({ cols: 3, frame: [1, 0, 1] });
	await tick();
	await nextFrame();
	expect([0, 1, 2].map((x) => board!.get(x, 0))).toEqual([true, false, true]);
});

test('FlipDots: a rows change keeps the frame', async () => {
	let board: FlipDotBoard | null = null;
	const screen = await render(FlipDots, {
		cols: 3,
		rows: 2,
		frame: (x: number, y: number) => x === y,
		flipMs: 0,
		oncreate: (b: FlipDotBoard | null) => (board = b)
	});
	await tick();
	await screen.rerender({ rows: 3 });
	await tick();
	await nextFrame();
	expect([0, 1, 2].map((i) => board!.get(i, i))).toEqual([true, true, true]);
});

test('LcdModule: widening cols with a text that needs it shows all of it', async () => {
	let lcd: LcdModule | null = null;
	const screen = await render(LcdModuleComp, {
		cols: 16,
		rows: 1,
		text: 'A'.repeat(16),
		boot: false,
		response: 0,
		label: 'lcd',
		oncreate: (m: LcdModule | null) => (lcd = m)
	});
	await tick();
	await screen.rerender({ cols: 20, text: 'B'.repeat(20) });
	await tick();
	await nextFrame();
	expect(lcd!.cols).toBe(20);
	const canvas = screen.container.querySelector('canvas')!;
	expect(canvas.getAttribute('aria-label')).toBe(`lcd: ${'B'.repeat(20)}`);
});
