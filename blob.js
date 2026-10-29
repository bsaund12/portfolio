// Hero blob — a shiny, wobbling 3D sphere drawn with WebGL into canvas.blob-canvas.
// The GPU "ray marches" every pixel: it shoots a ray from a virtual camera and
// steps along it until it hits the blob's surface, then shades that spot.
(() => {
  const canvas = document.querySelector('.blob-canvas');
  if (!canvas) return;

  const hero = canvas.closest('.hero');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const WOBBLE = 0.16;
  const MAX_PIXEL_RATIO = 1.25;
  const RENDER_SCALE = 0.75; // draw fewer pixels than shown; CSS stretches the canvas back up
  const MOUSE_EASE = 0.05;
  const GUARD_FRAMES = 60;
  const GUARD_MAX_AVG_MS = 40;

  // Phones and tablets get the CSS blob. Their GPUs can't keep up with ray
  // marching, and iOS kills the whole tab when a frame takes too long.
  const isTouchOrSmall = window.matchMedia('(hover: none), (pointer: coarse)').matches || window.innerWidth < 900;

  // Runs once per corner of a rectangle that covers the whole canvas.
  const VERTEX_SHADER = `
    attribute vec2 p;
    void main() { gl_Position = vec4(p, 0.0, 1.0); }
  `;

  // Runs once per pixel and decides its color.
  const fragmentShaderSource = (precision) => `
    precision ${precision} float;
    uniform vec2 uRes;
    uniform float uTime;
    uniform vec2 uMouse;
    uniform float uWobble;

    mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
    mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }

    // Signed distance to the blob: a sphere pushed in and out by sine waves.
    float sdf(vec3 p) {
      p = rotY(uTime * 0.15 + uMouse.x * 0.8) * rotX(uMouse.y * 0.6) * p;
      float t = uTime * 0.7;
      float d = length(p) - 1.0;
      d += uWobble * sin(2.6 * p.x + t) * sin(2.9 * p.y + t * 1.3) * sin(2.4 * p.z + t * 0.8);
      d += uWobble * 0.35 * sin(6.0 * p.y + t * 1.7) * sin(5.0 * p.x - t);
      return d * 0.6;
    }

    vec3 nrm(vec3 p) {
      vec2 e = vec2(0.0015, 0.0);
      return normalize(vec3(
        sdf(p + e.xyy) - sdf(p - e.xyy),
        sdf(p + e.yxy) - sdf(p - e.yxy),
        sdf(p + e.yyx) - sdf(p - e.yyx)
      ));
    }

    void main() {
      vec2 uv = (gl_FragCoord.xy * 2.0 - uRes) / min(uRes.x, uRes.y);
      vec3 ro = vec3(0.0, 0.0, 3.4);
      vec3 rd = normalize(vec3(uv, -1.7));

      float t = 0.0;
      bool hit = false;
      for (int i = 0; i < 64; i++) {
        float d = sdf(ro + rd * t);
        if (d < 0.001) { hit = true; break; }
        t += d;
        if (t > 7.0) break;
      }
      if (!hit) { gl_FragColor = vec4(0.0); return; }

      vec3 pos = ro + rd * t;
      vec3 n = nrm(pos);
      vec3 l = normalize(vec3(0.6, 0.8, 0.7));
      float diff = max(dot(n, l), 0.0);
      float spec = pow(max(dot(reflect(-l, n), -rd), 0.0), 48.0);
      float fres = pow(1.0 - max(dot(n, -rd), 0.0), 2.5);
      vec3 r = reflect(rd, n);
      float env = smoothstep(-0.15, 0.35, r.y) * 0.75 + 0.25 * smoothstep(0.6, 0.95, sin(r.x * 4.0 + r.y * 3.0));
      float c = 0.04 + 0.18 * diff + 0.55 * env + 0.9 * spec + 0.35 * fres;
      gl_FragColor = vec4(vec3(clamp(c, 0.0, 1.0)), 1.0);
    }
  `;

  // Hide the canvas and let CSS draw the morphing fallback blob instead.
  const showFallback = () => {
    if (hero) hero.classList.add('no-webgl');
  };

  if (isTouchOrSmall) {
    showFallback();
    return;
  }

  const gl = canvas.getContext('webgl', {
    antialias: false,
    powerPreference: 'low-power',
    premultipliedAlpha: true
  });

  if (!gl) {
    console.warn('Hero blob: WebGL is not available, showing the CSS fallback.');
    showFallback();
    return;
  }

  const compile = (type, source, label) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(`Hero blob: ${label} shader failed to compile.\n${gl.getShaderInfoLog(shader)}`);
      gl.deleteShader(shader);
      return null;
    }

    return shader;
  };

  const vertexShader = compile(gl.VERTEX_SHADER, VERTEX_SHADER, 'vertex');
  // Some GPUs only have medium precision in fragment shaders.
  const highp = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
  const precision = highp && highp.precision > 0 ? 'highp' : 'mediump';
  const fragmentShader = compile(gl.FRAGMENT_SHADER, fragmentShaderSource(precision), 'fragment');

  if (!vertexShader || !fragmentShader) {
    showFallback();
    return;
  }

  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(`Hero blob: shader program failed to link.\n${gl.getProgramInfoLog(program)}`);
    showFallback();
    return;
  }

  gl.useProgram(program);

  // Two triangles that cover the whole canvas (a "full-screen quad").
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

  const positionLocation = gl.getAttribLocation(program, 'p');
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

  const uniforms = {
    res: gl.getUniformLocation(program, 'uRes'),
    time: gl.getUniformLocation(program, 'uTime'),
    mouse: gl.getUniformLocation(program, 'uMouse'),
    wobble: gl.getUniformLocation(program, 'uWobble')
  };

  const mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
  let elapsed = 0;
  let lastFrameTime = 0;
  let rafId = 0;
  let heroInView = true;
  let dead = false;
  let guardFrames = 0;
  let guardTotal = 0;

  // Size the drawing buffer from the canvas's CSS size, a bit under full
  // resolution; the blob is soft and shiny, so the difference is hard to see.
  const resize = () => {
    const pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO) * RENDER_SCALE;
    const width = Math.round(canvas.clientWidth * pixelRatio);
    const height = Math.round(canvas.clientHeight * pixelRatio);

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    }
  };

  const draw = () => {
    if (dead) return;
    resize();

    mouse.x += (mouse.targetX - mouse.x) * MOUSE_EASE;
    mouse.y += (mouse.targetY - mouse.y) * MOUSE_EASE;

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(uniforms.res, canvas.width, canvas.height);
    gl.uniform1f(uniforms.time, elapsed / 1000);
    gl.uniform2f(uniforms.mouse, mouse.x, mouse.y);
    gl.uniform1f(uniforms.wobble, WOBBLE);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  const stop = () => {
    window.cancelAnimationFrame(rafId);
    rafId = 0;
  };

  // Give up on WebGL for good and switch to the CSS blob.
  const bail = (reason) => {
    if (dead) return;
    dead = true;
    stop();
    console.warn(`Hero blob: ${reason}, showing the CSS fallback.`);
    showFallback();
  };

  // The GPU can drop the context (driver reset, memory pressure). Calling
  // preventDefault is the spec's way to stop the browser from tearing it down
  // silently; the blob doesn't try to come back, it just stays on the CSS one.
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    bail('the WebGL context was lost');
  });

  if (reduceMotion) {
    draw();
    window.addEventListener('resize', draw);
    return;
  }

  const frame = (now) => {
    const frameTime = now - lastFrameTime;
    // Only count time while running, so the blob doesn't jump after a pause.
    elapsed += frameTime;
    lastFrameTime = now;

    // Too slow for this computer: check the average of the first 60 frames.
    if (guardFrames < GUARD_FRAMES) {
      guardFrames += 1;
      guardTotal += frameTime;
      if (guardFrames === GUARD_FRAMES && guardTotal / GUARD_FRAMES > GUARD_MAX_AVG_MS) {
        bail(`frames averaged ${Math.round(guardTotal / GUARD_FRAMES)}ms`);
        return;
      }
    }

    draw();
    rafId = window.requestAnimationFrame(frame);
  };

  const start = () => {
    if (rafId || dead) return;
    lastFrameTime = performance.now();
    rafId = window.requestAnimationFrame(frame);
  };

  const updateRunning = () => {
    if (!document.hidden && heroInView) {
      start();
    } else {
      stop();
    }
  };

  window.addEventListener('mousemove', (event) => {
    mouse.targetX = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.targetY = (event.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  // While paused, still redraw once so a resize doesn't leave a stretched frame.
  window.addEventListener('resize', () => {
    if (!rafId) draw();
  });

  document.addEventListener('visibilitychange', updateRunning);

  if (hero && 'IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      heroInView = entries[0].isIntersecting;
      updateRunning();
    }).observe(hero);
  }

  updateRunning();
})();
