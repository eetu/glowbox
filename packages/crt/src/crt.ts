// @glowbox/crt — a composable CRT *viewing* layer for the glowbox family (and any
// canvas): where the display cores render physically honest objects (a glass tube, an
// LED module), this renders watching one THROUGH a curved phosphor screen. Give it a
// source canvas; it runs a per-frame WebGL pass onto its own output canvas:
//   • barrel curvature (real resampling, black outside the tube face)
//   • scanlines + a subtle phosphor stripe mask
//   • RGB convergence error that worsens toward the edges
//   • phosphor persistence — a real frame-history decay (moving content ghosts)
//   • vignette, brightness flicker, a slow rolling refresh band, static noise
// Everything is a 0..1 knob, live-updatable. `prefers-reduced-motion` freezes the
// temporal artifacts (flicker/band/noise animation) and disables persistence.
//
// The output canvas forwards pointer + wheel events back to the source (opt-out via
// `events: false`), so drag-orbit/zoom on a wrapped display keep working — the effect
// is transparent to interaction. The output is `aria-hidden`: it is a visual duplicate;
// the source keeps the semantics.

const VERT = `
  attribute vec2 aQuad;
  varying vec2 vUv;
  void main() {
    vUv = aQuad * 0.5 + 0.5;
    gl_Position = vec4(aQuad, 0.0, 1.0);
  }
`;

// History pass: phosphor persistence — new history = max(source, old history * decay).
// uSrc is a raw canvas upload (top-down rows, no CPU-side UNPACK_FLIP — that flip can
// cost a full-buffer copy), so it samples V-flipped; the FBO ends up upright.
const HIST_FRAG = `
  precision highp float;
  uniform sampler2D uSrc;
  uniform sampler2D uPrev;
  uniform float uDecay;
  varying vec2 vUv;
  void main() {
    vec3 src = texture2D(uSrc, vec2(vUv.x, 1.0 - vUv.y)).rgb;
    vec3 prev = texture2D(uPrev, vUv).rgb * uDecay;
    gl_FragColor = vec4(max(src, prev), 1.0);
  }
`;

// Screen pass: the tube face.
const CRT_FRAG = `
  precision highp float;
  uniform sampler2D uSrc;
  uniform vec2 uRes;
  uniform float uTime;
  uniform float uCurvature, uScanlines, uMask, uVignette, uConvergence;
  uniform float uFlicker, uBand, uNoise, uGain;
  uniform float uFlip; // 1 = uSrc is a raw canvas upload (top-down rows), 0 = FBO
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  void main() {
    // Barrel curvature: displace toward the corners, black beyond the face.
    vec2 c = vUv * 2.0 - 1.0;
    vec2 uv = (c + c.yx * c.yx * c * uCurvature * 0.28) * 0.5 + 0.5;
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
      gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
      return;
    }

    // Raw canvas uploads are top-down: flip V at sampling time (not at upload — the
    // CPU-side UNPACK_FLIP can cost a full-buffer copy). uv itself stays upright so
    // the scanline/band math is identical in both modes.
    vec2 suv = vec2(uv.x, abs(uFlip - uv.y));

    // Convergence error: the R/G/B guns drift apart toward the edges.
    float d = length(c);
    vec2 off = c * uConvergence * 0.004 * d;
    vec3 col = vec3(
      texture2D(uSrc, suv + off).r,
      texture2D(uSrc, suv).g,
      texture2D(uSrc, suv - off).b
    );

    // Scanlines follow the *content* rows (curved space), the mask the physical
    // phosphor stripes (screen space).
    float sl = 1.0 - uScanlines * 0.45 * (0.5 + 0.5 * sin(uv.y * uRes.y * 3.14159));
    float mx = mod(gl_FragCoord.x, 3.0);
    vec3 stripe = vec3(
      mx < 1.0 ? 1.0 : 0.72,
      mx >= 1.0 && mx < 2.0 ? 1.0 : 0.72,
      mx >= 2.0 ? 1.0 : 0.72
    );
    col *= sl * mix(vec3(1.0), stripe, uMask);

    // Rolling refresh band: a soft bright pulse sweeping down a virtual frame.
    float band = fract(uv.y - uTime * 0.12);
    col *= 1.0 + uBand * 0.22 * smoothstep(0.0, 0.12, band) * smoothstep(0.3, 0.12, band);

    // Vignette, mains flicker, static.
    col *= 1.0 - uVignette * 0.5 * d * d;
    col *= 1.0 - uFlicker * (0.04 * sin(uTime * 75.0) + 0.03 * hash(vec2(uTime, 3.7)));
    col += uNoise * 0.06 * (hash(uv * uRes * 0.5 + uTime * 60.0) - 0.5);

    gl_FragColor = vec4(col * uGain, 1.0);
  }
`;

