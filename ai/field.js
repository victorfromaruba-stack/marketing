/* AI Courses Aruba, /ai: the hero field. Direction: agency/demos/ai-courses-DIRECTION.md.
   A pattern that learns. Step keys on a grid of printed step LEDs; the chase light walks the bar one step at
   a time (it jumps like a clock, it never slides); a key it reaches is nudged toward its step. Four passes for the four
   evenings of Level 1, then the pattern simply plays. Everything moving is a transform of a key or one LED switching.
   Our own WebGL1, no library, nothing ported (built 5 Nov 2026 for the parked demo, moved here 6 Nov).
   No WebGL: the learned pattern as a still SVG in the same place. Reduced motion: the learned pattern, drawn once. */
(() => {
  'use strict';
  const hero = document.getElementById('hero');
  let canvas = document.getElementById('field');
  const reduceMq = matchMedia('(prefers-reduced-motion: reduce)');
  const darkMq = matchMedia('(prefers-color-scheme: dark)');
  const FRAMES = /[?&]frames\b/.test(location.search); // the recording harness drives the clock itself

  // Time, in ms. While the pattern is learned a bar takes about two seconds (a sixteenth near 115 bpm on a phone);
  // once it is learned the bar slows to 3.2 s and the page goes quiet.
  const BAR_LEARN = 2100, BAR_PLAY = 3200, START = 700, PASSES = 4;
  const SNAP = 170, DOWN = 90, UP = 150, BORN = 160, DIE = 180, LIGHT = 140;
  // How much of the first attempt is left after each pass. Quick learners land in two passes, most take three or four.
  const CURVES = [[0.3, 0], [0.42, 0.12, 0], [0.45, 0.17, 0.05, 0]];
  // One drum voice per row, as Euclidean rhythms on 16 steps: [hits, rotation]. A kick on the four downbeats, hats on
  // the offbeats, a snare on two and four, then a busier variation, the way a beat is written on an 808.
  const VOICES = [[4, 0], [4, 2], [2, 4], [5, 0], [8, 1], [3, 0], [4, 0], [4, 2], [2, 4], [7, 0], [6, 3], [3, 2]];
  const FOG = 1;                           // how far keys fade behind the words

  let vt = 0;
  const now = FRAMES ? () => vt : () => performance.now();
  let seed = 0;
  const rnd = () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const nrm = () => (rnd() + rnd() + rnd() - 1.5) * 1.2;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const easeOut = u => 1 - Math.pow(1 - clamp(u, 0, 1), 4);
  const easeIn = u => { u = clamp(u, 0, 1); return u * u * u; };
  const smooth = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };

  let W = 0, H = 0, dpr = 1, cols = 16, rows = 0, cw = 0, ch = 0, oy = 0, kw = 0, kh = 0, soft = 0, pad = 0;
  let keys = [], occupied = [], maxKeys = 0;
  const fog = new Float32Array(48); let fogN = 0;
  let stepIdx = -1, nextAt = 0, stepDur = 130, chase = -1;
  let gl = null, ext = null, P = null, quad = null, inst = null, data = null, colors = null, swGL = false;
  let running = false, raf = 0, timer = 0, inView = true, reduced = reduceMq.matches, scrolls = false;

  // A key is unlit (the Pattern "step not open yet") until it lands in its step; then it takes its bank colour.
  const mk = (c, r) => ({ col: c, row: r, bank: ((c / 4) | 0) % 4, ox: 0, oy: 0, or: 0, os: 0, m: 0, mFrom: 0, learnAt: -1e9,
    curve: [0], li: 1, lastPass: -1, hidden: false, appearPass: 0, bornAt: -1e9, stray: false, removePass: 0, dieAt: 0, hitAt: -1e9, litAt: -1e9 });

  // The pattern, and the first attempt at it. Seeded, so every visit hears the same first attempt.
  function build(settled) {
    seed = 0x2E1F7A3;
    keys = []; occupied = new Array(cols * rows).fill(null);
    for (let r = 0; r < rows; r++) {
      const [k, rot] = VOICES[r % VOICES.length];
      for (let c = 0; c < cols; c++) {
        if (((((c % 16) - rot) % 16 + 16) % 16 * k) % 16 >= k) continue;
        const key = mk(c, r);
        key.ox = clamp(nrm() * 0.9, -1.7, 1.7);   // late or early, in steps
        key.oy = clamp(nrm() * 0.32, -0.7, 0.7);   // drifting onto the next row
        key.or = clamp(nrm() * 0.2, -0.38, 0.38);  // a little crooked
        key.os = clamp(nrm() * 0.1, -0.18, 0.14);  // too soft or too hard
        const q = rnd();                           // some notes are learned faster than others
        key.curve = q < 0.2 ? CURVES[0] : q < 0.6 ? CURVES[1] : CURVES[2];
        key.li = 0; key.m = 1; key.litAt = Infinity;
        if (rnd() < 0.14) { key.hidden = true; key.appearPass = rnd() < 0.6 ? 1 : 2; key.curve = [0.16, 0]; key.m = 0.55; }
        if (settled) { key.hidden = false; key.m = 0; key.li = key.curve.length; key.litAt = -1e9; }
        keys.push(key); occupied[r * cols + c] = key;
      }
    }
    if (!settled) { // wrong notes: played, then dropped on the first or second pass
      const n = Math.round(keys.length * 0.12);
      for (let i = 0; i < n; i++) {
        const c = (rnd() * cols) | 0, r = (rnd() * rows) | 0;
        if (occupied[r * cols + c]) continue;
        const key = mk(c, r);
        key.stray = true; key.removePass = rnd() < 0.6 ? 0 : 1; key.m = 1; key.litAt = Infinity;
        key.ox = clamp(nrm() * 0.8, -1.5, 1.5); key.oy = clamp(nrm() * 0.32, -0.7, 0.7);
        key.or = clamp(nrm() * 0.24, -0.42, 0.42); key.os = clamp(nrm() * 0.1, -0.18, 0.14);
        keys.push(key);
      }
    }
    maxKeys = Math.floor(cols * rows * 0.55);
    if (!data || data.length < (keys.length + maxKeys) * 10) data = new Float32Array((keys.length + maxKeys) * 10);
  }

  function mess(k, t) { const u = (t - k.learnAt) / SNAP; return u >= 1 ? k.m : k.mFrom + (k.m - k.mFrom) * easeOut(u); }
  const columnOf = x => clamp(Math.round(x / cw - 0.5), 0, cols - 1);

  // One tick of the chase light. The key is reached where it is now, then nudged toward where it belongs.
  function step(ts) {
    stepIdx++;
    chase = stepIdx % cols;
    const pass = Math.floor(stepIdx / cols);
    for (const k of keys) {
      if (k.dieAt) continue;
      if (k.hidden) {
        if (k.col === chase && pass >= k.appearPass) { k.hidden = false; k.bornAt = ts; k.lastPass = pass; }
        continue;
      }
      if (columnOf((k.col + 0.5 + k.ox * k.m) * cw) !== chase) continue;
      if (k.stray) { if (pass >= k.removePass) k.dieAt = ts; continue; }
      if (k.li < k.curve.length && k.lastPass < pass) {
        k.mFrom = mess(k, ts); k.m = k.curve[k.li++]; k.learnAt = ts; k.lastPass = pass; k.hitAt = ts;
        if (k.m === 0) k.litAt = ts + SNAP * 0.6; // it lands in its step and takes its colour
      }
    }
    if (stepIdx + 1 === cols * PASSES) stepDur = BAR_PLAY / cols; // learned: from here on it just runs
  }

  function tick(t) {
    if (t - nextAt > 1500) nextAt = t;          // back from a hidden tab: carry on, do not replay the missed bars
    while (t >= nextAt) { step(nextAt); nextAt += stepDur; }
  }

  function fogAt(x, y) {
    let f = 0;
    for (let i = 0; i < fogN; i++) {
      const o = i * 4, dx = Math.max(fog[o] - x, 0, x - fog[o] - fog[o + 2]), dy = Math.max(fog[o + 1] - y, 0, y - fog[o + 1] - fog[o + 3]);
      f = Math.max(f, 1 - smooth(0, soft, Math.hypot(dx, dy)));
    }
    return f;
  }

  // Fill the instance buffer for this moment; returns whether anything is still moving.
  function pose(t) {
    let busy = false, n = 0;
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (k.hidden) continue;
      if (k.dieAt && t - k.dieAt >= DIE) { if (occupied[k.row * cols + k.col] === k) occupied[k.row * cols + k.col] = null; keys.splice(i--, 1); continue; }
      const m = mess(k, t);
      if (t - k.learnAt < SNAP) busy = true;
      const x = (k.col + 0.5 + k.ox * m) * cw;
      let y = oy + (k.row + 0.5 + k.oy * m) * ch, sc = 1 + k.os * m, a = 1, press = 0;
      const b = t - k.bornAt;
      if (b < BORN) { const u = easeOut(b / BORN); sc *= 0.6 + 0.4 * u; a *= u; busy = true; }
      if (k.dieAt) { const u = easeIn((t - k.dieAt) / DIE); sc *= 1 + 0.18 * u; a *= 1 - u; press = -u; busy = true; }
      const h = t - k.hitAt;
      if (h < DOWN + UP && !k.dieAt) { press = h < DOWN ? easeOut(h / DOWN) : 1 - easeOut((h - DOWN) / UP); busy = true; }
      a *= 1 - FOG * smooth(0.25, 0.75, fogAt(x, y)); // a key is behind the words or it is not: no ghosts at the edge
      if (a < 0.02) continue;
      if (press > 0) { y += 0.8 * press; sc *= 1 - 0.06 * press; }
      const L = t - k.litAt, lit = L >= LIGHT ? 1 : L <= 0 ? 0 : easeOut(L / LIGHT);
      if (L > -SNAP && L < LIGHT) busy = true;
      const c = colors.keys[k.bank], z = colors.off, o = n * 10;
      data[o] = x; data[o + 1] = y; data[o + 2] = k.or * m; data[o + 3] = sc;
      data[o + 4] = z[0] + (c[0] - z[0]) * lit; data[o + 5] = z[1] + (c[1] - z[1]) * lit; data[o + 6] = z[2] + (c[2] - z[2]) * lit; data[o + 7] = a;
      data[o + 8] = !reduced && columnOf(x) === chase ? 1 : 0; data[o + 9] = press;
      n++;
    }
    return [n, busy];
  }

  /* ---------- WebGL ---------- */
  const BOX = 'float box(vec2 p,vec2 b,float r){vec2 q=abs(p)-b+r;return length(max(q,0.))+min(max(q.x,q.y),0.)-r;}';
  const VS_KEY = `attribute vec2 aQ;attribute vec4 aA;attribute vec4 aB;attribute vec2 aC;
uniform vec2 uRes;uniform vec2 uHalf;uniform float uPad;
varying vec2 vP;varying vec2 vH;varying vec4 vCol;varying vec2 vC;varying vec2 vRot;
void main(){vec2 h=uHalf*aA.w;vec2 rel=aQ*(length(h)+uPad);vP=rel;vH=h;vCol=aB;vC=aC;vRot=vec2(cos(aA.z),sin(aA.z));
vec2 p=aA.xy+rel;gl_Position=vec4(p.x/uRes.x*2.-1.,1.-p.y/uRes.y*2.,0.,1.);}`;
  const FS_HEAD = (hp) => `precision ${hp ? 'highp' : 'mediump'} float;${BOX}
varying vec2 vP;varying vec2 vH;varying vec4 vCol;varying vec2 vC;varying vec2 vRot;
vec2 own(vec2 q){return vec2(vRot.x*q.x+vRot.y*q.y,-vRot.y*q.x+vRot.x*q.y);}
float rad(){return min(min(vH.x,vH.y)*.26,4.5);}`;
  // The key: a cap lit from above (lighter top edge, darker lower lip) with its step LED low on the face.
  const FS_KEY = `uniform float uAA;uniform float uHi;uniform float uLo;uniform vec3 uLed;uniform vec3 uLedHot;
void main(){vec2 lp=own(vP);float d=box(lp,vH,rad());float cov=clamp(.5-d/uAA,0.,1.);if(cov<=0.)discard;
float ny=lp.y/vH.y;vec3 c=vCol.rgb*(1.04-.1*(ny*.5+.5));float e=-d;
c=mix(c,vec3(1.),uHi*(1.-smoothstep(.35,1.35,e))*smoothstep(.15,-.55,ny));
c=mix(c,vec3(0.),uLo*(1.-smoothstep(.8,2.4,e))*smoothstep(-.1,.65,ny));
vec2 lc=lp+vec2(0.,vH.y*.58);vec2 lh=vec2(vH.x*.36,max(.85,vH.y*.075));float ld=box(lc,lh,lh.y);float lcov=clamp(.5-ld/uAA,0.,1.);
vec3 on=mix(uLed,uLedHot,(1.-smoothstep(0.,lh.y*1.6,abs(lc.y)))*(1.-smoothstep(lh.x*.2,lh.x,abs(lc.x)))*.55);
c=mix(c,mix(c*.6,on,vC.x),lcov);float a=cov*vCol.a;gl_FragColor=vec4(c*a,a);}`;
  // Its shadow: a soft one that shortens when the key is pressed and grows when it lifts off, plus a tight contact line.
  const FS_SHADOW = `uniform vec3 uShade;uniform float uShA;uniform vec2 uSh;
void main(){float pr=max(vC.y,0.);float lf=max(-vC.y,0.);float r=rad();
vec2 lp=own(vP-vec2(0.,uSh.x*(1.-.55*pr+1.2*lf)));float bl=uSh.y*(1.-.35*pr+lf);
float amb=1.-smoothstep(-bl,bl,box(lp,vH-vec2(uSh.y*.35),r));
float con=(1.-smoothstep(-.9,.9,box(own(vP-vec2(0.,1.)),vH,r)))*(1.-lf);
float a=max(amb*uShA*(1.-.3*lf),con*uShA*.75)*vCol.a;gl_FragColor=vec4(uShade*a,a);}`;
  const VS_FULL = 'attribute vec2 aQ;void main(){gl_Position=vec4(aQ,0.,1.);}';
  // The printed step LEDs, one per step and row; the column under the chase light is lit.
  const FS_SLOT = (hp) => `precision ${hp ? 'highp' : 'mediump'} float;${BOX}
uniform vec2 uRes;uniform float uDpr;uniform float uAA;uniform vec2 uCell;uniform float uOy;uniform vec2 uDash;uniform float uDashY;
uniform float uChase;uniform vec3 uSlot;uniform float uSlotA;uniform vec3 uLed;uniform vec4 uFog[12];uniform int uFogN;uniform float uSoft;uniform float uFogK;
float fogAt(vec2 p){float f=0.;for(int i=0;i<12;i++){if(i>=uFogN)break;vec4 r=uFog[i];vec2 d=max(max(r.xy-p,p-r.xy-r.zw),0.);f=max(f,1.-smoothstep(0.,uSoft,length(d)));}return f;}
void main(){vec2 p=vec2(gl_FragCoord.x,uRes.y*uDpr-gl_FragCoord.y)/uDpr;vec2 g=vec2(p.x/uCell.x,(p.y-uOy)/uCell.y);vec2 cell=floor(g);
vec2 lp=(g-cell-.5)*uCell-vec2(0.,uDashY);float cov=clamp(.5-box(lp,uDash,uDash.y)/uAA,0.,1.);if(cov<=0.)discard;
float on=1.-step(.5,abs(cell.x-uChase));float a=mix(uSlotA,1.,on)*cov*(1.-uFogK*smoothstep(.25,.75,fogAt(p)));gl_FragColor=vec4(mix(uSlot,uLed,on)*a,a);}`;

  // Shaders compile in the GPU process. Asking at once how it went (COMPILE_STATUS, LINK_STATUS, the uniform list) makes
  // the page wait for the compile; with KHR_parallel_shader_compile the field asks "done yet?" once a frame and begins
  // when the answer is yes. 6 Nov: in software GL (what Lighthouse and PageSpeed Insights measure with) that wait was
  // about 1.2 s of blocked page on load. Without the extension it waits as it always did.
  function link(vs, fs) {
    const p = gl.createProgram();
    for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); gl.attachShader(p, s);
    }
    ['aQ', 'aA', 'aB', 'aC'].forEach((n, i) => gl.bindAttribLocation(p, i, n));
    gl.linkProgram(p);
    return p;
  }
  function program(p) {
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || 'link failed');
    const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const name = gl.getActiveUniform(p, i).name.replace('[0]', ''); u[name] = gl.getUniformLocation(p, name); }
    return { p, u };
  }

  // false: no usable WebGL here (the caller draws the still). true: the shaders are on their way; ready() runs once they exist.
  function initGL(ready) {
    gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
    if (!gl) return false;
    ext = gl.getExtension('ANGLE_instanced_arrays');
    if (!ext) return false;
    const par = gl.getExtension('KHR_parallel_shader_compile'), dbg = gl.getExtension('WEBGL_debug_renderer_info');
    // ponytail: a renderer with no GPU behind it (SwiftShader, llvmpipe) draws at 1x; it is matched by name, and a
    // software renderer that names itself differently simply draws at full resolution, as before.
    // The ?frames harness drives the clock itself, so a recording made here keeps the whole learning arc at full size.
    swGL = !FRAMES && /swiftshader|llvmpipe|softpipe|software/i.test(dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : '');
    const hf = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
    const hp = !!(hf && hf.precision > 0);
    const L = [link(VS_FULL, FS_SLOT(hp)), link(VS_KEY, FS_HEAD(hp) + FS_SHADOW), link(VS_KEY, FS_HEAD(hp) + FS_KEY)];
    quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    inst = gl.createBuffer();
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    const wait = () => {
      if (par && !L.every(p => gl.getProgramParameter(p, par.COMPLETION_STATUS_KHR))) { requestAnimationFrame(wait); return; }
      try { P = { slot: program(L[0]), shadow: program(L[1]), key: program(L[2]) }; }
      catch (err) { gl = null; still(); return; }   // a driver that cannot build them: the still drawing, same place
      ready();
    };
    requestAnimationFrame(wait);
    return true;
  }

  function readColors() {
    const cs = getComputedStyle(document.documentElement);
    const hex = n => { const s = cs.getPropertyValue(n).trim().replace('#', ''); return [0, 2, 4].map(i => parseInt(s.slice(i, i + 2), 16) / 255); };
    const num = n => parseFloat(cs.getPropertyValue(n));
    colors = { keys: ['--key-a', '--key-b', '--key-c', '--key-d'].map(hex), off: hex('--key-off'), led: hex('--led'), hot: hex('--led-hot'), slot: hex('--slot'),
      slotA: num('--slot-a'), shade: hex('--shade'), shA: num('--shade-a'), hi: num('--key-hi'), lo: num('--key-lo') };
  }

  function render(t) {
    const [n, busy] = pose(t);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    const aa = 1 / dpr;
    // printed LEDs
    let s = P.slot; gl.useProgram(s.p);
    gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    for (let i = 1; i < 4; i++) gl.disableVertexAttribArray(i);
    gl.uniform2f(s.u.uRes, W, H); gl.uniform1f(s.u.uDpr, dpr); gl.uniform1f(s.u.uAA, aa);
    gl.uniform2f(s.u.uCell, cw, ch); gl.uniform1f(s.u.uOy, oy);
    gl.uniform2f(s.u.uDash, kw * 0.18, Math.max(0.85, kh * 0.0375)); gl.uniform1f(s.u.uDashY, -kh * 0.29);
    gl.uniform1f(s.u.uChase, reduced ? -9 : chase);
    gl.uniform3fv(s.u.uSlot, colors.slot); gl.uniform1f(s.u.uSlotA, colors.slotA); gl.uniform3fv(s.u.uLed, colors.led);
    gl.uniform4fv(s.u.uFog, fog.subarray(0, 48)); gl.uniform1i(s.u.uFogN, fogN); gl.uniform1f(s.u.uSoft, soft); gl.uniform1f(s.u.uFogK, FOG);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    // keys: shadows first, then caps
    if (n) {
      gl.bindBuffer(gl.ARRAY_BUFFER, inst); gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, n * 10), gl.DYNAMIC_DRAW);
      const S = 40;
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, S, 0); ext.vertexAttribDivisorANGLE(1, 1);
      gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, S, 16); ext.vertexAttribDivisorANGLE(2, 1);
      gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 2, gl.FLOAT, false, S, 32); ext.vertexAttribDivisorANGLE(3, 1);
      const sh = [Math.max(2.5, kh * 0.16), Math.max(3, kh * 0.2)];
      s = P.shadow; gl.useProgram(s.p);
      gl.uniform2f(s.u.uRes, W, H); gl.uniform2f(s.u.uHalf, kw / 2, kh / 2); gl.uniform1f(s.u.uPad, sh[0] * 2.4 + sh[1] * 2 + 2);
      gl.uniform3fv(s.u.uShade, colors.shade); gl.uniform1f(s.u.uShA, colors.shA); gl.uniform2f(s.u.uSh, sh[0], sh[1]);
      ext.drawArraysInstancedANGLE(gl.TRIANGLE_STRIP, 0, 4, n);
      s = P.key; gl.useProgram(s.p);
      gl.uniform2f(s.u.uRes, W, H); gl.uniform2f(s.u.uHalf, kw / 2, kh / 2); gl.uniform1f(s.u.uPad, 1.5);
      gl.uniform1f(s.u.uAA, aa); gl.uniform1f(s.u.uHi, colors.hi); gl.uniform1f(s.u.uLo, colors.lo);
      gl.uniform3fv(s.u.uLed, colors.led); gl.uniform3fv(s.u.uLedHot, colors.hot);
      ext.drawArraysInstancedANGLE(gl.TRIANGLE_STRIP, 0, 4, n);
      for (let i = 1; i < 4; i++) ext.vertexAttribDivisorANGLE(i, 0);
    }
    if (!canvas.classList.contains('on')) canvas.classList.add('on');
    return busy;
  }

  /* ---------- size, words, theme ---------- */
  // Where the words are. Keys fade out there so every line sits on bare metal.
  function measureWords() {
    const hr = hero.getBoundingClientRect();
    fogN = 0;
    const push = (x, y, w, h) => { if (fogN < 12 && w > 0) { fog.set([x - pad, y - pad, w + 2 * pad, h + 2 * pad], fogN * 4); fogN++; } };
    const rel = r => push(r.left - hr.left, r.top - hr.top, r.width, r.height);
    rel(hero.querySelector('.brand').getBoundingClientRect());
    if (W < 900) { // a phone: the words get the whole lower part; keys peeking round a full-width column read as clutter
      const top = hero.querySelector('h1').getBoundingClientRect().top - hr.top;
      push(-soft - pad, top, W + 2 * (soft + pad), H - top + soft);
    } else for (const el of hero.querySelectorAll('.words [data-fog]')) {
      if (el.dataset.fog === 'lines') { const rg = document.createRange(); rg.selectNodeContents(el); for (const r of rg.getClientRects()) rel(r); }
      else rel(el.getBoundingClientRect());
    }
    scrolls = document.documentElement.scrollHeight > innerHeight + 2;
    hero.classList.toggle('scrolls', scrolls);
  }

  function measure() {
    const r = hero.getBoundingClientRect();
    const w = r.width, h = r.height;
    const nc = w >= 1000 ? 32 : 16;
    const changed = nc !== cols || Math.abs(w - W) > 0.5 || Math.round(h / (w / nc * 1.16)) !== Math.round(H / ch || 0);
    W = w; H = h; cols = nc; cw = W / cols; ch = cw * 1.16; rows = Math.ceil(H / ch) + 1; oy = (H - rows * ch) / 2;
    kw = cw * 0.64; kh = ch * 0.72; soft = cw * 0.55; pad = cw * 0.55;
    stepDur = (stepIdx >= cols * PASSES || reduced ? BAR_PLAY : BAR_LEARN) / cols;
    dpr = Math.min(devicePixelRatio || 1, swGL ? 1 : 2, Math.sqrt(4.2e6 / Math.max(1, W * H)));
    if (canvas.tagName === 'CANVAS') { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); dpr = canvas.width / W; }
    measureWords();
    return changed;
  }

  /* ---------- the loop: 60 fps only while something moves, otherwise one frame per step ---------- */
  function frame() {
    raf = 0; timer = 0;
    const t = now();
    if (!reduced) tick(t);
    const busy = render(t);
    if (!running) return;
    if (busy || drag) raf = requestAnimationFrame(frame);
    else timer = setTimeout(() => { timer = 0; raf = requestAnimationFrame(frame); }, Math.max(0, nextAt - now()));
  }
  function start() {
    if (running || FRAMES || reduced || !inView || document.hidden || !gl) return;
    running = true; frame();
  }
  function stop() { running = false; cancelAnimationFrame(raf); clearTimeout(timer); raf = timer = 0; }
  function wake() {
    if (!gl) return;
    if (FRAMES) return;
    if (reduced) { render(now()); return; }
    if (running && timer) { clearTimeout(timer); timer = 0; raf = requestAnimationFrame(frame); }
  }

  /* ---------- a finger plays a note by hand ---------- */
  let drag = null;
  function cellAt(x, y) { const c = Math.floor(x / cw), r = Math.floor((y - oy) / ch); return c >= 0 && c < cols && r >= 0 && r < rows ? [c, r] : null; }
  function add(x, y, c, r, ang) {
    if (keys.length >= maxKeys + 200) return;
    const k = mk(c, r);
    k.ox = x / cw - 0.5 - c; k.oy = (y - oy) / ch - 0.5 - r;   // exactly where the finger was
    k.or = clamp((ang === null ? 0 : Math.sin(ang * 2) * 0.32) + nrm() * 0.14, -0.5, 0.5);
    k.os = 0.08; k.m = 1; k.curve = [0]; k.li = 0; k.litAt = Infinity;
    if (reduced) { k.m = 0; k.li = 1; k.litAt = -1e9; } else k.bornAt = now();
    keys.push(k); occupied[r * cols + c] = k;
  }
  function down(x, y) {
    if (fogAt(x, y) > 0.5) return;
    const cell = cellAt(x, y); if (!cell) return;
    const [c, r] = cell, k = occupied[r * cols + c];
    if (k && !k.dieAt) { k.dieAt = reduced ? now() - DIE : now(); occupied[r * cols + c] = null; }  // a lit step: off
    else add(x, y, c, r, null);
    drag = { x, y };
    wake();
  }
  function move(x, y) {
    if (!drag) return;
    const dx = x - drag.x, dy = y - drag.y;
    if (Math.hypot(dx, dy) < cw * 0.7) return;
    drag.x = x; drag.y = y;
    if (fogAt(x, y) > 0.5) return;
    const cell = cellAt(x, y);
    if (cell && !occupied[cell[1] * cols + cell[0]]) { add(x, y, cell[0], cell[1], Math.atan2(dy, dx)); wake(); }
  }
  function up() { drag = null; }
  function local(e) { const r = hero.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  // A touch on a page that scrolls is held until it shows what it is: a tap plays (or clears) one note, a sideways stroke
  // draws, and a scroll changes nothing (the browser takes it and sends pointercancel). Without this, every scroll that
  // started on the field dropped a key under the thumb or switched a lit one off (6 Nov, found reading the 5 Nov code).
  let held = null;
  hero.addEventListener('pointerdown', e => {
    if (!P || !gl || e.button > 0 || e.target.closest('a')) return;   // P: the shaders are built (begin has run)
    const [x, y] = local(e);
    if (e.pointerType === 'touch' && scrolls) { held = { id: e.pointerId, x, y }; return; }
    down(x, y);
    if (drag && !scrolls && hero.setPointerCapture) try { hero.setPointerCapture(e.pointerId); } catch (_) {}
  });
  hero.addEventListener('pointermove', e => {
    const [x, y] = local(e);
    if (held && e.pointerId === held.id) {
      const dx = Math.abs(x - held.x), dy = Math.abs(y - held.y);
      if (dx > cw * 0.7 && dx > dy * 1.5) { const h = held; held = null; down(h.x, h.y); move(x, y); }
      return;
    }
    if (drag) move(x, y);
  });
  hero.addEventListener('pointerup', e => { if (held && e.pointerId === held.id) { down(held.x, held.y); held = null; } up(); });
  hero.addEventListener('pointercancel', () => { held = null; up(); });

  /* ---------- no WebGL: the learned pattern as a still drawing in the same place ---------- */
  function still() {
    build(true);
    const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg'), g = document.createElementNS(ns, 'g');
    svg.setAttribute('class', 'still'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const fill = ['--key-a', '--key-b', '--key-c', '--key-d'];
    const rect = (parent, x, y, w, h, rx, style) => {
      const r = document.createElementNS(ns, 'rect');
      r.setAttribute('x', x.toFixed(1)); r.setAttribute('y', y.toFixed(1)); r.setAttribute('width', w.toFixed(1)); r.setAttribute('height', h.toFixed(1));
      r.setAttribute('rx', rx.toFixed(1)); r.setAttribute('style', style); parent.append(r);
    };
    // The printed step LEDs first (the same size and place as the shader's FS_SLOT), then the keys with their own LED.
    const dw = kw * 0.36, sh = 2 * Math.max(0.85, kh * 0.0375), lh = 2 * Math.max(0.85, kh * 0.036);
    const slots = document.createElementNS(ns, 'g');
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x = (c + 0.5) * cw, y = oy + (r + 0.5) * ch;
      if (fogAt(x, y) <= 0.3) rect(slots, x - dw / 2, y - kh * 0.29 - sh / 2, dw, sh, sh / 2, 'fill:var(--slot);opacity:var(--slot-a)');
    }
    for (const k of keys) {
      const x = (k.col + 0.5) * cw, y = oy + (k.row + 0.5) * ch;
      if (fogAt(x, y) > 0.3) continue;
      rect(g, x - kw / 2, y - kh / 2, kw, kh, Math.min(4.5, kw * 0.26), `fill:var(${fill[k.bank]})`);
      rect(g, x - dw / 2, y - kh * 0.29 - lh / 2, dw, lh, lh / 2, 'fill:#000;opacity:.3');
    }
    svg.append(slots, g); canvas.replaceWith(svg); canvas = svg;
  }

  /* ---------- start ---------- */
  measure();
  readColors();
  let ok = false;
  try { ok = initGL(begin); } catch (err) { ok = false; }
  if (!ok) { gl = null; still(); return; }

  function begin() {
    // Software GL (no GPU behind it): the canvas again at 1x, and the pattern starts learned with the chase light
    // stepping at the played tempo, because sixty frames a second of learning is a GPU's job. Phones keep the full arc.
    if (swGL) { stepIdx = cols * PASSES - 1; measure(); }
    build(reduced || swGL);
    nextAt = now() + START;
    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); stop(); });
    canvas.addEventListener('webglcontextrestored', () => { initGL(() => { readColors(); render(now()); start(); }); });
    new ResizeObserver(() => {
      if (measure()) build(reduced || stepIdx >= 0);
      render(now());
    }).observe(hero);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { measureWords(); render(now()); });
    new IntersectionObserver(([e]) => { inView = e.isIntersecting; inView ? start() : stop(); }).observe(hero);
    document.addEventListener('visibilitychange', () => document.hidden ? stop() : start());
    darkMq.addEventListener('change', () => { readColors(); render(now()); });
    reduceMq.addEventListener('change', () => { reduced = reduceMq.matches; stop(); build(true); stepDur = BAR_PLAY / cols; render(now()); start(); });
    render(now());
    start();
    if (FRAMES) window.__ac = {   // the recording and check harness (?frames) drives the clock itself
      at(ms, draw = true) { vt = ms; if (!reduced) tick(vt); if (draw) render(vt); },
      down(x, y, ms) { vt = ms; down(x, y); }, move(x, y, ms) { vt = ms; move(x, y); }, up() { up(); },
      info: () => ({ cols, rows, keys: keys.length, alive: keys.filter(k => !k.dieAt && !k.hidden).length, chase, stepIdx, dpr, W, H, fogN, swGL })
    };
  }
})();
