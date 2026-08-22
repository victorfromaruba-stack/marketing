/* =========================================================================
   A divi-divi in the trade wind.
   =========================================================================

   The tree in the logo is bent because Aruba's wind never stops. This draws
   that tree procedurally and puts it back in the wind it grew in: a constant
   easterly, gusts on a low-frequency noise, and the pointer as a local
   disturbance.

   It is on the page for a reason beyond decoration. The studio sells AR and
   WebXR — a static site claiming real-time 3D capability asks a client to take
   that on faith. This does not.

   Canvas 2D rather than WebGL: a silhouette needs no depth buffer, and 2D
   starts instantly on a mid-range phone, which is what most visitors hold.
   ========================================================================= */

(function () {
  "use strict";

  const canvas = document.getElementById("wind");
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext("2d", { alpha: true });

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---- palette (kept in step with tokens.css) --------------------------
  // A silhouette needs something to be silhouetted against. The sky is drawn
  // here rather than in CSS so the glow sits behind the tree, not over it.
  const TREE = "#04131C";      // darker than the page, so it reads as shape
  const SKY_TOP = "#071A26";
  const SKY_LOW = "#123044";
  const SUN = "#FABA5E";

  let W = 0, H = 0, dpr = 1;
  let seedTree = null;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    seedTree = buildTree();
  }

  // ---- deterministic randomness ----------------------------------------
  // A fixed seed means the tree is the same silhouette on every load. A tree
  // that reshuffles on refresh reads as a toy; this one reads as a mark.
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* Build the skeleton once. Each segment stores its rest angle and a
     stiffness that falls off toward the tips, so wind moves the canopy far
     more than the trunk — which is what makes it read as a real tree rather
     than a rotating graphic. */
  function buildTree() {
    const rnd = mulberry32(20260822);
    const segs = [];
    const baseLen = Math.min(H * 0.215, W * 0.105);

    function grow(x, y, angle, len, depth, width, parent) {
      if (depth > 6 || len < 7) return;
      const idx = segs.length;
      segs.push({
        x, y, angle, len, width,
        depth, parent,
        // Rigid at the base, whippy at the tips.
        stiff: 0.05 + (6 - depth) * 0.10,
        canopy: depth >= 4,
      });

      const branches = depth < 2 ? 3 : 2;
      for (let i = 0; i < branches; i++) {
        // Persistent easterly bias baked into the growth itself — the tree
        // is permanently bent, wind or no wind.
        const lean = -0.30 - depth * 0.035;
        const spread = (i - (branches - 1) / 2) * (0.46 - depth * 0.03);
        const jitter = (rnd() - 0.5) * 0.30;
        grow(0, 0, angle + spread + lean * 0.42 + jitter,
             len * (0.70 + rnd() * 0.14), depth + 1,
             width * 0.66, idx);
      }
    }

    grow(W * 0.735, H * 0.96, -Math.PI / 2 + 0.10, baseLen, 0,
         Math.max(8, baseLen * 0.10), -1);
    return segs;
  }

  // ---- wind -------------------------------------------------------------
  const pointer = { x: -9999, y: -9999, active: false };
  let gust = 0;

  function windAt(t, y) {
    // Constant trade wind, plus two out-of-phase gust waves so it never
    // settles into a visible loop. Higher parts of the tree catch more.
    const height = 1 - y / H;
    const base = 0.30;
    const g = Math.sin(t * 0.00042) * 0.20 + Math.sin(t * 0.00097 + 1.3) * 0.11;
    return (base + g + gust) * (0.35 + height * 0.9);
  }

  function draw(t) {
    ctx.clearRect(0, 0, W, H);
    if (!seedTree) return;

    // Dusk: cool overhead, warmer toward the horizon, with one low sun.
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, SKY_TOP);
    sky.addColorStop(0.62, SKY_TOP);
    sky.addColorStop(1, SKY_LOW);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    const sun = ctx.createRadialGradient(W * 0.80, H * 0.74, 0, W * 0.80, H * 0.74, Math.min(W, H) * 0.70);
    sun.addColorStop(0, "rgba(250,186,94,0.26)");
    sun.addColorStop(0.45, "rgba(250,186,94,0.07)");
    sun.addColorStop(1, "rgba(250,186,94,0)");
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, W, H);

    // Resolve each segment from its parent so bend accumulates outward.
    const pts = new Array(seedTree.length);
    for (let i = 0; i < seedTree.length; i++) {
      const s = seedTree[i];
      const p = s.parent >= 0 ? pts[s.parent] : null;
      const ox = p ? p.x2 : s.x;
      const oy = p ? p.y2 : s.y;

      let a = (p ? p.angle : s.angle) + (s.parent >= 0 ? s.angle - seedTree[s.parent].angle : 0);
      if (s.parent >= 0) a = p.angle + (s.angle - seedTree[s.parent].angle);

      const w = windAt(t, oy) * s.stiff;

      // Pointer as a local gust: strongest near the cursor, falling off fast.
      let local = 0;
      if (pointer.active) {
        const dx = ox - pointer.x, dy = oy - pointer.y;
        const d2 = dx * dx + dy * dy;
        local = Math.exp(-d2 / 34000) * 0.85 * (dx > 0 ? 1 : -1) * -1;
      }

      const bend = w + local * s.stiff * 2.4;
      const ang = a + bend;
      const x2 = ox + Math.cos(ang) * s.len;
      const y2 = oy + Math.sin(ang) * s.len;
      pts[i] = { x1: ox, y1: oy, x2, y2, angle: ang, seg: s };
    }

    // Branches first, tapered.
    ctx.lineCap = "round";
    ctx.strokeStyle = TREE;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      if (p.seg.canopy) continue;
      ctx.beginPath();
      ctx.lineWidth = p.seg.width;
      ctx.moveTo(p.x1, p.y1);
      ctx.lineTo(p.x2, p.y2);
      ctx.stroke();
    }

    // Canopy as flat stacked lozenges — the logo's language, not a fluffy
    // blob. The divi-divi's canopy is pressed flat by the same wind.
    ctx.fillStyle = TREE;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      if (!p.seg.canopy) continue;
      const r = p.seg.len * 0.70;
      ctx.beginPath();
      ctx.ellipse(p.x2, p.y2, r, r * 0.22, p.angle * 0.16 + 0.05, 0, Math.PI * 2);
      ctx.fill();
    }


  }

  // ---- loop --------------------------------------------------------------
  let raf = null, running = false;

  function frame(t) {
    gust *= 0.94;                 // pointer gusts decay
    draw(t);
    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (running) return;
    running = true;
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
  }

  // Stop drawing when the hero is off screen. A canvas painting behind three
  // scrolled sections is battery someone else is paying for.
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { e.isIntersecting ? start() : stop(); });
    }, { threshold: 0.02 }).observe(canvas);
  } else {
    start();
  }

  window.addEventListener("resize", resize, { passive: true });

  canvas.addEventListener("pointermove", function (e) {
    const r = canvas.getBoundingClientRect();
    pointer.x = e.clientX - r.left;
    pointer.y = e.clientY - r.top;
    pointer.active = true;
    gust = Math.min(gust + 0.006, 0.16);
  }, { passive: true });

  canvas.addEventListener("pointerleave", function () { pointer.active = false; }, { passive: true });

  resize();

  if (reduced) {
    // Honour the setting: draw one still frame, mid-gust, and stop.
    draw(2400);
  } else {
    start();
  }
})();
