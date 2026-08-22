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

  /* Build the skeleton once.

     A divi-divi is not a symmetric tree with a lean. Measured off the logo
     artwork, it is 1.38 times wider than tall, the trunk sits toward one
     side, and the canopy mass runs 34/48/18 across the width — dense behind
     the trunk, streaming downwind, thinning to nothing. Almost no growth
     survives on the windward face.

     So this is not a recursive fractal. It is a curving trunk plus a set of
     near-horizontal limbs that all leave in the same direction, each carrying
     flat canopy strata. Recursive branching gives a savanna acacia; this
     gives the tree that actually grows here.

     Stiffness still falls off outward, so wind moves the canopy far more
     than the trunk. */
  function buildTree() {
    const rnd = mulberry32(20260822);
    const segs = [];

    // Sized from width first — the tree is wider than tall.
    const treeW = Math.min(W * 0.285, H * 0.44);
    const treeH = treeW / 1.38;
    const baseX = W * 0.545;          // trunk stands left of the tree's mass
    const baseY = H * 0.94;
    const DOWNWIND = 1;              // canopy streams to the right

    function add(parent, angle, len, width, opts) {
      const idx = segs.length;
      segs.push({
        x: parent < 0 ? baseX : 0,
        y: parent < 0 ? baseY : 0,
        angle, len, width, parent,
        stiff: (opts && opts.stiff) || 0.1,
        canopy: !!(opts && opts.canopy),
        spanX: (opts && opts.spanX) || 1,
        depth: parent < 0 ? 0 : segs[parent].depth + 1,
      });
      return idx;
    }

    // Angles stored here are ABSOLUTE rest angles. draw() derives each
    // segment's bend from (own angle - parent angle), so storing deltas makes
    // the whole tree collapse — which it did, once.

    // ---- trunk: a curve, not a pole. Leans harder the higher it goes. ----
    const TRUNK = 5;
    let prev = -1;
    for (let i = 0; i < TRUNK; i++) {
      const t = i / (TRUNK - 1);
      // -82° at the base easing to -44°: pushed over from the ground up.
      const ang = (-82 + t * 38) * Math.PI / 180;
      prev = add(prev, ang,
                 (treeH / TRUNK) * (1.22 - t * 0.26),
                 Math.max(4, treeW * 0.075 * (1 - t * 0.48)),
                 { stiff: 0.03 + t * 0.055 });
    }
    const crown = prev;
    const crownAng = segs[crown].angle;

    // ---- limbs: every one leaves downwind, near horizontal ---------------
    const LIMBS = 11;
    for (let i = 0; i < LIMBS; i++) {
      const t = i / (LIMBS - 1);
      // -34° to +6°: above horizontal at the top of the crown, drooping at
      // the trailing edge. This spread is what makes the flag shape.
      const ang = (-34 + t * 40) * Math.PI / 180;
      // Hang the lowest limbs off the trunk a segment or two down, so the
      // crown is not a single fan from one point.
      const from = t > 0.7 ? Math.max(1, crown - 1) : crown;
      const limbLen = treeW * (0.26 + (1 - Math.abs(t - 0.35)) * 0.17);

      let node = add(from, ang, limbLen * 0.5,
                     Math.max(2.5, treeW * 0.028 * (1 - t * 0.35)),
                     { stiff: 0.13 });
      let abs = ang;

      // Each limb carries two or three canopy strata further downwind.
      const strata = 3 + (rnd() < 0.55 ? 1 : 0);
      for (let sI = 0; sI < strata; sI++) {
        abs += (rnd() - 0.5) * 0.14 + 0.05 * DOWNWIND;
        node = add(node, abs,
                   limbLen * (0.32 - sI * 0.045),
                   Math.max(1.5, treeW * 0.011),
                   {
                     stiff: 0.19 + sI * 0.085,
                     canopy: true,
                     // Wide and flat: the canopy is combed out, not clustered.
                     spanX: 1.35 + rnd() * 0.75,
                   });
      }
    }

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

    // Canopy as combed-out horizontal strata. The divi-divi's crown is not a
    // cluster of blobs — it is layered sheets pressed flat and drawn downwind,
    // widest behind the trunk and thinning to nothing at the tip. spanX
    // stretches each stratum along the wind; the vertical radius stays small.
    ctx.fillStyle = TREE;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      if (!p.seg.canopy) continue;
      const rx = p.seg.len * p.seg.spanX;
      const ry = Math.max(3, p.seg.len * 0.16);
      // Centre the sheet downwind of the node rather than on it, so mass
      // accumulates on the lee side the way it does on the real tree.
      const cx = (p.x1 + p.x2) / 2 + rx * 0.28;
      const cy = (p.y1 + p.y2) / 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, p.angle * 0.10 + 0.03, 0, Math.PI * 2);
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
