import math
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

from lib import geo  # noqa: E402


class UProfile(unittest.TestCase):
    def setUp(self):
        self.pts = geo.u_profile(2.0, 2.0, -0.35, 24)

    def test_starts_and_ends_on_the_floor(self):
        self.assertEqual(self.pts[0], (-2.0, -0.35))
        self.assertEqual(self.pts[-1], (2.0, -0.35))

    def test_crown_is_spring_plus_radius(self):
        self.assertAlmostEqual(max(z for _, z in self.pts), 4.0)

    def test_is_symmetric(self):
        for (xa, za), (xb, zb) in zip(self.pts, reversed(self.pts)):
            self.assertAlmostEqual(xa, -xb)
            self.assertAlmostEqual(za, zb)

    def test_point_count(self):
        self.assertEqual(len(self.pts), 24 + 3)


class Polylines(unittest.TestCase):
    def test_arc_lengths(self):
        self.assertEqual(geo.arc_lengths([(0, 0), (3, 4), (3, 10)]), [0.0, 5.0, 11.0])

    def test_point_at_u(self):
        pts = [(0.0, 0.0, 0.0), (10.0, 0.0, 0.0)]
        self.assertEqual(geo.point_at_u(pts, 0), (0.0, 0.0, 0.0))
        self.assertEqual(geo.point_at_u(pts, 1), (10.0, 0.0, 0.0))
        self.assertEqual(geo.point_at_u(pts, 0.25), (2.5, 0.0, 0.0))
        self.assertEqual(geo.point_at_u(pts, 7), (10.0, 0.0, 0.0))

    def test_resample_is_evenly_spaced(self):
        pts = geo.resample_polyline([(0.0, 0.0, 0.0), (1.0, 0.0, 0.0), (1.0, 3.0, 0.0)], 5)
        self.assertEqual(len(pts), 5)
        gaps = [math.dist(a, b) for a, b in zip(pts, pts[1:])]
        for gap in gaps:
            self.assertAlmostEqual(gap, gaps[0], places=6)


class Modules(unittest.TestCase):
    def test_positions_exclude_the_end(self):
        self.assertEqual(geo.module_positions(0, 20, 6), [6, 12, 18])
        self.assertEqual(geo.module_positions(0, 18, 6), [6, 12])


class TilePixels(unittest.TestCase):
    def pixel(self, px, x, y, size=512):
        i = (y * size + x) * 4
        return tuple(px[i : i + 4])

    def test_size(self):
        self.assertEqual(len(geo.tile_pixels("classic")), 512 * 512 * 4)

    def test_classic_grout_and_tile(self):
        px = geo.tile_pixels("classic")
        spec = geo.VARIANTS["classic"]
        self.assertEqual(self.pixel(px, 0, 0)[:3], spec["grout_rgb"])
        self.assertEqual(self.pixel(px, 64, 64)[:3], spec["tile"])

    def test_mosaic_has_smaller_tiles(self):
        px = geo.tile_pixels("mosaic")
        spec = geo.VARIANTS["mosaic"]
        self.assertEqual(self.pixel(px, 32, 10)[:3], spec["grout_rgb"])

    def test_unknown_variant_is_rejected(self):
        with self.assertRaises(KeyError):
            geo.tile_pixels("marble")


if __name__ == "__main__":
    unittest.main()
