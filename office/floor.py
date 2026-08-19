"""Isometric office renderer. One continuous floor, partition walls, doors, furniture.
No animation anywhere (house rule)."""
import math

TW, TH = 44, 22
def iso(x, y, z=0):
    return ((x - y) * TW / 2, (x + y) * TH / 2 - z)

def sh(c, f):
    h = c.lstrip("#"); r, g, b = (int(h[i:i+2], 16) for i in (0, 2, 4))
    return "#%02X%02X%02X" % tuple(max(0, min(255, int(v * f))) for v in (r, g, b))

def poly(pts, fill, stroke=None, sw=.7, op=None):
    d = " ".join(f"{x:.1f},{y:.1f}" for x, y in pts)
    s = f' stroke="{stroke}" stroke-width="{sw}" stroke-linejoin="round"' if stroke else ""
    o = f' opacity="{op}"' if op else ""
    return f'<polygon points="{d}" fill="{fill}"{s}{o}/>'

def tile(x, y, fill, stroke=None):
    return poly([iso(x,y), iso(x+1,y), iso(x+1,y+1), iso(x,y+1)], fill, stroke, .5)

def box(x, y, w, d, h, col, z=0):
    t = [iso(x,y,z+h), iso(x+w,y,z+h), iso(x+w,y+d,z+h), iso(x,y+d,z+h)]
    l = [iso(x,y+d,z+h), iso(x+w,y+d,z+h), iso(x+w,y+d,z), iso(x,y+d,z)]
    r = [iso(x+w,y,z+h), iso(x+w,y+d,z+h), iso(x+w,y+d,z), iso(x+w,y,z)]
    return poly(l, sh(col,.68)) + poly(r, sh(col,.84)) + poly(t, col, sh(col,.5))

# ---------------------------------------------------------------- flooring
def _wood(x, y, base):
    """Plank floor — four boards per tile, each a slightly different cut of timber."""
    s = ""
    n = 4
    for k in range(n):
        y0, y1 = y + k/n, y + (k+1)/n
        v = (.86, 1.0, .93, 1.07)[(int(x*3 + y*7 + k*5)) % 4]
        s += poly([iso(x, y0), iso(x+1, y0), iso(x+1, y1), iso(x, y1)],
                  sh(base, v), sh(base, .74), .45)
    return s

def _tile6(x, y, base):
    """Chequer tile with grout."""
    s = ""
    for a in range(2):
        for b in range(2):
            x0, y0 = x + a/2, y + b/2
            lt = (a + b + x + y) % 2 == 0
            s += poly([iso(x0, y0), iso(x0+.5, y0), iso(x0+.5, y0+.5), iso(x0, y0+.5)],
                      sh(base, 1.12 if lt else .82), sh(base, .6), .5)
    return s

def _carpet(x, y, base):
    """Flecked carpet — subtle per-tile variation, no hard grid."""
    v = .90 + ((x * 7 + y * 13) % 5) * .035
    s = tile(x, y, sh(base, v), sh(base, .92))
    px, py = iso(x + .5, y + .5)
    for k in range(3):
        ox = ((x * 31 + y * 17 + k * 11) % 11) - 5
        oy = ((x * 13 + y * 29 + k * 7) % 7) - 3
        s += f'<circle cx="{px+ox:.0f}" cy="{py+oy:.0f}" r="1.1" fill="{sh(base,1.3)}" opacity=".5"/>'
    return s

def _poly_concrete(x, y, base):
    v = .94 + ((x * 5 + y * 11) % 4) * .03
    return tile(x, y, sh(base, v), sh(base, .86))

MATS = {"wood": _wood, "tile": _tile6, "carpet": _carpet, "concrete": _poly_concrete}

def slab(W, D, zones):
    """One continuous floor, each zone laid in its own material."""
    s = ""
    zmap = {}
    for z in zones:
        zx, zy, zw, zd, col, _lbl, mat, fcol = z
        for i in range(zw):
            for j in range(zd):
                zmap[(zx+i, zy+j)] = (mat, fcol)
    for x in range(W):
        for y in range(D):
            mat, fcol = zmap.get((x, y), ("concrete", "#2b3b48"))
            s += MATS[mat](x, y, fcol)
    return s

