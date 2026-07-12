// Internal WebGL renderer for the LED grid — an nx×ny×nz lattice of point-light
// "LEDs" rendered as real emitters (the "hologram" look): each lit LED is a bright
// point with a soft glow halo; unlit LEDs are a tiny transparent speck. It reads on
// ANY background (dark or light) because the light is over-composited in front of it.
//
// Primary path: emissive → half-float HDR buffer → separable blur (halos) → ACES
// tone-map → over-composite onto the background. When the half-float extensions are
// unavailable it falls back to an RGBA8 over-composite (no HDR/blur) — same shape,
// slightly flatter. Not exported — createLedDisplay wraps it with the draw API.
import type { RGB } from './color';
import type { ActiveSet } from './voxel-grid';

export type Projection = 'perspective' | 'orthographic';
/** Visual look: 'hologram' (emissive glow, default) or 'comic' (cel-shaded + ink outline). */
export type LedStyle = 'hologram' | 'comic';
/** LED sprite shape: 'round' (default) or 'square' (tiles gap-free). */
export type LedShape = 'round' | 'square';
/** RGB sub-die arrangement (when `rgb` is on). `auto` picks the packing that best
 *  fits the shape: a delta **triad** for round dies, an RGGB **quad** for square.
 *  `stripe` is the classic R|G|B LCD-stripe look. */
export type RgbLayout = 'auto' | 'triad' | 'quad' | 'stripe';

/** Live-updatable appearance (all except `antialias`, which is fixed at context creation). */
export type RendererParams = {
	background: RGB;
	offColor: RGB;
	tint: RGB;
	glow: number;
	ledSize: number;
	/** Radius of the tiny "physical LED" speck shown when off, as a fraction of the sprite (0..1). */
	offSize: number;
	style: LedStyle;
	shape: LedShape;
	/** Comic ink-border thickness, 0..1 of the sprite radius (0 = no border). */
	outline: number;
	outlineColor: RGB;
	/** Brick lattice: offset every other row by half a cell (breaks the regular grid → less moiré). */
	stagger: boolean;
	/** Render each LED as three R/G/B sub-emitters (real RGB-LED look). */
	rgb: boolean;
	/** Sub-die packing when `rgb` is on (default 'auto' — triad for round, quad for square). */
	rgbLayout: RgbLayout;
	/** Comic brightness: false = cel-shade (keep tone), true = flat vivid (full value). */
	vivid: boolean;
	antialias: boolean;
};

export type RenderView = {
	yaw: number;
	pitch: number;
	dist: number;
	fov: number;
	gain: number;
	projection: Projection;
};

export type Renderer = {
	leds: Float32Array; // nx*ny*nz*3, RGB ≥0. Write then render().
	render(view: RenderView, active?: ActiveSet): void;
	configure(p: Partial<RendererParams>): void;
	dispose(): void;
};

// --- tiny column-major mat4 -------------------------------------------------
type M4 = Float32Array;
const m4 = (): M4 => new Float32Array(16);
function ident(o: M4): M4 {
	o.fill(0);
	o[0] = o[5] = o[10] = o[15] = 1;
	return o;
}
function mul(o: M4, a: M4, b: M4): M4 {
	for (let c = 0; c < 4; c++)
		for (let r = 0; r < 4; r++) {
			let s = 0;
			for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
			o[c * 4 + r] = s;
		}
	return o;
}
function perspective(o: M4, fov: number, aspect: number, near: number, far: number): M4 {
	const f = 1 / Math.tan(fov / 2);
	o.fill(0);
	o[0] = f / aspect;
	o[5] = f;
	o[10] = (far + near) / (near - far);
	o[11] = -1;
	o[14] = (2 * far * near) / (near - far);
	return o;
}
function ortho(o: M4, halfH: number, aspect: number, near: number, far: number): M4 {
	const halfW = halfH * aspect;
	o.fill(0);
	o[0] = 1 / halfW;
	o[5] = 1 / halfH;
	o[10] = -2 / (far - near);
	o[14] = -(far + near) / (far - near);
	o[15] = 1;
	return o;
}
function orbit(o: M4, yaw: number, pitch: number, dist: number): M4 {
	// view = translate(0,0,-dist) · Rx(pitch) · Ry(yaw)
	const cy = Math.cos(yaw),
		sy = Math.sin(yaw);
	const cx = Math.cos(pitch),
		sx = Math.sin(pitch);
	const ry = m4();
	ident(ry);
	ry[0] = cy;
	ry[2] = -sy;
	ry[8] = sy;
	ry[10] = cy;
	const rx = m4();
	ident(rx);
	rx[5] = cx;
	rx[6] = sx;
	rx[9] = -sx;
	rx[10] = cx;
	const rot = m4();
	mul(rot, rx, ry);
	ident(o);
	o[14] = -dist;
	const view = m4();
	mul(view, o, rot);
	o.set(view);
	return o;
}

