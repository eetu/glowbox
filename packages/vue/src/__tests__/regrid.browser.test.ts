// A regrid (cols/rows) re-tiles the core blank, so the declarative content prop
// must land after it: whatever the props say is what the board shows. Combined
// changes run in both key orders — the props update (and trigger) in that order.
import type { FlipDotBoard } from '@glowbox/flip-dot';
import type { LcdModule as LcdModuleHandle } from '@glowbox/lcd';
import type { SplitFlapBoard } from '@glowbox/split-flap';
import { mount } from '@vue/test-utils';
import { expect, test } from 'vitest';

import { FlipDots } from '../FlipDots';
import { LcdModule } from '../LcdModule';
import { SplitFlap } from '../SplitFlap';

const nextFrame = () =>
	new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

const to = document.body;

test('SplitFlap: a cols change keeps the text', async () => {
	const wrapper = mount(SplitFlap, { attachTo: to, props: { cols: 4, text: 'AB', flipMs: 0 } });
	await nextFrame();
	const board = (wrapper.vm as unknown as { board: SplitFlapBoard }).board;
	expect(board.getText()).toEqual(['AB']);
	await wrapper.setProps({ cols: 6 });
	await nextFrame();
	expect(board.cols).toBe(6);
	expect(board.getText()).toEqual(['AB']);
	wrapper.unmount();
});

test('SplitFlap: cols and text changed together show the new text', async () => {
	for (const next of [
		{ cols: 8, text: 'ABCDEFGH' },
		{ text: 'ABCDEFGH', cols: 8 }
	]) {
		const wrapper = mount(SplitFlap, { attachTo: to, props: { cols: 4, text: 'AB', flipMs: 0 } });
		await nextFrame();
		const board = (wrapper.vm as unknown as { board: SplitFlapBoard }).board;
		await wrapper.setProps(next);
		await nextFrame();
		expect(board.getText(), Object.keys(next).join()).toEqual(['ABCDEFGH']);
		wrapper.unmount();
	}
});

test('FlipDots: cols and frame changed together show the frame', async () => {
	for (const next of [
		{ cols: 3, frame: [1, 0, 1] },
		{ frame: [1, 0, 1], cols: 3 }
	]) {
		const wrapper = mount(FlipDots, {
			attachTo: to,
			props: { cols: 2, rows: 1, frame: [1, 1], flipMs: 0 }
		});
		await nextFrame();
		const board = (wrapper.vm as unknown as { board: FlipDotBoard }).board;
		await wrapper.setProps(next);
		await nextFrame();
		expect(
			[0, 1, 2].map((x) => board.get(x, 0)),
			Object.keys(next).join()
		).toEqual([true, false, true]);
		wrapper.unmount();
	}
});

test('FlipDots: a rows change keeps the frame', async () => {
	const wrapper = mount(FlipDots, {
		attachTo: to,
		props: { cols: 3, rows: 2, frame: (x: number, y: number) => x === y, flipMs: 0 }
	});
	await nextFrame();
	const board = (wrapper.vm as unknown as { board: FlipDotBoard }).board;
	await wrapper.setProps({ rows: 3 });
	await nextFrame();
	expect([0, 1, 2].map((i) => board.get(i, i))).toEqual([true, true, true]);
	wrapper.unmount();
});

test('LcdModule: widening cols with a text that needs it shows all of it', async () => {
	for (const next of [
		{ cols: 20, text: 'B'.repeat(20) },
		{ text: 'B'.repeat(20), cols: 20 }
	]) {
		const wrapper = mount(LcdModule, {
			attachTo: to,
			props: { cols: 16, rows: 1, text: 'A'.repeat(16), boot: false, response: 0, label: 'lcd' }
		});
		await nextFrame();
		const lcd = (wrapper.vm as unknown as { lcd: LcdModuleHandle }).lcd;
		await wrapper.setProps(next);
		await nextFrame();
		expect(lcd.cols).toBe(20);
		expect(wrapper.element.getAttribute('aria-label'), Object.keys(next).join()).toBe(
			`lcd: ${'B'.repeat(20)}`
		);
		wrapper.unmount();
	}
});