def skirting(x, y, w, d, col="#4a5c6b"):
    """Low trim where the floor meets a wall — reads as a finished room."""
    s = ""
    for i in range(w):
        s += box(x+i, y-0.02, 1, 0.08, 6, col)
    for j in range(d):
        s += box(x-0.02, y+j, 0.08, 1, 6, sh(col, .9))
    return s

def wall(x, y, along, length, h=20, col="#35485a", doors=()):
    """Partition wall. along='x' or 'y'. doors = tile indices to leave open."""
    s = ""
    for i in range(length):
        if i in doors:
            continue
        if along == "x":
            s += box(x+i, y-0.09, 1, 0.18, h, col)
        else:
            s += box(x-0.09, y+i, 0.18, 1, h, col)
    return s

def outer(W, D, h=58, col="#3b4c5c"):
    """Perimeter walls with window slots on the two visible faces."""
    s = ""
    for i in range(W):
        s += box(i, -0.16, 1, 0.32, h, col)
        if i % 3 == 1:
            s += box(i+.1, -0.20, .8, .1, 20, "#8fd3e0", z=h-40)
    for j in range(D):
        s += box(-0.16, j, 0.32, 1, h, sh(col, .9))
        if j % 3 == 1:
            s += box(-0.20, j+.1, .1, .8, 20, "#8fd3e0", z=h-40)
    return s

def plate(x, y, title, sub=None, tcol="#FFFDF9", scol="#a9e4e8", z=0, big=False):
    """Name plate: person on top, role beneath."""
    px, py = iso(x, y, z)
    fs = 12.5 if big else 11.5
    w = max(len(title) * (fs * .60), len(sub or "") * 6.0) + 22
    h = 31 if sub else 21
    s = (f'<rect x="{px-w/2:.0f}" y="{py-12:.0f}" width="{w:.0f}" height="{h}" rx="9" '
         f'fill="#02141f" opacity=".88"/>')
    s += (f'<text x="{px:.0f}" y="{py+2:.0f}" text-anchor="middle" font-size="{fs}" '
          f'font-weight="{800 if big else 700}" fill="{tcol}">{title}</text>')
    if sub:
        s += (f'<text x="{px:.0f}" y="{py+14:.0f}" text-anchor="middle" font-size="9.5" '
              f'letter-spacing=".6" fill="{scol}">{sub}</text>')
    return s

def zonelabel(x, y, col, text, w=9, d=6):
    """Floating room name, centred over the zone, above every wall."""
    lx, ly = iso(x + w/2, y + d/2, 96)
    pw = len(text) * 7.4 + 26
    return (f'<rect x="{lx-pw/2:.0f}" y="{ly-13:.0f}" width="{pw:.0f}" height="24" rx="12" '
            f'fill="{sh(col,.5)}" opacity=".92"/>'
            f'<text x="{lx:.0f}" y="{ly+4:.0f}" text-anchor="middle" font-size="11" '
            f'letter-spacing="2.2" font-weight="800" fill="{sh(col,2.4)}">{text}</text>')

# ---------------------------------------------------------------- furniture
def chair(x, y, col, back="n"):
    """Proper task chair: 5-star base, gas column, seat, contoured back, armrests."""
    s = ""
    cx, cy = x + .40, y + .40
    for k in range(5):                                    # star base
        ang = k * 72 * math.pi / 180
        s += box(cx + math.cos(ang)*.24 - .07, cy + math.sin(ang)*.24 - .07, .16, .16, 2.5,
                 sh("#2b3640", 1.0))
    s += box(cx - .05, cy - .05, .10, .10, 9, "#3d4954")  # gas column
    s += box(x + .06, y + .06, .68, .68, 5, sh(col, .92), z=9)   # seat
    s += box(x + .10, y + .10, .60, .60, 2, sh(col, 1.12), z=14) # cushion
    if back == "n":
        s += box(x + .06, y + .02, .68, .11, 20, sh(col, .82), z=12)
        s += box(x + .10, y + .00, .60, .09, 6, sh(col, 1.0), z=28)
    elif back == "s":
        s += box(x + .06, y + .67, .68, .11, 20, sh(col, .82), z=12)
    elif back == "w":
        s += box(x + .02, y + .06, .11, .68, 20, sh(col, .82), z=12)
    else:
        s += box(x + .67, y + .06, .11, .68, 20, sh(col, .82), z=12)
    s += box(x - .02, y + .18, .09, .40, 3, sh(col, .7), z=15)    # armrests
    s += box(x + .73, y + .18, .09, .40, 3, sh(col, .7), z=15)
    return s

