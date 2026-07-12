<script lang="ts">
	// Thin Svelte wrapper around the vanilla-three.js nixie scene (mirrors the glowbox
	// imperative-core + wrapper pattern). All the WebGL/three work is client-only, so it's
	// created in onMount; props drive it live via setDigits / setOptions.
	import { onMount } from 'svelte';

	import { createNixieScene, type NixieScene, type NixieSceneOptions } from '$lib/three/nixieScene';

	let {
		digits,
		color,
		glass,
		backdrop,
		style
	}: {
		digits: string[];
		color: string;
		glass: string;
		backdrop: string;
		style: NixieSceneOptions['style'];
	} = $props();

	let container: HTMLDivElement;
	let scene: NixieScene | null = null;

	onMount(() => {
		scene = createNixieScene(container, { digits, color, glass, backdrop, style });
		return () => {
			scene?.dispose();
			scene = null;
		};
	});

	// Live updates — the clock ticks `digits`; the panel drives colour/style.
	$effect(() => {
		scene?.setDigits(digits);
	});
	$effect(() => {
		scene?.setOptions({ color, glass, backdrop, style });
	});
</script>

<div class="scene3d" bind:this={container}></div>

<style>
	.scene3d {
		width: 100%;
		height: 100%;
		min-height: 0;
	}
</style>