const VERT = `
  attribute vec3 aPos;
  attribute vec3 aColor;
  uniform mat4 uMVP;
  uniform float uPointScale;
  varying vec3 vColor;
  void main() {
    vColor = aColor;
    vec4 p = uMVP * vec4(aPos, 1.0);
    gl_Position = p;
    gl_PointSize = clamp(uPointScale / p.w, 2.0, 64.0); // nearer LEDs bigger → depth cue
  }
`;
// Emissive LEDs, drawn into an offscreen buffer. The emitted light is a large soft
// glow; the physical LED is a tiny dot shown even when off (uDotSize ≪ 1). Alpha
// tracks brightness, so unlit LEDs are transparent (a real off LED is a dark speck).
const FRAG = `
  precision highp float;
  uniform float uGain;
  uniform float uGlow;
  uniform float uDotSize;
  uniform float uOutline;   // comic ink-border thickness (0 = none)
  uniform vec3 uOff;
  uniform vec3 uTint;
  uniform vec3 uOutlineColor;
  uniform int uStyle;       // 0 = hologram (emissive), 1 = comic (opaque, cel/vivid)
  uniform int uShape;       // 0 = round, 1 = square
  uniform int uVivid;       // comic: 0 = cel-shade (keep brightness), 1 = flat vivid (full value)
  uniform int uRgb;         // 1 = split each LED into R/G/B sub-emitters (real RGB-LED look)
  uniform int uRgbLayout;   // 0 = triad, 1 = quad (RGGB), 2 = stripe
  varying vec3 vColor;
  void main() {
    vec2 q = gl_PointCoord * 2.0 - 1.0;                              // sprite coords [-1,1]

    // RGB mode: the pixel is a real RGB-LED module — separate single-colour dies whose
    // channels are DIVIDED across them, grouped inside ONE led's footprint so it reads
    // as one blended led at a distance but resolves into its dies up close. Three
    // packings, each matched to a footprint (see RgbLayout): a delta TRIAD (round),
    // an RGGB QUAD (square, ~full fill + double green), or the classic R|G|B STRIPE.
    if (uRgb == 1) {
      float cR, cG, cB;                                            // per-channel coverage 0..1
      if (uRgbLayout == 1) {
        // QUAD (RGGB): 2×2 square sub-cells, two greens (eye is most green-sensitive).
        float h = 0.5;
        cR = smoothstep(1.0, 0.78, max(abs(q.x + 0.5), abs(q.y - 0.5)) / h);
        cG = max(smoothstep(1.0, 0.78, max(abs(q.x - 0.5), abs(q.y - 0.5)) / h),
                 smoothstep(1.0, 0.78, max(abs(q.x + 0.5), abs(q.y + 0.5)) / h));
        cB = smoothstep(1.0, 0.78, max(abs(q.x - 0.5), abs(q.y + 0.5)) / h);
      } else if (uRgbLayout == 2) {
        // STRIPE: three full-height R|G|B bars (retro LCD look).
        cR = smoothstep(0.33, 0.02, abs(q.x + 0.66));
        cG = smoothstep(0.33, 0.02, abs(q.x));
        cB = smoothstep(0.33, 0.02, abs(q.x - 0.66));
      } else {
        // TRIAD: three round dies in a tight, overlapping triangle (round default).
        float s = 1.5;
        cR = smoothstep(1.0, 0.0, length(q - vec2(0.0, 0.28)) * s);
        cG = smoothstep(1.0, 0.0, length(q - vec2(-0.24, -0.16)) * s);
        cB = smoothstep(1.0, 0.0, length(q - vec2(0.24, -0.16)) * s);
      }
      if (uStyle == 1) {
        // Comic dies: vivid (full value) or cel-shaded (quantized), hue kept; gaps drop.
        vec3 base = vColor * uTint;
        float lum = max(max(base.r, base.g), base.b);
        if (lum < 0.02) discard;
        float scale = uVivid == 1 ? (1.0 / lum) : (ceil(min(lum, 1.0) * 4.0) / 4.0 / lum);
        vec3 full = min(base * scale * uGain, 1.0);
        vec3 col = vec3(full.r * step(0.5, cR), full.g * step(0.5, cG), full.b * step(0.5, cB));
        if (max(max(col.r, col.g), col.b) < 0.02) discard;         // outside / all-off → gap
        gl_FragColor = vec4(col, 1.0);
        return;
      }
      // Hologram: each die glows its own channel; the glows ADD, so overlaps blend and
      // the module fuses to the true colour as it shrinks on screen.
      vec3 e = vec3(vColor.r * pow(cR, uGlow),
                    vColor.g * pow(cG, uGlow),
                    vColor.b * pow(cB, uGlow)) * uTint * uGain;
      gl_FragColor = vec4(e, clamp(max(max(e.r, e.g), e.b), 0.0, 1.0));
      return;
    }

    float d = (uShape == 1) ? max(abs(q.x), abs(q.y)) : length(q);  // 0 centre → 1 edge
    if (uStyle == 1) {
      // Comic: bold, flat cel-shaded fill (+ optional ink border), round or square.
      // Brightness is QUANTIZED into a few bands (posterized) but the LED's actual
      // brightness + hue are kept — so tonal content (images, fading trails) reads
      // faithfully, not maxed to full value. Faint/unlit LEDs drop out entirely.
      if (d > 1.0) discard;
      vec3 base = vColor * uTint;
      float lum = max(max(base.r, base.g), base.b);
      if (lum < 0.02) discard;                                 // dim / unlit → transparent
      // vivid: flatten to the full value of the hue (punchy flat pop-art). cel: keep
      // brightness, quantized into a few bands (posterized → tonal content reads).
      float scale = uVivid == 1 ? (1.0 / lum) : (ceil(min(lum, 1.0) * 4.0) / 4.0 / lum);
      vec3 col = min(base * scale * uGain, 1.0);
      col = mix(col, uOutlineColor, smoothstep(1.0 - uOutline, 1.0, d));
      gl_FragColor = vec4(col, 1.0);
      return;
    }
    // Hologram (emissive): soft glow + a tiny physical off-speck; alpha tracks
    // brightness so unlit LEDs are transparent. Square shape → a boxy glow.
    float core = smoothstep(1.0, 0.0, d);
    float glow = pow(core, uGlow);
    vec3 emit = vColor * uTint * glow * uGain;
    vec3 dot = uOff * smoothstep(uDotSize, 0.0, d);
    vec3 c = emit + dot;
    float cov = clamp(max(max(c.r, c.g), c.b), 0.0, 1.0);
    gl_FragColor = vec4(c, cov);
  }
`;