def desk(x, y, col, name, count, unit, person=None):
    """A proper workstation: panel-leg desk, monitor on an arm, keyboard, mug, pedestal."""
    TOP, W, D = 15, 2.35, 1.15
    s  = box(x + .06, y + .06, .12, D - .12, TOP, "#7d6f5c")        # side panels
    s += box(x + W - .18, y + .06, .12, D - .12, TOP, "#7d6f5c")
    s += box(x + .06, y + D - .16, W - .12, .10, TOP - 3, "#8d7f6a")  # modesty panel
    s += box(x, y, W, D, 2.4, "#E0D3BC", z=TOP)                     # desktop
    s += box(x, y, W, D, .6, "#c3b49a", z=TOP - .6)                 # edge band

    # desk mat
    s += poly([iso(x+.30, y+.28, TOP+2.4), iso(x+1.55, y+.28, TOP+2.4),
               iso(x+1.55, y+.95, TOP+2.4), iso(x+.30, y+.95, TOP+2.4)],
              "#31414f", "#26333e", .6)

    # monitor: foot, arm, tilted screen with a lit face
    s += box(x + .74, y + .16, .40, .22, 1.6, "#2b3640", z=TOP+2.4)
    s += box(x + .90, y + .22, .09, .09, 9, "#39454f", z=TOP+4)
    
    s += box(x + .70, y + .21, .52, .06, 11, "#222d36", z=TOP+4)
    sx, sy = iso(x + .96, y + .24, TOP + 17)
    s += poly([(sx-17, sy-3), (sx+17, sy-11.5), (sx+17, sy+2), (sx-17, sy+10.5)],
              "#141d24", "#0c1319", .9)
    s += poly([(sx-14.5, sy-3), (sx+14.5, sy-10.2), (sx+14.5, sy+.4), (sx-14.5, sy+7.6)],
              "#0f5d78", None, 0)
    s += poly([(sx-12, sy-3.2), (sx+8, sy-8.2), (sx+8, sy-5.4), (sx-12, sy-.4)],
              "#43b9c4", None, 0, ".7")

    # laptop, keyboard, mouse, mug, papers
    s += box(x + 1.52, y + .34, .46, .34, 1.2, "#2f3b45", z=TOP+2.4)
    s += box(x + 1.52, y + .34, .46, .05, 9, "#3c4a55", z=TOP+3.4)
    s += box(x + .62, y + .70, .62, .20, 1.1, "#dfe4e8", z=TOP+2.4)
    s += box(x + 1.32, y + .74, .13, .13, 1.1, "#dfe4e8", z=TOP+2.4)
    mx, my = iso(x + .40, y + .55, TOP + 3)
    s += f'<ellipse cx="{mx:.0f}" cy="{my:.0f}" rx="5" ry="3.4" fill="#c94f3d"/>'
    s += f'<rect x="{mx-5:.0f}" y="{my-6:.0f}" width="10" height="6" fill="#c94f3d"/>'
    s += box(x + 1.78, y + .18, .34, .26, 1.6, "#efe9dc", z=TOP+2.4)

    # pedestal drawers
    s += box(x + W + .12, y + .18, .62, .80, 13, "#6f7c88")
    for i in range(3):
        s += box(x + W + .10, y + .24, .04, .68, 2.2, "#8e9aa5", z=2 + i*4)
    s += box(x + W + .18, y + .26, .5, .5, 2, "#2f7d52", z=13)      # a small plant on top

    # chair
    s += chair(x + .72, y + D + .34, col, "s")   # backrest near side => faces the screen

    # desk lamp — lit when work is waiting
    lamp = "#FFC06B" if count else "#4a5560"
    lx, ly = iso(x + 2.14, y + .30, TOP + 2.4)
    if count:
        s += f'<circle cx="{lx:.1f}" cy="{ly-10:.1f}" r="13" fill="#FFC06B" opacity=".16"/>'
        s += f'<circle cx="{lx:.1f}" cy="{ly-10:.1f}" r="7" fill="#FFC06B" opacity=".32"/>'
    s += f'<rect x="{lx-1:.1f}" y="{ly-13:.1f}" width="2" height="13" fill="#5c6873"/>'
    s += f'<rect x="{lx-5:.1f}" y="{ly-1:.1f}" width="10" height="2.5" rx="1" fill="#5c6873"/>'
    s += f'<circle cx="{lx:.1f}" cy="{ly-14:.1f}" r="4" fill="{lamp}"/>'

    s += plate(x + 1.1, y + 2.55, person or name, name if person else None)
    if count:
        bx, by = iso(x + .9, y - .35, 40)
        s += f'<rect x="{bx-13:.0f}" y="{by-13:.0f}" rx="9" width="26" height="19" fill="#FF7A45"/>'
        s += f'<text x="{bx:.0f}" y="{by:.0f}" text-anchor="middle" font-size="11.5" font-weight="800" fill="#fff">{count}</text>'
    return s