export interface CrtOptions {
	/** Barrel curvature of the tube face 0..1 (default 0.35). */
	curvature?: number;
	/** Scanline strength 0..1 (default 0.45). */
	scanlines?: number;
	/** Phosphor stripe mask strength 0..1 (default 0.2). */
	mask?: number;
	/** Corner vignette 0..1 (default 0.4). */
	vignette?: number;
	/** RGB convergence error 0..1 (default 0.35). */
	convergence?: number;
	/** Phosphor persistence 0..1 — frame-history ghosting (default 0.3; forced 0
	 *  under `prefers-reduced-motion`). */
	persistence?: number;
	/** Mains flicker 0..1 (default 0.15; frozen under reduced motion). */
	flicker?: number;
	/** Rolling refresh band 0..1 (default 0.12; frozen under reduced motion). */
	band?: number;
	/** Static noise 0..1 (default 0.08; frozen under reduced motion). */
	noise?: number;
	/** Brightness compensation (default 1.08 — the mask/scanlines eat some light). */
	gain?: number;
	/** Forward pointer + wheel events from the output to the source canvas, so
	 *  drag-orbit/zoom keep working through the effect (default true). */
	events?: boolean;
	/** Cap on devicePixelRatio (default 2). */
	pixelRatio?: number;
}

export interface CrtScreen {
	/** The output canvas. **Element source**: already mounted over the container —
	 *  nothing to do. **Canvas source**: place it where the screen should appear (the
	 *  source can sit hidden underneath; keep it laid out so it keeps sizing itself). */
	readonly canvas: HTMLCanvasElement;
	setOptions(patch: Partial<CrtOptions>): void;
	resize(): void;
	dispose(): void;
}

/**
 * Wrap `source` in a CRT screen. Returns null where WebGL is unavailable.
 *
 * **Element source — slap it over anything**: `createCrtScreen(clockDiv)` mounts the
 * screen over the container itself (promoted to `position: relative` if static),
 * composites every descendant canvas at its layout position each frame (canvases
 * added/removed later are picked up), hides the originals (they stay laid out, so
 * their own observers keep working), and forwards pointer/wheel to the child canvas
 * under the cursor. `dispose()` restores everything. Note: it composites *canvases* —
 * other DOM inside the container (text, CSS backgrounds) is not captured.
 *
 * **Canvas source — the low-level mode**: you place `crt.canvas` yourself.
 */
