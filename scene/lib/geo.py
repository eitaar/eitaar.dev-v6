"""Pure geometry and texture helpers for the Poolrooms scene. Standard library only."""

import math
import random

TILE = 0.1  # one tile, metres
TEX_UNIT = 0.4  # one texture repeat, metres (4 x 4 tiles of 10 cm)


def u_profile(radius, spring, floor, segments):
    """Open U cross-section in the XZ plane: left floor edge, up the wall, over a
    semicircular vault, down to the right floor edge. Returns [(x, z), ...]."""
    pts = [(-radius, floor), (-radius, spring)]
    for i in range(1, segments):
        a = math.pi - math.pi * i / segments
        pts.append((radius * math.cos(a), spring + radius * math.sin(a)))
    pts += [(radius, spring), (radius, floor)]
    return pts


def arc_lengths(points):
    out = [0.0]
    for a, b in zip(points, points[1:]):
        out.append(out[-1] + math.dist(a, b))
    return out


def point_at_u(points, u):
    """Point at fraction u (0..1, clamped) of the polyline's arc length."""
    lens = arc_lengths(points)
    target = max(0.0, min(1.0, u)) * lens[-1]
    for i in range(1, len(points)):
        if target <= lens[i] or i == len(points) - 1:
            seg = lens[i] - lens[i - 1]
            t = 0.0 if seg == 0 else (target - lens[i - 1]) / seg
            return tuple(float(a + (b - a) * t) for a, b in zip(points[i - 1], points[i]))
    return tuple(float(c) for c in points[0])


def resample_polyline(points, n):
    return [point_at_u(points, i / (n - 1)) for i in range(n)]


def module_positions(start, end, spacing):
    out = []
    y = start + spacing
    while y < end:
        out.append(y)
        y += spacing
    return out


VARIANTS = {
    "classic": {"tiles": 4, "grout": 4, "tile": (0.93, 0.92, 0.87), "grout_rgb": (0.55, 0.56, 0.55), "jitter": 0.0},
    "mosaic": {"tiles": 16, "grout": 2, "tile": (0.9, 0.93, 0.94), "grout_rgb": (0.6, 0.64, 0.65), "jitter": 0.015},
    "glazed": {"tiles": 4, "grout": 5, "tile": (0.95, 0.93, 0.86), "grout_rgb": (0.36, 0.37, 0.36), "jitter": 0.03},
}


def tile_pixels(variant, size=512, seed=7):
    """RGBA floats for one texture repeat (TEX_UNIT square), row-major from the bottom-left."""
    spec = VARIANTS[variant]
    tiles = spec["tiles"]
    cell = size // tiles
    grout = spec["grout"]
    rng = random.Random(seed)
    tints = [[1.0 + rng.uniform(-spec["jitter"], spec["jitter"]) for _ in range(tiles)] for _ in range(tiles)]
    out = [0.0] * (size * size * 4)
    for y in range(size):
        ty, gy = divmod(y, cell)
        for x in range(size):
            tx, gx = divmod(x, cell)
            i = (y * size + x) * 4
            if gy < grout or gx < grout:
                r, g, b = spec["grout_rgb"]
            else:
                k = tints[ty][tx]
                r, g, b = (min(1.0, c * k) for c in spec["tile"])
            out[i] = r
            out[i + 1] = g
            out[i + 2] = b
            out[i + 3] = 1.0
    return out