def plant(x, y, big=False):
    k = 1.35 if big else 1.0
    s = box(x, y, .55*k, .55*k, 9*k, "#9a6b4f")
    cx, cy = iso(x+.28*k, y+.28*k, 9*k)
    for dx, dy, r in ((0,-7,9),( -8,-2,7),(8,-3,7),(0,-15,7),(-5,-11,6),(6,-12,6)):
        s += f'<ellipse cx="{cx+dx*k:.0f}" cy="{cy+dy*k:.0f}" rx="{r*k:.0f}" ry="{r*.72*k:.0f}" fill="#2f7d52"/>'
    return s

def cabinet(x, y, col="#6b7885"):
    s = box(x, y, .7, 1.6, 30, col)
    for i in range(3):
        s += box(x-.02, y+.15, .06, 1.3, 2, sh(col,1.35), z=6+i*9)
    return s

def cooler(x, y):
    s = box(x, y, .55, .55, 16, "#dfe6ea")
    s += box(x+.06, y+.06, .43, .43, 16, "#7fd0e0", z=16)
    return s

def coffee(x, y):
    s = box(x, y, 1.6, .7, 14, "#7a6a58")
    s += box(x+.15, y+.12, .45, .45, 12, "#2b3a45", z=14)
    s += box(x+.8, y+.15, .3, .3, 8, "#c94f3d", z=14)
    return s

def sofa(x, y, col="#2f5d78"):
    s = box(x, y, 2.4, .95, 10, col)
    s += box(x, y, 2.4, .22, 24, sh(col,.86))
    s += box(x, y, .22, .95, 18, sh(col,.94)) + box(x+2.18, y, .22, .95, 18, sh(col,.94))
    return s

def rug(x, y, w, d, col="#8a5f4a"):
    return poly([iso(x,y), iso(x+w,y), iso(x+w,y+d), iso(x,y+d)], col, sh(col,.7), 1.4, op=".55")

def whiteboard(x, y, lines=3, col="#f4f1e8"):
    s = box(x, y, 2.6, .12, 34, col, z=12)
    bx, by = iso(x+.35, y+.05, 42)
    for i in range(lines):
        s += f'<rect x="{bx+i*3:.0f}" y="{by+i*7:.0f}" width="{46-i*9}" height="3" rx="1.5" fill="#5aa0c4" opacity=".8"/>'
    return s