export function createCrtScreen(
	source: HTMLCanvasElement | HTMLElement,
	opts: CrtOptions = {}
): CrtScreen | null {
	if (typeof document === 'undefined') return null;
	const canvas = document.createElement('canvas');
	const gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false });
	if (!gl) return null;

	const canvasSource = source instanceof HTMLCanvasElement ? source : null;
	// Element mode: descendant canvases are composited into this per frame.
	const comp = canvasSource ? null : document.createElement('canvas');
	const compCtx = comp ? comp.getContext('2d') : null;
	if (!canvasSource && !compCtx) return null;

	let curvature = opts.curvature ?? 0.35;
	let scanlines = opts.scanlines ?? 0.45;
	let mask = opts.mask ?? 0.2;
	let vignette = opts.vignette ?? 0.4;
	let convergence = opts.convergence ?? 0.35;
	let persistence = opts.persistence ?? 0.3;
	let flicker = opts.flicker ?? 0.15;
	let band = opts.band ?? 0.12;
	let noise = opts.noise ?? 0.08;
	let gain = opts.gain ?? 1.08;
	let events = opts.events ?? true;
	let pixelRatio = opts.pixelRatio ?? 2;

	const reduced =
		typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

	// The output is a visual duplicate — the source keeps the accessible semantics.
	canvas.setAttribute('aria-hidden', 'true');
	canvas.dataset.glowboxCrt = ''; // discovery marker: never composite our own output
	canvas.style.display = 'block';
	canvas.style.width = '100%';
	canvas.style.height = '100%';
	canvas.style.touchAction = 'none'; // forwarded drags must not fight page scroll

	// --- element-mode source tracking -------------------------------------------
	// Find the container's canvases, hide them (visibility keeps layout + their own
	// ResizeObservers alive), and watch for slots being added/removed (a nixie row
	// rebuilding, a component remounting). Everything undone on dispose.
	const hidden = new Map<HTMLCanvasElement, string>();
	let tracked: HTMLCanvasElement[] = [];
	const collect = () => {
		const el = source as HTMLElement;
		tracked = [...el.querySelectorAll('canvas')].filter(
			(c) => c !== canvas && !('glowboxCrt' in c.dataset)
		);
		for (const c of tracked)
			if (!hidden.has(c)) {
				hidden.set(c, c.style.visibility);
				c.style.visibility = 'hidden';
			}
		for (const [c, prev] of hidden)
			if (!tracked.includes(c) && c.isConnected) {
				c.style.visibility = prev;
				hidden.delete(c);
			}
	};
	const mo =
		!canvasSource && typeof MutationObserver !== 'undefined' ? new MutationObserver(collect) : null;

	// --- GL plumbing ------------------------------------------------------------
	function compile(type: number, src: string): WebGLShader | null {
		const sh = gl!.createShader(type);
		if (!sh) return null;
		gl!.shaderSource(sh, src);
		gl!.compileShader(sh);
		if (!gl!.getShaderParameter(sh, gl!.COMPILE_STATUS)) {
			console.warn('glowbox/crt shader:', gl!.getShaderInfoLog(sh));
			return null;
		}
		return sh;
	}
	function program(frag: string): WebGLProgram | null {
		const v = compile(gl!.VERTEX_SHADER, VERT);
		const f = compile(gl!.FRAGMENT_SHADER, frag);
		if (!v || !f) return null;
		const p = gl!.createProgram();
		if (!p) return null;
		gl!.attachShader(p, v);
		gl!.attachShader(p, f);
		gl!.linkProgram(p);
		return gl!.getProgramParameter(p, gl!.LINK_STATUS) ? p : null;
	}
	const crtProgN = program(CRT_FRAG);
	const histProgN = program(HIST_FRAG);
	if (!crtProgN || !histProgN) return null;
	// Re-bind as non-null consts: the narrowing above doesn't reach the render closure.
	const crtProg: WebGLProgram = crtProgN;
	const histProg: WebGLProgram = histProgN;

	const quad = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, quad);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
	const bindQuad = (loc: number) => {
		gl!.bindBuffer(gl!.ARRAY_BUFFER, quad);
		gl!.enableVertexAttribArray(loc);
		gl!.vertexAttribPointer(loc, 2, gl!.FLOAT, false, 0, 0);
	};
	// Locations are string lookups — resolve them once, not ~15 times per frame.
	const loc = (prog: WebGLProgram, names: string[]) =>
		Object.fromEntries(names.map((n) => [n, gl!.getUniformLocation(prog, n)]));
	const crtU = loc(crtProg, [
		'uSrc',
		'uRes',
		'uTime',
		'uCurvature',
		'uScanlines',
		'uMask',
		'uVignette',
		'uConvergence',
		'uFlicker',
		'uBand',
		'uNoise',
		'uGain',
		'uFlip'
	]);
	const histU = loc(histProg, ['uSrc', 'uPrev', 'uDecay']);
	const crtAttr = gl.getAttribLocation(crtProg, 'aQuad');
	const histAttr = gl.getAttribLocation(histProg, 'aQuad');

	const makeTex = () => {
		const t = gl!.createTexture();
		gl!.bindTexture(gl!.TEXTURE_2D, t);
		gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, gl!.LINEAR);
		gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, gl!.LINEAR);
		gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.CLAMP_TO_EDGE);
		gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.CLAMP_TO_EDGE);
		return t;
	};
	const srcTex = makeTex();
	let srcTexW = 0;
	let srcTexH = 0;
	// Ping-pong history for persistence.
	let histW = 0;
	let histH = 0;
	const histTex = [makeTex(), makeTex()];
	const histFbo = [gl.createFramebuffer(), gl.createFramebuffer()];
	let histFlip = 0;
	const ensureHistory = (w: number, h: number) => {
		if (histW === w && histH === h) return;
		histW = w;
		histH = h;
		for (let i = 0; i < 2; i++) {
			gl!.bindTexture(gl!.TEXTURE_2D, histTex[i]);
			gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA, w, h, 0, gl!.RGBA, gl!.UNSIGNED_BYTE, null);
			gl!.bindFramebuffer(gl!.FRAMEBUFFER, histFbo[i]);
			gl!.framebufferTexture2D(
				gl!.FRAMEBUFFER,
				gl!.COLOR_ATTACHMENT0,
				gl!.TEXTURE_2D,
				histTex[i],
				0
			);
		}
		gl!.bindFramebuffer(gl!.FRAMEBUFFER, null);
	};

	// --- render loop --------------------------------------------------------------
	let dpr = 1;
	let running = true;
	let raf = 0;
	const t0 = typeof performance !== 'undefined' ? performance.now() : 0;

	// The frame the tube shows: the source canvas directly, or (element mode) every
	// tracked canvas composited at its layout rect — black underneath, like a tube face.
	function texSource(): HTMLCanvasElement | null {
		if (canvasSource) return canvasSource.width && canvasSource.height ? canvasSource : null;
		const el = source as HTMLElement;
		const box = el.getBoundingClientRect();
		// Fast path: one canvas filling the whole box (the common single-display wrap)
		// needs no composite copy — upload it directly.
		if (tracked.length === 1) {
			const only = tracked[0];
			const r = only.getBoundingClientRect();
			if (
				only.width &&
				Math.abs(r.left - box.left) < 1 &&
				Math.abs(r.top - box.top) < 1 &&
				Math.abs(r.width - box.width) < 1 &&
				Math.abs(r.height - box.height) < 1
			)
				return only;
		}
		const w = Math.max(1, Math.round(box.width * dpr));
		const h = Math.max(1, Math.round(box.height * dpr));
		if (comp!.width !== w || comp!.height !== h) {
			comp!.width = w;
			comp!.height = h;
		}
		const c2 = compCtx!;
		c2.fillStyle = '#000';
		c2.fillRect(0, 0, w, h);
		for (const c of tracked) {
			if (!c.width || !c.height) continue;
			const r = c.getBoundingClientRect();
			c2.drawImage(
				c,
				(r.left - box.left) * dpr,
				(r.top - box.top) * dpr,
				r.width * dpr,
				r.height * dpr
			);
		}
		return comp!;
	}

	function frame() {
		if (!running) return;
		raf = requestAnimationFrame(frame);
		if (!canvas.width || !canvas.height) return;
		const src = texSource();
		if (!src) return;
		const g = gl!;
		const time = reduced ? 0 : (performance.now() - t0) / 1000;

		// Upload the source frame — allocate storage only when the size changes, then
		// stream with texSubImage2D (no per-frame realloc, no CPU flip; see uFlip).
		g.activeTexture(g.TEXTURE0);
		g.bindTexture(g.TEXTURE_2D, srcTex);
		if (srcTexW !== src.width || srcTexH !== src.height) {
			srcTexW = src.width;
			srcTexH = src.height;
			g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, src);
		} else {
			g.texSubImage2D(g.TEXTURE_2D, 0, 0, 0, g.RGBA, g.UNSIGNED_BYTE, src);
		}

		// Phosphor persistence: history = max(src, prev * decay).
		const decay = reduced ? 0 : persistence * 0.92;
		let screenSrc: WebGLTexture | null = srcTex;
		if (decay > 0) {
			ensureHistory(src.width, src.height);
			const read = histTex[histFlip];
			const write = histFbo[1 - histFlip];
			g.bindFramebuffer(g.FRAMEBUFFER, write);
			g.viewport(0, 0, histW, histH);
			g.useProgram(histProg);
			bindQuad(histAttr);
			g.activeTexture(g.TEXTURE0);
			g.bindTexture(g.TEXTURE_2D, srcTex);
			g.uniform1i(histU.uSrc, 0);
			g.activeTexture(g.TEXTURE1);
			g.bindTexture(g.TEXTURE_2D, read);
			g.uniform1i(histU.uPrev, 1);
			g.uniform1f(histU.uDecay, decay);
			g.drawArrays(g.TRIANGLES, 0, 3);
			histFlip = 1 - histFlip;
			screenSrc = histTex[histFlip];
		}

		// The screen pass.
		g.bindFramebuffer(g.FRAMEBUFFER, null);
		g.viewport(0, 0, canvas.width, canvas.height);
		g.useProgram(crtProg);
		bindQuad(crtAttr);
		g.activeTexture(g.TEXTURE0);
		g.bindTexture(g.TEXTURE_2D, screenSrc);
		g.uniform1i(crtU.uSrc, 0);
		g.uniform2f(crtU.uRes, canvas.width, canvas.height);
		g.uniform1f(crtU.uTime, time);
		g.uniform1f(crtU.uCurvature, curvature);
		g.uniform1f(crtU.uScanlines, scanlines);
		g.uniform1f(crtU.uMask, mask);
		g.uniform1f(crtU.uVignette, vignette);
		g.uniform1f(crtU.uConvergence, convergence);
		g.uniform1f(crtU.uFlicker, reduced ? 0 : flicker);
		g.uniform1f(crtU.uBand, reduced ? 0 : band);
		g.uniform1f(crtU.uNoise, reduced ? 0 : noise);
		g.uniform1f(crtU.uGain, gain);
		g.uniform1f(crtU.uFlip, screenSrc === srcTex ? 1 : 0);
		g.drawArrays(g.TRIANGLES, 0, 3);
	}

	// --- event forwarding -----------------------------------------------------
	// Re-dispatch pointer + wheel events on the source, so the display underneath
	// keeps its drag-orbit/zoom. Element mode hit-tests the child canvas under the
	// cursor (topmost wins). Client coordinates carry over 1:1 — orbit math uses
	// deltas, so the (possibly curved) mapping doesn't need inverting.
	const forwardTarget = (e: { clientX: number; clientY: number }): HTMLCanvasElement | null => {
		if (canvasSource) return canvasSource;
		for (let i = tracked.length - 1; i >= 0; i--) {
			const r = tracked[i].getBoundingClientRect();
			if (
				e.clientX >= r.left &&
				e.clientX <= r.right &&
				e.clientY >= r.top &&
				e.clientY <= r.bottom
			)
				return tracked[i];
		}
		return tracked[0] ?? null;
	};
	const FORWARD = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'] as const;
	const onPointer = (e: PointerEvent) => {
		if (!events) return;
		forwardTarget(e)?.dispatchEvent(new PointerEvent(e.type, e));
	};
	const onWheel = (e: WheelEvent) => {
		if (!events) return;
		// The synthetic event's preventDefault can't stop THIS event's default
		// (page scroll) — mirror the source's contract on the real one.
		e.preventDefault();
		forwardTarget(e)?.dispatchEvent(new WheelEvent('wheel', e));
	};
	for (const type of FORWARD) canvas.addEventListener(type, onPointer);
	canvas.addEventListener('wheel', onWheel, { passive: false });

	function resize() {
		const cap = pixelRatio > 0 ? pixelRatio : 1;
		dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, cap);
		const r = canvas.getBoundingClientRect();
		const w = Math.max(1, r.width || canvas.clientWidth || 1);
		const h = Math.max(1, r.height || canvas.clientHeight || 1);
		canvas.width = Math.max(1, Math.round(w * dpr));
		canvas.height = Math.max(1, Math.round(h * dpr));
	}
	const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => resize()) : null;
	ro?.observe(canvas);

	// Element mode mounts itself: overlay the container (promoting it to a positioned
	// box if needed), take over its canvases, and watch for new ones.
	let restorePosition: string | null = null;
	if (!canvasSource) {
		const el = source as HTMLElement;
		if (typeof getComputedStyle !== 'undefined' && getComputedStyle(el).position === 'static') {
			restorePosition = el.style.position;
			el.style.position = 'relative';
		}
		canvas.style.position = 'absolute';
		canvas.style.inset = '0';
		el.appendChild(canvas);
		collect();
		mo?.observe(el, { childList: true, subtree: true });
	}

	resize();
	raf = requestAnimationFrame(frame);

	return {
		canvas,
		setOptions(patch) {
			if (patch.curvature != null) curvature = patch.curvature;
			if (patch.scanlines != null) scanlines = patch.scanlines;
			if (patch.mask != null) mask = patch.mask;
			if (patch.vignette != null) vignette = patch.vignette;
			if (patch.convergence != null) convergence = patch.convergence;
			if (patch.persistence != null) persistence = patch.persistence;
			if (patch.flicker != null) flicker = patch.flicker;
			if (patch.band != null) band = patch.band;
			if (patch.noise != null) noise = patch.noise;
			if (patch.gain != null) gain = patch.gain;
			if (patch.events != null) events = patch.events;
			if (patch.pixelRatio != null) {
				pixelRatio = patch.pixelRatio;
				resize();
			}
		},
		resize,
		dispose() {
			running = false;
			if (raf) cancelAnimationFrame(raf);
			ro?.disconnect();
			mo?.disconnect();
			for (const type of FORWARD) canvas.removeEventListener(type, onPointer);
			canvas.removeEventListener('wheel', onWheel);
			// Element mode: hand the container back exactly as found.
			for (const [c, prev] of hidden) c.style.visibility = prev;
			hidden.clear();
			if (restorePosition != null) (source as HTMLElement).style.position = restorePosition;
			canvas.remove();
		}
	};
}