// Fullscreen-quad shaders (share COMP_VERT).
const COMP_VERT = `
  attribute vec2 aQuad;
  varying vec2 vUv;
  void main() {
    vUv = aQuad * 0.5 + 0.5;
    gl_Position = vec4(aQuad, 0.0, 1.0);
  }
`;
// Fallback (RGBA8): over-composite the accumulated light onto the background.
const COMP_FRAG = `
  precision highp float;
  uniform sampler2D uScene;
  uniform vec3 uBg;
  varying vec2 vUv;
  void main() {
    vec4 s = texture2D(uScene, vUv);
    gl_FragColor = vec4(uBg * (1.0 - clamp(s.a, 0.0, 1.0)) + s.rgb, 1.0);
  }
`;
// 9-tap separable Gaussian blur of the emissive HDR buffer → soft light halos.
const BLUR_FRAG = `
  precision highp float;
  uniform sampler2D uSrc;
  uniform vec2 uDir;
  varying vec2 vUv;
  void main() {
    float w0 = 0.227027, w1 = 0.1945946, w2 = 0.1216216, w3 = 0.054054, w4 = 0.016216;
    vec3 c = texture2D(uSrc, vUv).rgb * w0;
    c += texture2D(uSrc, vUv + uDir * 1.0).rgb * w1;
    c += texture2D(uSrc, vUv - uDir * 1.0).rgb * w1;
    c += texture2D(uSrc, vUv + uDir * 2.0).rgb * w2;
    c += texture2D(uSrc, vUv - uDir * 2.0).rgb * w2;
    c += texture2D(uSrc, vUv + uDir * 3.0).rgb * w3;
    c += texture2D(uSrc, vUv - uDir * 3.0).rgb * w3;
    c += texture2D(uSrc, vUv + uDir * 4.0).rgb * w4;
    c += texture2D(uSrc, vUv - uDir * 4.0).rgb * w4;
    gl_FragColor = vec4(c, 1.0);
  }
`;
// HDR: tone-map the light (emissive core + blurred halo) and over-composite on bg.
const BLOOM_FRAG = `
  precision highp float;
  uniform sampler2D uScene;   // emissive HDR: rgb = light, a = coverage
  uniform sampler2D uBloom;   // blurred halo
  uniform vec3 uBg;
  uniform float uStrength;
  varying vec2 vUv;
  vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
  void main() {
    vec4 e = texture2D(uScene, vUv);
    vec3 halo = texture2D(uBloom, vUv).rgb * uStrength;
    vec3 light = e.rgb + halo;
    float cov = clamp(max(e.a, max(halo.r, max(halo.g, halo.b))), 0.0, 1.0);
    // Tone-map only the emitted light; the background is preserved and the light
    // is over-composited onto it (like a real emitter in front of a surface).
    gl_FragColor = vec4(mix(uBg, aces(light), cov), 1.0);
  }
`;