def meeting(x, y, seats, title, sub):
    """Boardroom table with chairs all round — where the standup happens."""
    s = rug(x-.6, y-.6, 5.4, 3.9, "#204457")
    s += box(x, y, 4.2, 2.4, 14, "#B08968")
    for cx in (x+.25, x+3.75):
        s += box(cx, y+.2, .3, 2.0, 14, "#8a6a50")
    for i in range(4):                              # far side — faces down toward the table
        s += chair(x+.28+i*1.0, y-.95, "#3d6d8a", "n")
    for i in range(4):                              # near side — faces up toward the table
        s += chair(x+.28+i*1.0, y+2.55, "#3d6d8a", "s")
    s += chair(x-1.0, y+.8, "#3d6d8a", "w")         # left end — faces right
    s += chair(x+4.35, y+.8, "#3d6d8a", "e")        # right end — faces left
    for i in range(4):                              # laptops
        s += box(x+.45+i*1.0, y+.35, .5, .35, 1.5, "#2b3a45", z=14)
        s += box(x+.45+i*1.0, y+1.5, .5, .35, 1.5, "#2b3a45", z=14)
    s += box(x+1.9, y+1.0, .5, .5, 5, "#c94f3d", z=14)   # the coffee pot
    s += plate(x+2.1, y+3.7, "meeting room", tcol="#FFC06B", big=True)
    return s

def reception(x, y, col="#7a5a12"):
    s = box(x, y, 3.0, 1.1, 18, "#C0A87E")
    s += box(x, y, 3.0, .2, 26, sh("#C0A87E", .8))
    s += chair(x+1.2, y+1.5, col, "s")
    s += plant(x-1.2, y+.2, big=True) + plant(x+3.4, y+.2, big=True)
    return s

def victor(x, y, col, approvals):
    s = rug(x-.8, y-.6, 5.2, 4.2, "#5a4a2a")
    s += box(x, y, 2.8, 1.35, 16, "#B8A480")
    s += box(x+.2, y+.2, .25, .25, 16, "#8d7f6a") + box(x+2.35, y+.9, .25, .25, 16, "#8d7f6a")
    s += chair(x+1.0, y+1.9, col, "n")
    s += box(x+.5, y+.25, .95, .35, 3, "#1a252c", z=16) + box(x+.55, y+.3, .85, .1, 24, "#22303a")
    tcol = "#FF7A45" if approvals else "#7d8890"
    s += box(x+1.9, y+.25, .8, .8, 4, tcol, z=16)
    for k in range(min(approvals, 4)):
        s += box(x+1.95, y+.3, .7, .7, 2.4, "#FFF6F2", z=20+k*3)
    if approvals:
        tx, ty = iso(x+2.3, y+.65, 36+approvals*3)
        s += f'<rect x="{tx-13:.0f}" y="{ty-13:.0f}" rx="9" width="26" height="19" fill="#FF7A45"/>'
        s += f'<text x="{tx:.0f}" y="{ty:.0f}" text-anchor="middle" font-size="11.5" font-weight="800" fill="#fff">{approvals}</text>'
    s += plate(x+1.4, y+3.3, "Victor", tcol="#FFC06B", big=True)
    return s

def chief_desk(x, y, col, person=None):
    s = box(x, y, 1.8, 1.0, 15, "#CBBBA0")
    s += box(x+.15, y+.15, .18, .18, 15, "#8d7f6a")
    s += box(x+.3, y+.15, .75, .1, 23, "#22303a")
    s += chair(x+.5, y+1.3, col, "n")
    s += plate(x+.9, y+2.15, "chief", tcol="#FFC06B")
    return s

def shelf(x, y, col, books):
    s = box(x, y, .55, 2.6, 44, sh(col,.55))
    for k in range(3):
        s += box(x+.05, y+.1, .45, 2.4, 1.6, sh(col,.4), z=8+k*13)
    for i in range(min(books, 15)):
        s += box(x+.08, y+.2+(i % 5)*.45, .34, .3, 22-(i % 3)*4,
                 ["#FFC06B","#43b9c4","#FF7A45"][i % 3], z=(i // 5)*13+2)
    s += plate(x+.3, y+3.0, "library")
    return s
