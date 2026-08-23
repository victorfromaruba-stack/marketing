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

  /* Built from a photograph of the real tree, which corrected three things.

     The previous version was a flag: canopy entirely downwind of the trunk,
     nothing on the windward face, streaming off to one side. A divi-divi on
     Eagle Beach does not do that. Its crown sits roughly ON the trunk and
     spreads to BOTH sides, wider than it is tall, with a bottom edge so flat
     it looks sheared and a top that domes and lumps. The wind shows in the
     trunk and in a slight downwind bias of the crown's centre — not in the
     canopy being blown off the tree.

     The trunk is short and thick, barely half the tree's height, and it does
     not curve smoothly. It kinks: up, twist, back, out. A clean arc reads as
     a drawn line, and that is what the old one was.

     And it stands on a mess of exposed gnarled roots, spreading wider than
     the trunk in both directions across the sand. There were none at all
     before, which is a large part of why the tree looked planted in the page
     rather than grown out of it.

     Foliage is clumps, not feathers. The leaflets are tiny but they gather
     into dense lobes with real gaps of sky between them, so the mass is drawn
     as many small overlapping discs whose union has a naturally ragged edge.
     Fine strokes then break up the perimeter. */
  function buildTree() {
    const rnd = mulberry32(20260823);
    const segs = [];

    /* Two layouts, because a phone is not a narrow desktop.

       On a wide screen the tree stands to the right of the headline, rooted at
       the bottom edge, and the copy has the left half to itself. Scaled down
       that same arrangement drew a tree a third of the width tucked behind the
       body copy, where it read as a smudge, while the top half of the screen
       sat empty. So on a narrow screen it moves and grows. */
    const narrow = W < 700;

    // Sized from the CANOPY width — that is the tree's real dimension.
    const treeW = narrow
      ? Math.min(W * 0.92, H * 0.40)
      : Math.min(W * 0.38, H * 0.72);
    const treeH = treeW / 1.40;          // measured off the photograph
    const baseX = narrow ? W * 0.44 : W * 0.72;
    // Rooted above the bottom edge, not on it. The root plate is half the
    // character of this tree and it is worth nothing below the fold.
    const baseY = narrow ? H * 0.52 : H * 0.92;
    const DOWNWIND = 1;

    function add(parent, angle, len, width, opts) {
      const idx = segs.length;
      segs.push({
        x: parent < 0 ? baseX : 0,
        y: parent < 0 ? baseY : 0,
        angle, len, width, parent,
        stiff: (opts && opts.stiff) || 0.1,
        root: !!(opts && opts.root),
        clumps: (opts && opts.clumps) || null,
        sprays: (opts && opts.sprays) || null,
        depth: parent < 0 ? 0 : segs[parent].depth + 1,
      });
      return idx;
    }

    // Angles stored here are ABSOLUTE rest angles. draw() derives each
    // segment's bend from (own angle - parent angle), so storing deltas makes
    // the whole tree collapse — which it did, once.

    // ---- roots: a gnarled plate, wider than the trunk ---------------------
    // They barely move in wind, so stiffness is near zero. Drawn first so the
    // trunk overlaps them rather than the other way round.
    const ROOTS = 7;
    for (let r = 0; r < ROOTS; r++) {
      const f = r / (ROOTS - 1);
      // Fanned across the ground both ways, dipping slightly below the base.
      /* Two fans, left and right, both tipping DOWN into the sand.

         Sampling one arc from -14 to 194 degrees put the outermost roots
         above horizontal, so they came out as a plank sticking off the side
         of the trunk. In canvas coordinates y grows downward, so a root that
         digs in has a small positive angle on the right and a little under
         180 on the left — and nothing wants to be near 90, which is straight
         down through the trunk's own foot. */
      const right = r % 2 === 0;
      const g = Math.floor(r / 2) / Math.max(1, Math.floor((ROOTS - 1) / 2));
      const a = (right ? (4 + g * 34) : (176 - g * 34)) * Math.PI / 180
                + (rnd() - 0.5) * 0.22;
      let node = -1;
      let abs = a;
      // Four segments, tapering hard to a point. Three thick ones with a
      // round cap ended in blunt stubs — a crab, not a root plate. A root
      // reads as a root because it thins to nothing where it enters the sand.
      const n = 4;
      for (let k = 0; k < n; k++) {
        // Roots kink harder than branches do.
        abs += (rnd() - 0.5) * 0.7;
        node = add(node < 0 ? -1 : node, abs,
                   treeW * (0.10 - k * 0.018) * (0.7 + rnd() * 0.8),
                   Math.max(1.2, treeW * 0.034 * Math.pow(1 - k / n, 1.9)),
                   { stiff: 0.004, root: true });
        if (k === 0) segs[node].x = baseX, segs[node].y = baseY;
      }
    }

    // ---- trunk: short, thick, and kinked ---------------------------------
    const TRUNK = 6;
    const trunkH = treeH * 0.54;
    // The kink is the point. Each entry is an absolute angle in degrees, and
    // the sequence goes up, leans, twists back, then leans out again — traced
    // off the photograph rather than eased between two numbers.
    const TRUNK_ANGLES = [-96, -86, -62, -74, -58, -66];
    const trunkIdx = [];
    let prev = -1;
    for (let i = 0; i < TRUNK; i++) {
      const t = i / (TRUNK - 1);
      const ang = TRUNK_ANGLES[i] * Math.PI / 180;
      // Widest at the ground and tapering hard. The foot is cut flat rather
      // than round-capped, or it domes into a golf club.
      const w = treeW * 0.078 * (1 - t * 0.50) * (i === 0 ? 1.06 : 1);
      prev = add(prev, ang, (trunkH / TRUNK) * (1.15 - t * 0.18), Math.max(3, w),
                 { stiff: 0.016 + t * 0.038 });
      trunkIdx.push(prev);
    }
    const crown = prev;

    /* The crown envelope, in tree units relative to the trunk top.

       Half-width is treeW/2 each side. Half-height is much less — the canopy
       of this tree is well over twice as wide as it is tall. The centre sits
       a little downwind and a little above the fork. */
    const cw = treeW * 0.50;
    const ch = treeW * 0.200;
    const ccx = treeW * 0.07 * DOWNWIND;   // downwind bias, from the photo
    const ccy = -treeH * 0.16;

    // ---- primary branches: radiating across, not streaming off ------------
    const BRANCH = 14;
    for (let i = 0; i < BRANCH; i++) {
      // Spread across the whole horizontal, both sides of the trunk. Biased
      // downwind by sampling non-uniformly rather than by cutting the
      // windward side off, which is what made the old one a flag.
      const u = i / (BRANCH - 1);
      const biased = Math.pow(u, 0.82);
      const deg = -168 + biased * 156;
      const ang = deg * Math.PI / 180;

      // Reach out to the envelope in this direction, so the crown's outline
      // is the envelope and every branch ends on it.
      const ex = Math.cos(ang), ey = Math.sin(ang);
      let reach = 1 / Math.sqrt((ex * ex) / (cw * cw) + (ey * ey) / (ch * ch));
      // Every branch ending exactly on the envelope draws an ellipse, which is
      // what the first pass did — a smooth bun. Uneven branches are what make
      // a crown lobe, so the reach varies and neighbouring branches differ.
      reach *= 0.74 + rnd() * 0.42;

      let node = crown;
      let abs = ang;
      const STEPS = 3;
      for (let sI = 0; sI < STEPS; sI++) {
        // Gnarled: each step wanders, and the outer steps flatten toward
        // horizontal because the crown's bottom edge is sheared flat.
        abs += (rnd() - 0.5) * 0.34;
        abs += (ang * 0.15 - abs * 0.15);

        const segLen = (reach / STEPS) * (1.15 - sI * 0.16) * (0.82 + rnd() * 0.36);

        // Foliage only on the outer two thirds — the inner crown of this tree
        // is bare gnarled wood, clearly visible in the photograph.
        let clumps = null, sprays = null;
        if (sI > 0) {
          clumps = [];
          const n = Math.round((26 + rnd() * 18) * Math.min(1, Math.max(0.40, W / 1150)));
          for (let k = 0; k < n; k++) {
            clumps.push({
              along: 0.08 + rnd() * 1.02,
              perp: (rnd() - 0.5) * reach * 0.34,
              // Small. A lobe is built out of many of these; at bubble size
              // the union stops being foliage and becomes a cartoon cloud,
              // which is what eight discs of 0.03 looked like.
              // Wide variance on purpose. Discs of near-equal size read as
              // broccoli; the range is what makes the edge look grown.
              r: treeW * (0.006 + Math.pow(rnd(), 1.7) * 0.030),
            });
          }
          // A few fine strokes so the perimeter is ragged rather than scalloped.
          sprays = [];
          const m = Math.round((9 + rnd() * 8) * Math.min(1, Math.max(0.40, W / 1150)));
          for (let k = 0; k < m; k++) {
            sprays.push({
              off: (rnd() - 0.5) * 1.9,
              len: treeW * (0.02 + rnd() * 0.045),
              droop: 0.15 + rnd() * 0.3,
              wb: Math.floor(rnd() * 3),
            });
          }
        }

        node = add(node, abs, segLen,
                   Math.max(1.4, treeW * 0.020 * (1 - sI * 0.30)),
                   { stiff: 0.10 + sI * 0.085, clumps, sprays });
      }
    }

    segs.leafWidths = [
      Math.max(0.7, treeW * 0.0032),
      Math.max(0.9, treeW * 0.0046),
      Math.max(1.1, treeW * 0.0062),
    ];
    // The crown's bottom edge is sheared flat by the wind — the single most
    // recognisable thing about this tree's silhouette after the lean. Clumps
    // that would hang below it are lifted to sit on it.
    segs.crownFloorAt = function (originY) {
      return originY + ccy + ch * 0.92;
    };
    segs.crownMeta = { cw, ch, ccx, ccy };
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

    // Roots and wood. Roots first so the trunk sits over them, and the foot
    // of the trunk is cut flat — a round cap on the widest segment of all
    // domes it into a golf club.
    ctx.lineJoin = "round";
    ctx.strokeStyle = TREE;
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        if ((pass === 0) !== p.seg.root) continue;
        ctx.lineCap = (p.seg.depth === 0 && !p.seg.root) ? "butt" : "round";
        ctx.beginPath();
        ctx.lineWidth = p.seg.width;
        ctx.moveTo(p.x1, p.y1);
        ctx.lineTo(p.x2, p.y2);
        ctx.stroke();
      }
    }
    ctx.lineCap = "round";

    /* Foliage as overlapping discs.

       The leaflets of a divi-divi are tiny, but they gather into dense lobes
       with real gaps of sky between them — so the crown is a lumpy mass with a
       ragged edge, not a feather and not a smooth blob. Many small overlapping
       circles give exactly that: their union has an edge nobody drew, which is
       what makes it read as foliage rather than as a shape.

       Everything goes into ONE path and gets a single fill. Filling per circle
       measured 8 fps on a throttled phone; the union is identical because they
       all share a colour and overlap. */
    const floorY = seedTree.crownFloorAt(seedTree[0].y);
    ctx.fillStyle = TREE;
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const clumps = p.seg.clumps;
      if (!clumps) continue;
      const dx = p.x2 - p.x1, dy = p.y2 - p.y1;
      const nx = -dy, ny = dx;                     // perpendicular, unnormalised
      const nl = Math.hypot(nx, ny) || 1;

      for (let k = 0; k < clumps.length; k++) {
        const c = clumps[k];
        const cx = p.x1 + dx * c.along + (nx / nl) * c.perp;
        let cy = p.y1 + dy * c.along + (ny / nl) * c.perp;
        // The crown's underside is sheared flat by the wind. Anything hanging
        // below that line is lifted onto it rather than dangling — that flat
        // bottom edge is the most recognisable thing about the silhouette
        // after the lean itself.
        if (cy > floorY) cy = floorY - (cy - floorY) * 0.18;
        ctx.moveTo(cx + c.r, cy);
        ctx.arc(cx, cy, c.r, 0, Math.PI * 2);
      }
    }
    ctx.fill();

    // Fine strokes at the perimeter, so the edge frays instead of scalloping.
    // Batched into three paths by width; a path carries one lineWidth, which
    // is why the widths were quantised into buckets at build time.
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
