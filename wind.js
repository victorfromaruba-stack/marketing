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
  const TREE = "#010810";      // near-black: a silhouette needs to read as one
  const SKY_TOP = "#071A26";
  const SKY_LOW = "#123044";
  const SUN = "#FABA5E";

  let W = 0, H = 0, dpr = 1;
  let seedTree = null;

  /* The sky is painted once, not sixty times a second.

     It was two full-screen gradient fills per frame — a linear for the dusk
     and a radial for the sun — and neither of them ever changes. On a phone
     viewport under 4x CPU throttling that alone was most of the frame budget.
     Rendered once into an offscreen canvas at resize, the per-frame cost
     becomes a single blit. */
  let bg = null;

  function paintSky() {
    bg = document.createElement("canvas");
    bg.width = Math.floor(W * dpr);
    bg.height = Math.floor(H * dpr);
    const b = bg.getContext("2d");
    b.setTransform(dpr, 0, 0, dpr, 0, 0);

    const sky = b.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, SKY_TOP);
    sky.addColorStop(0.62, SKY_TOP);
    sky.addColorStop(1, SKY_LOW);
    b.fillStyle = sky;
    b.fillRect(0, 0, W, H);

    // The low sun sits behind the canopy on purpose. A silhouette is only a
    // silhouette against something brighter than itself, and at 0.26 alpha
    // this glow was too weak to separate a near-black tree from a dark blue
    // sky — the tree was structurally right and still barely visible.
    // The glow follows the tree between layouts; a backlight in the wrong
    // place is just a smear.
    const narrow = W < 700;
    const sx = narrow ? W * 0.62 : W * 0.72;
    const sy = narrow ? H * 0.34 : H * 0.70;
    const sun = b.createRadialGradient(sx, sy, 0, sx, sy, Math.min(W, H) * 0.62);
    sun.addColorStop(0, "rgba(250,186,94,0.40)");
    sun.addColorStop(0.30, "rgba(250,186,94,0.19)");
    sun.addColorStop(0.62, "rgba(250,186,94,0.055)");
    sun.addColorStop(1, "rgba(250,186,94,0)");
    b.fillStyle = sun;
    b.fillRect(0, 0, W, H);
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintSky();
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

     A divi-divi is not a symmetric tree with a lean, and it is not a fractal.
     Measured off the logo artwork it is 1.38 times wider than tall, the trunk
     stands toward the windward side, and the canopy runs 34/48/18 across the
     width — dense just behind the trunk, streaming downwind, feathering to
     nothing. Almost nothing survives on the windward face.

     Two things were wrong with the previous version and both showed up only
     on render. The limbs all left from the top two trunk segments, so the
     crown came out as two separate clumps with a gap between them instead of
     one continuous mass. And the foliage was drawn as filled ellipses, which
     at any size reads as smudges: the real crown is thousands of tiny
     leaflets in flat layers, so it has a combed, feathered edge, not a blobby
     one.

     So limbs now leave from four points down the trunk and overlap, and the
     foliage is drawn as fans of fine tapering strokes. Stiffness still falls
     off outward, so the wind moves the canopy far more than the trunk. */
  function buildTree() {
    const rnd = mulberry32(20260822);
    const segs = [];

    /* Two layouts, because a phone is not a narrow desktop.

       On a wide screen the tree stands to the right of the headline, rooted at
       the bottom edge, and the copy has the left half to itself.

       Scaling that same arrangement down gave a tree a third of the width,
       tucked into the bottom corner behind the body copy, where it read as a
       smudge and not as anything — while the top half of the screen sat empty.
       So on a narrow screen it moves: much larger, rooted lower-left, filling
       the space above the headline that the wide layout does not have. */
    const narrow = W < 700;

    const treeW = narrow
      ? Math.min(W * 0.86, H * 0.36)
      : Math.min(W * 0.30, H * 0.46);
    const treeH = treeW / 1.38;
    const baseX = narrow ? W * 0.10 : W * 0.545;
    // Wide: rooted at the bottom edge, so the foot is cropped. Narrow: rooted
    // above the headline, where the foot is fully visible and has to be
    // drawn as if it were.
    const baseY = narrow ? H * 0.58 : H * 0.96;
    const DOWNWIND = 1;              // canopy streams to the right

    function add(parent, angle, len, width, opts) {
      const idx = segs.length;
      segs.push({
        x: parent < 0 ? baseX : 0,
        y: parent < 0 ? baseY : 0,
        angle, len, width, parent,
        stiff: (opts && opts.stiff) || 0.1,
        sprays: (opts && opts.sprays) || null,
        depth: parent < 0 ? 0 : segs[parent].depth + 1,
      });
      return idx;
    }

    // Angles stored here are ABSOLUTE rest angles. draw() derives each
    // segment's bend from (own angle - parent angle), so storing deltas makes
    // the whole tree collapse — which it did, once.

    // ---- trunk: a curve, not a pole, and it flares into the ground --------
    const TRUNK = 7;
    const trunkIdx = [];
    let prev = -1;
    for (let i = 0; i < TRUNK; i++) {
      const t = i / (TRUNK - 1);
      // -84° at the base easing to -46°: pushed over from the ground up.
      const ang = (-86 + t * 52) * Math.PI / 180;
      // The base flare matters. A trunk of even width reads as a drawn line;
      // a real one is widest where it meets the ground and the eye knows it.
      //
      // It was overdone. At 0.085 with a 1.35 multiplier and a round line cap,
      // the foot drew a semicircular blob — a golf club, not a tree. The wide
      // layout hid it by rooting the trunk past the bottom edge; the narrow
      // layout, which shows the whole foot, did not.
      const w = treeW * 0.058 * (1 - t * 0.58) * (i === 0 ? 1.18 : 1);
      prev = add(prev, ang, (treeH / TRUNK) * (1.20 - t * 0.22), Math.max(3, w),
                 { stiff: 0.022 + t * 0.05 });
      trunkIdx.push(prev);
    }
    const crown = prev;

    /* The flag envelope.

       u runs 0 at the trunk to 1 at the downwind tip. The crown is not an
       even wedge: it is thickest a quarter of the way out, because the
       leading edge is stripped by the wind and the trailing edge has run out
       of branch. This one curve is what makes the silhouette read as a
       divi-divi rather than a windswept anything. */
    function envelope(u) {
      return Math.pow(Math.sin(Math.PI * Math.pow(u, 0.52)), 0.78);
    }

    // ---- limbs: every one leaves downwind, near horizontal ---------------
    // They start from four points down the trunk, not one or two. A single
    // origin fans out and leaves a hole under the crown; four overlap into
    // one mass, which is what the tree actually does.
    const LIMBS = 30;
    for (let i = 0; i < LIMBS; i++) {
      const t = i / (LIMBS - 1);
      // -38° to +12°: above horizontal at the top of the crown, drooping at
      // the trailing edge. This spread is what makes the flag shape.
      const ang = (-38 + t * 50) * Math.PI / 180;

      // Limbs leave from the top three trunk segments, and the mapping is
      // deliberately not monotonic: neighbouring limbs start at different
      // heights so they interleave. Ordered origins left a clean wedge of
      // empty sky through the middle of the crown, which is the one thing a
      // real canopy never has.
      const from = trunkIdx[TRUNK - 1 - (i % 4)];
      // Longest through the middle of the fan, short at both edges — the
      // leading edge is wind-stripped, the trailing edge has run out of tree.
      const limbLen = treeW * (0.20 + envelope(0.12 + t * 0.80) * 0.30);

      let node = add(from, ang, limbLen * 0.38,
                     Math.max(1.8, treeW * 0.024 * (1 - t * 0.3)),
                     { stiff: 0.12 });
      let abs = ang;

      /* Where each limb settles once it is clear of the trunk.

         Limbs leave the trunk at a spread of angles, but they do not keep
         going that way — every one of them turns downwind and runs close to
         horizontal, which is why the crown of a divi-divi looks like stacked
         shelves. Letting the angles persist made the whole canopy radiate
         from one point like a shuttlecock, which is what it looked like.

         The shelves fan by fourteen degrees across the crown, no more: enough
         that they read as separate layers, little enough that they stay
         parallel. */
      const layerAng = (-9 + t * 14) * Math.PI / 180;

      // Each limb runs downwind in four or five steps, carrying foliage the
      // whole way. Fewer steps left the foliage bunched at the tips.
      const steps = 4 + (rnd() < 0.55 ? 1 : 0);
      for (let sI = 0; sI < steps; sI++) {
        const u = (sI + 1) / steps;
        // Pull hard toward the shelf angle rather than random-walking from
        // wherever the limb left the trunk.
        abs += (layerAng - abs) * 0.62 + (rnd() - 0.5) * 0.075 * DOWNWIND;

        // Precompute the foliage fan here, not in draw(). The strokes must be
        // identical every frame or the canopy boils.
        // Many short strokes, not a few long ones. The first attempt used
        // five or six at nearly the limb's own length and the result read as
        // a fern — the density of a divi-divi crown comes from the sheer
        // count of leaflets, so the count is where it has to come from here.
        // Leaflet count follows the VIEWPORT, not the tree. Tying it to the
        // tree's own size looked right and was not: the narrow layout draws a
        // much bigger tree, so density went up exactly where the device is
        // weakest and the frame rate halved. What a phone can afford depends
        // on the phone.
        const density = Math.min(1, Math.max(0.34, W / 1150));
        const count = Math.round((11 + Math.floor(rnd() * 8)) * density);
        const sprays = [];
        const reach = envelope(Math.min(1, 0.14 + u * 0.78)) * treeW * 0.072;
        for (let k = 0; k < count; k++) {
          const f = count === 1 ? 0.5 : k / (count - 1);
          sprays.push({
            // Fanned along the wind and kept tight: the leaflets lie flat
            // rather than standing out from the twig like a bottle brush.
            off: (f - 0.5) * 0.30 + (rnd() - 0.5) * 0.07,
            len: reach * (0.45 + rnd() * 0.75),
            // Leaflets hang. Without this the fan reads as a feather duster.
            droop: 0.12 + rnd() * 0.26,
            // Width as one of three buckets, not a free value. draw() batches
            // every stroke of a given width into a single path, and a path can
            // only carry one lineWidth — so the quantisation here is what makes
            // the batching possible. Three widths is plenty of variation to
            // read as foliage.
            wb: Math.floor(rnd() * 3),
          });
        }

        node = add(node, abs,
                   limbLen * (0.26 - sI * 0.030),
                   Math.max(1.2, treeW * 0.010 * (1 - sI * 0.18)),
                   { stiff: 0.17 + sI * 0.075, sprays });
      }
    }

    segs.leafWidths = [
      Math.max(0.7, treeW * 0.0034),
      Math.max(0.9, treeW * 0.0048),
      Math.max(1.1, treeW * 0.0064),
    ];
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
    if (!seedTree || !bg) return;
    ctx.drawImage(bg, 0, 0, W, H);

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

    // Wood first, tapered. Everything with foliage on it is still a branch
    // and still gets drawn — the previous version skipped those, which is
    // part of why the crown floated free of the tree.
    ctx.lineJoin = "round";
    ctx.strokeStyle = TREE;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      // A round cap on the widest segment of all domes the foot of the trunk.
      // Cut it flat; every other segment wants the round cap so the joins
      // between them disappear.
      ctx.lineCap = p.seg.depth === 0 ? "butt" : "round";
      ctx.beginPath();
      ctx.lineWidth = p.seg.width;
      ctx.moveTo(p.x1, p.y1);
      ctx.lineTo(p.x2, p.y2);
      ctx.stroke();
    }
    ctx.lineCap = "round";

    /* Foliage, as fans of fine strokes.

       The crown of a divi-divi is thousands of small leaflets lying flat in
       layers, so its edge is combed and feathery. Filled shapes cannot do that
       at any size — they read as smudges, which is exactly how the ellipse
       version looked. Strokes can.

       They are batched into three paths, one per width bucket. The first
       version gave each stroke its own beginPath/stroke pair and measured 8
       fps on a phone-sized viewport under 4x CPU throttling — the per-call
       overhead, not the drawing, was the whole cost. Same pixels, three
       stroke calls. */
    const widths = seedTree.leafWidths;
    for (let b = 0; b < widths.length; b++) {
      ctx.beginPath();
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        const sprays = p.seg.sprays;
        if (!sprays) continue;

        for (let k = 0; k < sprays.length; k++) {
          const sp = sprays[k];
          if (sp.wb !== b) continue;
          const a = p.angle + sp.off;
          const ca = Math.cos(a), sa = Math.sin(a);
          // The tip falls away from the line of the spray, so each stroke is a
          // shallow hanging curve rather than a spoke.
          ctx.moveTo(p.x2, p.y2);
          ctx.quadraticCurveTo(
            p.x2 + ca * sp.len * 0.55, p.y2 + sa * sp.len * 0.55,
            p.x2 + ca * sp.len,        p.y2 + sa * sp.len + sp.len * sp.droop);
        }
      }
      ctx.lineWidth = widths[b];
      ctx.stroke();
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
