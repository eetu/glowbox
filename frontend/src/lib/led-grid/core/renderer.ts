// Internal WebGL renderer for the LED grid — an nx×ny×nz lattice of point-light
// "LEDs". Each LED is an additively blended glowing sprite on black:
// order-independent (no depth sort), see-through, the classic LED-cube look.
// Unlit LEDs show as a faint dot so the lattice is always readable. Not exported
// from the package — createLedDisplay wraps it with the public draw API.

export type RenderView = {
	yaw: number;
	pitch: number;
	dist: number;
	fov: number;
	gain: number;
};

export type Renderer = {
	leds: Float32Array; // nx*ny*nz*3, RGB ≥0 (additive). Write then render().
	render(view: RenderView): void;
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
const FRAG = `
  precision highp float;
  uniform float uGain;
  varying vec3 vColor;
  void main() {
    float r = length(gl_PointCoord - 0.5) * 2.0; // 0 centre → 1 edge
    float core = smoothstep(1.0, 0.0, r);
    float glow = pow(core, 2.2);
    // faint dot for every node (unlit LED) + the LED's own colour, additive.
    vec3 c = vec3(0.02) * core + vColor * glow * uGain;
    gl_FragColor = vec4(c, 1.0);
  }
`;

export function createRenderer(
	canvas: HTMLCanvasElement,
	nx: number,
	ny: number,
	nz: number,
	bg: [number, number, number]
): Renderer | null {
	const gl = canvas.getContext('webgl', {
		antialias: true,
		alpha: false,
		premultipliedAlpha: false
	});
	if (!gl) return null;

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
	const vs = compile(gl.VERTEX_SHADER, VERT);
	const fs = compile(gl.FRAGMENT_SHADER, FRAG);
	const prog = gl.createProgram();
	if (!vs || !fs || !prog) return null;
	gl.attachShader(prog, vs);
	gl.attachShader(prog, fs);
	gl.linkProgram(prog);
	if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
		console.warn('led-grid link:', gl.getProgramInfoLog(prog));
		return null;
	}
	gl.useProgram(prog);

	const count = nx * ny * nz;
	// Uniform LED spacing so a non-cube grid isn't stretched: the largest axis
	// spans [-1,1], the others keep the same spacing, centred.
	const maxDim = Math.max(nx, ny, nz);
	const spacing = maxDim > 1 ? 2 / (maxDim - 1) : 0;
	const positions = new Float32Array(count * 3);
	let i = 0;
	for (let z = 0; z < nz; z++)
		for (let y = 0; y < ny; y++)
			for (let x = 0; x < nx; x++) {
				positions[i * 3] = (x - (nx - 1) / 2) * spacing;
				positions[i * 3 + 1] = (y - (ny - 1) / 2) * spacing;
				positions[i * 3 + 2] = (z - (nz - 1) / 2) * spacing;
				i++;
			}
	const leds = new Float32Array(count * 3);

	const posBuf = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
	gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
	const aPos = gl.getAttribLocation(prog, 'aPos');
	gl.enableVertexAttribArray(aPos);
	gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);

	const colBuf = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, colBuf);
	gl.bufferData(gl.ARRAY_BUFFER, leds, gl.DYNAMIC_DRAW);
	const aColor = gl.getAttribLocation(prog, 'aColor');
	gl.enableVertexAttribArray(aColor);
	gl.vertexAttribPointer(aColor, 3, gl.FLOAT, false, 0, 0);

	const uMVP = gl.getUniformLocation(prog, 'uMVP');
	const uPointScale = gl.getUniformLocation(prog, 'uPointScale');
	const uGain = gl.getUniformLocation(prog, 'uGain');

	gl.disable(gl.DEPTH_TEST);
	gl.enable(gl.BLEND);
	gl.blendFunc(gl.ONE, gl.ONE); // additive

	const proj = m4();
	const vm = m4();
	const mvp = m4();

	function render(view: RenderView) {
		const g = gl!;
		const w = canvas.width,
			h = canvas.height;
		g.viewport(0, 0, w, h);
		g.clearColor(bg[0], bg[1], bg[2], 1);
		g.clear(g.COLOR_BUFFER_BIT);

		orbit(vm, view.yaw, view.pitch, view.dist);
		perspective(proj, view.fov, w / h, 0.1, 100);
		mul(mvp, proj, vm);
		g.uniformMatrix4fv(uMVP, false, mvp);
		g.uniform1f(uPointScale, spacing * (h / 2) * (1 / Math.tan(view.fov / 2)) * 0.6);
		g.uniform1f(uGain, view.gain);

		g.bindBuffer(g.ARRAY_BUFFER, colBuf);
		g.bufferData(g.ARRAY_BUFFER, leds, g.DYNAMIC_DRAW);
		g.vertexAttribPointer(aColor, 3, g.FLOAT, false, 0, 0);
		g.drawArrays(g.POINTS, 0, count);
	}

	function dispose() {
		const g = gl!;
		g.deleteBuffer(posBuf);
		g.deleteBuffer(colBuf);
		g.deleteProgram(prog);
		g.deleteShader(vs);
		g.deleteShader(fs);
		g.getExtension('WEBGL_lose_context')?.loseContext();
	}

	return { leds, render, dispose };
}