export function createRenderer(
	canvas: HTMLCanvasElement,
	nx: number,
	ny: number,
	nz: number,
	params: RendererParams,
	// The frame buffer is owned by the display (so it survives a context rebuild /
	// resize). nx*ny*nz*3 RGB. If omitted the renderer allocates its own.
	leds: Float32Array = new Float32Array(nx * ny * nz * 3)
): Renderer | null {
	const gl = canvas.getContext('webgl', {
		antialias: params.antialias,
		alpha: false,
		premultipliedAlpha: false,
		depth: true // the comic style is opaque + depth-tested (hologram ignores it)
	});
	if (!gl) return null;

	// Half-float support for the HDR path (else the RGBA8 over-composite fallback).
	const extHF = gl.getExtension('OES_texture_half_float');
	const extCBF = gl.getExtension('EXT_color_buffer_half_float');
	const extHFL = gl.getExtension('OES_texture_half_float_linear');
	const HALF_FLOAT = extHF ? extHF.HALF_FLOAT_OES : 0;
	const canHdr = !!(extHF && extCBF);
	const hdrFilter = extHFL ? gl.LINEAR : gl.NEAREST;

	// Mutable appearance (updated by configure()).
	let bg = params.background;
	let off = params.offColor;
	let tint = params.tint;
	let glow = params.glow;
	let ledSize = params.ledSize;
	let offSize = params.offSize;
	let style = params.style;
	let shape = params.shape;
	let outline = params.outline;
	let outlineCol = params.outlineColor;
	let stagger = params.stagger;
	let rgb = params.rgb;
	let rgbLayout = params.rgbLayout;
	let vivid = params.vivid;

	function compile(type: number, src: string): WebGLShader | null {
		const sh = gl!.createShader(type);
		if (!sh) return null;
		gl!.shaderSource(sh, src);
		gl!.compileShader(sh);
		if (!gl!.getShaderParameter(sh, gl!.COMPILE_STATUS)) {
			console.warn('led-grid shader:', gl!.getShaderInfoLog(sh));
			return null;
		}
		return sh;
	}
	function linkProg(vsSrc: string, fsSrc: string): WebGLProgram | null {
		const vs = compile(gl!.VERTEX_SHADER, vsSrc);
		const fs = compile(gl!.FRAGMENT_SHADER, fsSrc);
		const p = gl!.createProgram();
		if (!vs || !fs || !p) {
			if (vs) gl!.deleteShader(vs);
			if (fs) gl!.deleteShader(fs);
			if (p) gl!.deleteProgram(p);
			return null;
		}
		gl!.attachShader(p, vs);
		gl!.attachShader(p, fs);
		gl!.linkProgram(p);
		// The shaders are linked into the program now; flag the standalone shader objects
		// for deletion so they don't linger (otherwise one leak per renderer rebuild —
		// resolution changes / context-restore each build a fresh renderer).
		gl!.deleteShader(vs);
		gl!.deleteShader(fs);
		if (!gl!.getProgramParameter(p, gl!.LINK_STATUS)) {
			console.warn('led-grid link:', gl!.getProgramInfoLog(p));
			gl!.deleteProgram(p);
			return null;
		}
		return p;
	}
	const prog = linkProg(VERT, FRAG);
	if (!prog) return null;
	gl.useProgram(prog);

	const count = nx * ny * nz;
	// Uniform LED spacing so a non-cube grid isn't stretched: the largest axis
	// spans [-1,1], the others keep the same spacing, centred.
	const maxDim = Math.max(nx, ny, nz);
	const spacing = maxDim > 1 ? 2 / (maxDim - 1) : 0;
	const positions = new Float32Array(count * 3);
	// Static lattice positions (index order z→y→x, matching the leds buffer). When
	// `stagger`, odd rows shift +half a cell in x for a brick layout — this also
	// perturbs the regular grid, which reduces the view-dependent moiré.
	function computePositions() {
		let i = 0;
		for (let z = 0; z < nz; z++)
			for (let y = 0; y < ny; y++) {
				const dx = stagger && y & 1 ? spacing * 0.5 : 0;
				for (let x = 0; x < nx; x++) {
					positions[i * 3] = (x - (nx - 1) / 2) * spacing + dx;
					positions[i * 3 + 1] = (y - (ny - 1) / 2) * spacing;
					positions[i * 3 + 2] = (z - (nz - 1) / 2) * spacing;
					i++;
				}
			}
	}
	computePositions();

	// Culling: each frame we pack only the LIT voxels into an interleaved
	// [x,y,z, r,g,b] buffer and draw just those — so a sparse shape in a big grid
	// rasterizes (and uploads) a handful of sprites instead of all nx·ny·nz.
	const packed = new Float32Array(count * 6);
	const packedBuf = gl.createBuffer();

	const aPos = gl.getAttribLocation(prog, 'aPos');
	const aColor = gl.getAttribLocation(prog, 'aColor');
	const uMVP = gl.getUniformLocation(prog, 'uMVP');
	const uPointScale = gl.getUniformLocation(prog, 'uPointScale');
	const uGain = gl.getUniformLocation(prog, 'uGain');
	const uGlow = gl.getUniformLocation(prog, 'uGlow');
	const uDotSize = gl.getUniformLocation(prog, 'uDotSize');
	const uOff = gl.getUniformLocation(prog, 'uOff');
	const uTint = gl.getUniformLocation(prog, 'uTint');
	const uOutline = gl.getUniformLocation(prog, 'uOutline');
	const uOutlineColor = gl.getUniformLocation(prog, 'uOutlineColor');
	const uStyle = gl.getUniformLocation(prog, 'uStyle');
	const uShape = gl.getUniformLocation(prog, 'uShape');
	const uRgb = gl.getUniformLocation(prog, 'uRgb');
	const uRgbLayout = gl.getUniformLocation(prog, 'uRgbLayout');
	const uVivid = gl.getUniformLocation(prog, 'uVivid');

	// LEDs accumulate additively into the offscreen buffer (order-independent).
	function setEmissiveState() {
		gl!.disable(gl!.DEPTH_TEST);
		gl!.enable(gl!.BLEND);
		gl!.blendFunc(gl!.ONE, gl!.ONE);
	}
	setEmissiveState();

	// --- shared fullscreen quad ---
	let quadBuf: WebGLBuffer | null = null;
	function ensureQuad() {
		if (quadBuf) return;
		quadBuf = gl!.createBuffer();
		gl!.bindBuffer(gl!.ARRAY_BUFFER, quadBuf);
		gl!.bufferData(
			gl!.ARRAY_BUFFER,
			new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
			gl!.STATIC_DRAW
		);
	}
	function drawQuad(aLoc: number) {
		gl!.bindBuffer(gl!.ARRAY_BUFFER, quadBuf);
		gl!.enableVertexAttribArray(aLoc);
		gl!.vertexAttribPointer(aLoc, 2, gl!.FLOAT, false, 0, 0);
		gl!.drawArrays(gl!.TRIANGLES, 0, 6);
	}
	function makeTex(w: number, h: number, type: number, filter: number): WebGLTexture | null {
		const g = gl!;
		const t = g.createTexture();
		g.bindTexture(g.TEXTURE_2D, t);
		g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, w, h, 0, g.RGBA, type, null);
		g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, filter);
		g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, filter);
		g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
		g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
		return t;
	}
	function attach(fbo: WebGLFramebuffer | null, tex: WebGLTexture | null): boolean {
		const g = gl!;
		g.bindFramebuffer(g.FRAMEBUFFER, fbo);
		g.framebufferTexture2D(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.TEXTURE_2D, tex, 0);
		const ok = g.checkFramebufferStatus(g.FRAMEBUFFER) === g.FRAMEBUFFER_COMPLETE;
		g.bindFramebuffer(g.FRAMEBUFFER, null);
		return ok;
	}

	// --- RGBA8 fallback resources (over-composite, no blur) ---
	let compProg: WebGLProgram | null = null;
	let ldrFbo: WebGLFramebuffer | null = null;
	let ldrTex: WebGLTexture | null = null;
	let aQuadComp = -1;
	let uCompScene: WebGLUniformLocation | null = null;
	let uCompBg: WebGLUniformLocation | null = null;
	let ldrW = 0;
	let ldrH = 0;
	function ensureLdr(w: number, h: number): boolean {
		const g = gl!;
		if (!compProg) {
			compProg = linkProg(COMP_VERT, COMP_FRAG);
			if (!compProg) return false;
			ensureQuad();
			aQuadComp = g.getAttribLocation(compProg, 'aQuad');
			uCompScene = g.getUniformLocation(compProg, 'uScene');
			uCompBg = g.getUniformLocation(compProg, 'uBg');
			ldrFbo = g.createFramebuffer();
		}
		if (w !== ldrW || h !== ldrH) {
			if (ldrTex) g.deleteTexture(ldrTex);
			ldrTex = makeTex(w, h, g.UNSIGNED_BYTE, g.LINEAR);
			if (!attach(ldrFbo, ldrTex)) return false;
			ldrW = w;
			ldrH = h;
		}
		return true;
	}

	// --- HDR bloom resources (half-float scene + blur + tone-map) ---
	let blurProg: WebGLProgram | null = null;
	let bloomProg: WebGLProgram | null = null;
	let hdrFailed = false;
	let sceneFbo: WebGLFramebuffer | null = null;
	let bloomFboA: WebGLFramebuffer | null = null;
	let bloomFboB: WebGLFramebuffer | null = null;
	let sceneTex: WebGLTexture | null = null;
	let bloomTexA: WebGLTexture | null = null;
	let bloomTexB: WebGLTexture | null = null;
	let aQuadBlur = -1;
	let aQuadBloom = -1;
	let uBlurSrc: WebGLUniformLocation | null = null;
	let uBlurDir: WebGLUniformLocation | null = null;
	let uBloomScene: WebGLUniformLocation | null = null;
	let uBloomHalo: WebGLUniformLocation | null = null;
	let uBloomBg: WebGLUniformLocation | null = null;
	let uBloomStrength: WebGLUniformLocation | null = null;
	let hdrW = 0;
	let hdrH = 0;
	function ensureHdr(w: number, h: number): boolean {
		if (hdrFailed || !canHdr) return false;
		const g = gl!;
		if (!bloomProg) {
			blurProg = linkProg(COMP_VERT, BLUR_FRAG);
			bloomProg = linkProg(COMP_VERT, BLOOM_FRAG);
			if (!blurProg || !bloomProg) {
				hdrFailed = true;
				return false;
			}
			ensureQuad();
			aQuadBlur = g.getAttribLocation(blurProg, 'aQuad');
			uBlurSrc = g.getUniformLocation(blurProg, 'uSrc');
			uBlurDir = g.getUniformLocation(blurProg, 'uDir');
			aQuadBloom = g.getAttribLocation(bloomProg, 'aQuad');
			uBloomScene = g.getUniformLocation(bloomProg, 'uScene');
			uBloomHalo = g.getUniformLocation(bloomProg, 'uBloom');
			uBloomBg = g.getUniformLocation(bloomProg, 'uBg');
			uBloomStrength = g.getUniformLocation(bloomProg, 'uStrength');
			sceneFbo = g.createFramebuffer();
			bloomFboA = g.createFramebuffer();
			bloomFboB = g.createFramebuffer();
		}
		if (w !== hdrW || h !== hdrH) {
			const hw = Math.max(1, Math.ceil(w / 4));
			const hh = Math.max(1, Math.ceil(h / 4));
			for (const t of [sceneTex, bloomTexA, bloomTexB]) if (t) g.deleteTexture(t);
			sceneTex = makeTex(w, h, HALF_FLOAT, hdrFilter);
			bloomTexA = makeTex(hw, hh, HALF_FLOAT, hdrFilter);
			bloomTexB = makeTex(hw, hh, HALF_FLOAT, hdrFilter);
			if (
				!attach(sceneFbo, sceneTex) ||
				!attach(bloomFboA, bloomTexA) ||
				!attach(bloomFboB, bloomTexB)
			) {
				hdrFailed = true; // driver can't render to half-float → use the fallback
				return false;
			}
			hdrW = w;
			hdrH = h;
		}
		return true;
	}

	const proj = m4();
	const vm = m4();
	const mvp = m4();
	let activeSrc: ActiveSet | undefined;

	function pack(j: number, k: number) {
		const o = k * 6;
		packed[o] = positions[j];
		packed[o + 1] = positions[j + 1];
		packed[o + 2] = positions[j + 2];
		packed[o + 3] = leds[j];
		packed[o + 4] = leds[j + 1];
		packed[o + 5] = leds[j + 2];
	}

	function drawPoints() {
		const g = gl!;
		// Pack lit voxels (position + colour) into one interleaved buffer. If a
		// lattice is requested (offColor != black) the fragment draws a speck at
		// *every* node, so we must keep unlit voxels too — no culling then.
		const keepUnlit = off[0] > 0 || off[1] > 0 || off[2] > 0;
		let k = 0;
		if (activeSrc && !activeSrc.all && !keepUnlit) {
			// Fast path: iterate only the cells lit since the last clear (O(lit)).
			const list = activeSrc.list;
			const n = activeSrc.count;
			for (let a = 0; a < n; a++) {
				const j = list[a] * 3;
				if (leds[j] > 0 || leds[j + 1] > 0 || leds[j + 2] > 0) pack(j, k++);
			}
		} else {
			// Full scan (fill / lattice / raw markAll / no tracking).
			for (let idx = 0; idx < count; idx++) {
				const j = idx * 3;
				if (keepUnlit || leds[j] > 0 || leds[j + 1] > 0 || leds[j + 2] > 0) pack(j, k++);
			}
		}
		g.bindBuffer(g.ARRAY_BUFFER, packedBuf);
		g.bufferData(g.ARRAY_BUFFER, packed.subarray(0, k * 6), g.DYNAMIC_DRAW);
		g.enableVertexAttribArray(aPos);
		g.vertexAttribPointer(aPos, 3, g.FLOAT, false, 24, 0);
		g.enableVertexAttribArray(aColor);
		g.vertexAttribPointer(aColor, 3, g.FLOAT, false, 24, 12);
		g.drawArrays(g.POINTS, 0, k);
	}

	function render(view: RenderView, active?: ActiveSet) {
		const g = gl!;
		activeSrc = active;
		const w = canvas.width,
			h = canvas.height;

		orbit(vm, view.yaw, view.pitch, view.dist);
		const aspect = w / h;
		// `view.fov` is the vertical FOV, which frames landscape well but lets a
		// portrait/narrow viewport clip the grid's sides. On aspect < 1 widen the FOV
		// so the grid fits the *width* (fit-to-narrower-dimension) — landscape is
		// unchanged. pointScale uses the same effective FOV so sprites scale with it.
		const fov = aspect < 1 ? 2 * Math.atan(Math.tan(view.fov / 2) / aspect) : view.fov;
		let pointScale: number;
		if (view.projection === 'orthographic') {
			const halfH = view.dist * Math.tan(fov / 2);
			ortho(proj, halfH, aspect, 0.1, 100);
			pointScale = ((spacing * (h / 2)) / halfH) * ledSize; // w==1, constant size
		} else {
			perspective(proj, fov, aspect, 0.1, 100);
			pointScale = spacing * (h / 2) * (1 / Math.tan(fov / 2)) * ledSize;
		}
		mul(mvp, proj, vm);

		g.useProgram(prog);
		g.uniformMatrix4fv(uMVP, false, mvp);
		g.uniform1f(uPointScale, pointScale);
		g.uniform1f(uGain, view.gain);
		g.uniform1f(uGlow, glow);
		g.uniform1f(uDotSize, offSize);
		g.uniform3fv(uOff, off);
		g.uniform3fv(uTint, tint);
		g.uniform1f(uOutline, outline);
		g.uniform3fv(uOutlineColor, outlineCol);
		g.uniform1i(uStyle, style === 'comic' ? 1 : 0);
		g.uniform1i(uShape, shape === 'square' ? 1 : 0);
		g.uniform1i(uRgb, rgb ? 1 : 0);
		// 'auto' → quad on square LEDs, triad on round (best packing per footprint).
		const layout = rgbLayout === 'auto' ? (shape === 'square' ? 'quad' : 'triad') : rgbLayout;
		g.uniform1i(uRgbLayout, layout === 'quad' ? 1 : layout === 'stripe' ? 2 : 0);
		g.uniform1i(uVivid, vivid ? 1 : 0);

		if (style === 'comic') {
			renderComic(w, h);
			return;
		}
		setEmissiveState(); // additive for the offscreen point pass (may follow a comic frame)
		if (ensureHdr(w, h)) renderBloom(w, h);
		else if (ensureLdr(w, h)) renderLdr(w, h);
	}

	// Comic: opaque, depth-tested LEDs drawn straight to screen over the background.
	function renderComic(w: number, h: number) {
		const g = gl!;
		g.bindFramebuffer(g.FRAMEBUFFER, null);
		g.viewport(0, 0, w, h);
		g.disable(g.BLEND);
		g.enable(g.DEPTH_TEST);
		g.clearColor(bg[0], bg[1], bg[2], 1);
		g.clear(g.COLOR_BUFFER_BIT | g.DEPTH_BUFFER_BIT);
		drawPoints();
	}

	// RGBA8 fallback: accumulate light, then over-composite onto the background.
	function renderLdr(w: number, h: number) {
		const g = gl!;
		g.bindFramebuffer(g.FRAMEBUFFER, ldrFbo);
		g.viewport(0, 0, w, h);
		g.clearColor(0, 0, 0, 0);
		g.clear(g.COLOR_BUFFER_BIT);
		drawPoints();
		g.bindFramebuffer(g.FRAMEBUFFER, null);
		g.viewport(0, 0, w, h);
		g.disable(g.BLEND);
		g.useProgram(compProg);
		g.activeTexture(g.TEXTURE0);
		g.bindTexture(g.TEXTURE_2D, ldrTex);
		g.uniform1i(uCompScene, 0);
		g.uniform3fv(uCompBg, bg);
		drawQuad(aQuadComp);
		g.useProgram(prog);
		setEmissiveState();
	}

	// HDR: emissive → blur (halos) → tone-map + over-composite.
	function renderBloom(w: number, h: number) {
		const g = gl!;
		const hw = Math.max(1, Math.ceil(w / 4));
		const hh = Math.max(1, Math.ceil(h / 4));

		g.bindFramebuffer(g.FRAMEBUFFER, sceneFbo);
		g.viewport(0, 0, w, h);
		g.clearColor(0, 0, 0, 0);
		g.clear(g.COLOR_BUFFER_BIT);
		drawPoints();

		g.disable(g.BLEND);
		g.useProgram(blurProg);
		g.bindFramebuffer(g.FRAMEBUFFER, bloomFboA);
		g.viewport(0, 0, hw, hh);
		g.activeTexture(g.TEXTURE0);
		g.bindTexture(g.TEXTURE_2D, sceneTex);
		g.uniform1i(uBlurSrc, 0);
		g.uniform2f(uBlurDir, 1 / w, 0);
		drawQuad(aQuadBlur);
		g.bindFramebuffer(g.FRAMEBUFFER, bloomFboB);
		g.viewport(0, 0, hw, hh);
		g.bindTexture(g.TEXTURE_2D, bloomTexA);
		g.uniform2f(uBlurDir, 0, 1 / hh);
		drawQuad(aQuadBlur);

		g.bindFramebuffer(g.FRAMEBUFFER, null);
		g.viewport(0, 0, w, h);
		g.useProgram(bloomProg);
		g.activeTexture(g.TEXTURE0);
		g.bindTexture(g.TEXTURE_2D, sceneTex);
		g.uniform1i(uBloomScene, 0);
		g.activeTexture(g.TEXTURE1);
		g.bindTexture(g.TEXTURE_2D, bloomTexB);
		g.uniform1i(uBloomHalo, 1);
		g.uniform3fv(uBloomBg, bg);
		g.uniform1f(uBloomStrength, 1.0);
		drawQuad(aQuadBloom);
		g.activeTexture(g.TEXTURE0);

		g.useProgram(prog);
		setEmissiveState();
	}

	function configure(p: Partial<RendererParams>) {
		if (p.background) bg = p.background;
		if (p.offColor) off = p.offColor;
		if (p.tint) tint = p.tint;
		if (p.glow !== undefined) glow = p.glow;
		if (p.ledSize !== undefined) ledSize = p.ledSize;
		if (p.offSize !== undefined) offSize = p.offSize;
		if (p.style) style = p.style;
		if (p.shape) shape = p.shape;
		if (p.outline !== undefined) outline = p.outline;
		if (p.outlineColor) outlineCol = p.outlineColor;
		if (p.stagger !== undefined && p.stagger !== stagger) {
			stagger = p.stagger;
			computePositions(); // O(count), rare (only on toggle)
		}
		if (p.rgb !== undefined) rgb = p.rgb;
		if (p.rgbLayout) rgbLayout = p.rgbLayout;
		if (p.vivid !== undefined) vivid = p.vivid;
	}

	// Frees GL objects only — does NOT lose the context. The display owns the
	// canvas/context lifetime (so it can rebuild a renderer on the same canvas after
	// a resize or a context-restore); it loses the context itself on final teardown.
	function dispose() {
		const g = gl!;
		g.deleteBuffer(packedBuf);
		g.deleteProgram(prog);
		if (compProg) g.deleteProgram(compProg);
		if (blurProg) g.deleteProgram(blurProg);
		if (bloomProg) g.deleteProgram(bloomProg);
		if (quadBuf) g.deleteBuffer(quadBuf);
		for (const t of [ldrTex, sceneTex, bloomTexA, bloomTexB]) if (t) g.deleteTexture(t);
		for (const f of [ldrFbo, sceneFbo, bloomFboA, bloomFboB]) if (f) g.deleteFramebuffer(f);
	}

	return { leds, render, configure, dispose };
}
