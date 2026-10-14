import { afterEach, expect, test } from 'vitest';

import { createSevenSegment } from '../seven';

const mount = (canvas: HTMLCanvasElement) => createSevenSegment(canvas, { value: 8 })!;

const frames = (n: number) =>
	new Promise<void>((done) => {
		const tick = () => (--n <= 0 ? done() : requestAnimationFrame(tick));
		requestAnimationFrame(tick);
	});
const deviceRatio = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio');
afterEach(() => {
	if (deviceRatio) Object.defineProperty(window, 'devicePixelRatio', deviceRatio);
	else Reflect.deleteProperty(window, 'devicePixelRatio');
});

test('a responsive canvas follows its container at 1×', async () => {
	const box = document.createElement('div');
	box.style.cssText = 'width: 400px; height: 200px';
	const canvas = document.createElement('canvas');
	canvas.style.cssText = 'display: block; width: 100%; height: 100%';
	box.append(canvas);
	document.body.append(box);
	const display = mount(canvas);
	await frames(3);
	box.style.width = '200px';
	await frames(3);
	expect([canvas.getBoundingClientRect().width, canvas.width]).toEqual([200, 200]);
	display.dispose();
	box.remove();
});

test('an unstyled canvas keeps its attribute size at 2×', async () => {
	Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true });
	const canvas = document.createElement('canvas');
	document.body.append(canvas);
	const display = mount(canvas);
	// A runaway doubles the box every frame; a few frames show it, and disposing before
	// asserting stops it before the canvas grows large enough to stall the page.
	await frames(3);
	const { width, height } = canvas.getBoundingClientRect();
	const backing = canvas.width;
	display.dispose();
	canvas.remove();
	expect([width, height, backing]).toEqual([300, 150, 600]);
});
