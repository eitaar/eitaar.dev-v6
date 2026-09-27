# eitaar.dev v6 — Plan C1: Poolrooms Scene Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder 3D scene with a Blender-generated, flooded, tiled, vaulted Poolrooms that the homepage walks through (path authored in Blender), add a dev-only `/lab` to tune it, rename the Alley to the Depths, and render tile variants for the user to choose from.

**Architecture:** A headless Blender pipeline (`scene/`) generates `scene/poolrooms.blend` from Python (`generate.py` → `lib/build.py`, pure maths in `lib/geo.py`), then `export.py` samples the Blender `CameraPath` curve into `path_NN` empties plus `anchor_*` empties and writes `public/scene/poolrooms.glb`. The browser runtime loads that `.glb`, rebuilds the camera path from the `path_NN` nodes, and keeps the existing ScrollTrigger / `gsap.ticker` architecture (ADR 0001). Anchor fractions live in one JSON file read by both the site and the exporter.

**Tech Stack:** Blender 5.2.2 LTS (headless, `bpy`/`bmesh`), Python 3 stdlib (`unittest`) for pure helpers, Node ≥ 22.12 runner, Astro 7, Three.js 0.186 (`GLTFLoader`, `OrbitControls`), GSAP 3.15, lil-gui (dev only), Vitest 5.

**Spec:** [docs/plans/2026-09-27-v6-redesign-design.md](../../plans/2026-09-27-v6-redesign-design.md), section **Scene (Plan C)**. Also [CONTEXT.md](../../../CONTEXT.md) (Poolrooms, Depths, Anchor) and [ADR 0001](../../adr/0001-webgl-background-dom-content.md). Local reference image: `.superpowers/ref/poolrooms-reference.png` (not committed).

**Not in this plan (Plan C2, after the tile choice):** Cycles light baking and lightmap UVs, realtime water (planar reflection, animated normals, caustics), the static fallback renders, Draco/meshopt/KTX2 compression, the symbolic object. C1 lights the scene with simple realtime lights so it is walkable now.

## Global Constraints

- Blender **5.2.x**, always run headless through `node scene/blender.mjs` (never call `blender` directly in scripts or docs).
- `scene/lib/geo.py` uses the Python standard library only (it must import without Blender).
- In Blender scripts prefer the data API (`bpy.data`, `bmesh`); the only `bpy.ops` calls allowed are `wm.save_as_mainfile`, `export_scene.gltf` and `render.render` (all background-safe).
- Units are metres. In Blender the passage runs along **+Y**, **Z is up**, water surface at **z = 0**, submerged tile floor at **z = −0.35**, camera **1.0 m** above the water. glTF export converts to Three.js Y-up (Blender +Y becomes Three −Z).
- Material names are exactly `Tile`, `Water`, `Void`, `Sky`, `Metal`. Camera path nodes are `path_00`…`path_NN` (zero-padded, numeric order); anchor nodes are `anchor_pool`, `anchor_depths`.
- Anchor fractions are defined only in `src/lib/scene/anchors.json`.
- Total size of `public/scene/poolrooms.glb` ≤ **6 MB** (aim for 3 MB).
- After `scene/poolrooms.blend` exists, `generate.py` must not overwrite it without `--force` (the `.blend` becomes the hand-editable source of truth).
- Vocabulary: **Depths** replaces Alley everywhere (code, CSS, copy, docs). Anchors are `entrance`, `pool`, `depths`.
- Existing architecture rules stay: scroll only via ScrollTrigger, frame work only on `gsap.ticker`, zone switch via `<html data-zone>`.
- `/lab` never ships: removed from `dist/` after build and excluded from the sitemap.
- Formatting: Biome for JS/TS/JSON; commit messages end with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- Shell: POSIX (Git Bash) from `C:/Users/eitab/Documents/js/eitaar.dev-v6`; system `python` is available for `unittest`.

## Review Focus

1. **Camera path nodes out of order or missing** (`path_10` sorting before `path_2`, a deleted empty, fewer than 2 points) — the path is rebuilt in numeric order, and too few points fail loudly so the page falls back to the static background. → Task 5 tests `pathFromNodes`.
2. **`.glb` missing, 404 or corrupt in production** — the renderer is disposed, the page shows the static background, no blank canvas. → Task 5 Step 10 (browser check with the file renamed) plus the existing `startBackground: mount failure` test.
3. **Re-running the generator over a hand-edited `.blend`** — refused unless `--force`. → Task 2 test `overwriteError`.
4. **Blender not where the runner expects** (other install path, `BLENDER` pointing at nothing) — clear message and non-zero exit, not a cryptic spawn error. → Task 2 tests `resolveBlender`.
5. **Anchor fractions edited in `anchors.json` without re-exporting**, or the `.glb` growing past budget after hand edits — the glb test fails. → Task 4 tests `anchors match anchors.json`, `stays within budget`.

---

## File Structure

| Path | Responsibility |
|---|---|
| `src/lib/scene/anchors.json` | the only definition of Anchor fractions (`pool`, `depths`) |
| `src/lib/scene/path.ts` (+ test) | Anchors, scroll→u, `depthsFactor`, `depthsExposure`, zones, `polylineU`, pointer look, damping |
| `src/lib/scene/gltf.ts` (+ test) | `pathFromNodes`: camera path from glTF node names/positions (pure) |
| `src/lib/scene/camera.ts` | `createPathCamera`: place a camera on the path at `u` |
| `src/lib/scene/poolrooms.ts` | `loadPoolrooms`: load the `.glb`, lights, fog, Depths darkening, dispose |
| `src/lib/scene/runtime.ts` | homepage renderer on `gsap.ticker` (now async, loads the glb) |
| `src/lib/scene/lab.ts`, `src/pages/lab.astro` | dev-only tuning page |
| `scene/blender.mjs` (+ `scene/blender.test.ts`) | Node runner: find Blender, guard overwrites, pass args |
| `scene/lib/geo.py` (+ `scene/tests/test_geo.py`) | pure maths: profiles, arc lengths, resampling, tile pixels |
| `scene/lib/build.py` | `bpy` scene construction (geometry, materials, lights, cameras, path) |
| `scene/generate.py` | entry: build and save `scene/poolrooms.blend` |
| `scene/export.py` | entry: sample path/anchors into empties, export `public/scene/poolrooms.glb` |
| `scene/render_tiles.py` | entry: render tile variants to `scene/renders/` |
| `scene/tests/check_blend.py` | structural checks run inside Blender |
| `scene/poolrooms-glb.test.ts` | glb budget, nodes, anchors (Vitest, reads the exported file) |
| `astro.config.mjs` | drop `dist/lab`, sitemap filter |

---

### Task 1: Rename the Alley to the Depths; Anchor fractions in JSON

**Files:**
- Create: `src/lib/scene/anchors.json`
- Modify: `src/lib/scene/path.ts`, `src/lib/scene/path.test.ts`, `src/lib/scene/scroll.ts`, `src/lib/scene/poolrooms.ts`, `src/lib/scene/runtime.ts`, `src/components/SceneBackground.astro`, `src/styles/global.css`, `src/styles/light.css`, `src/pages/index.astro`, `CLAUDE.md`

**Interfaces:**
- Consumes: existing Plan A code.
- Produces:
  - `type AnchorName = "entrance" | "pool" | "depths"`; `ANCHOR_U = { entrance: 0, pool: anchors.pool, depths: anchors.depths }` where `anchors` is `src/lib/scene/anchors.json` = `{ "pool": 0.3, "depths": 0.72 }`
  - `DEPTHS_START = ANCHOR_U.depths`, `DEPTHS_END = 1`, `depthsFactor(u: number): number` (smoothstep over `[DEPTHS_START, DEPTHS_END]`)
  - `type Zone = "pool" | "depths"`; `nextZone(current, factor)` unchanged thresholds (0.55 / 0.45)
  - `buildScrollAnchors(sections, maxScroll, minDepthsScroll = 0)`; `anchorTop("depths", …)` uses the full-viewport offset formerly used for `"turn"`
  - CSS: `.scene-bg__depths`, tokens `--content-depths`, `--bg-depths`, `:root[data-zone="depths"]`; homepage Contact section `data-anchor="depths"`
  - `Poolrooms.setDepths(factor)` (renamed from `setAlley`)

- [ ] **Step 1: Mechanical rename (refactor, suite must stay green)**

```bash
FILES="src/lib/scene/path.ts src/lib/scene/path.test.ts src/lib/scene/scroll.ts src/lib/scene/poolrooms.ts src/lib/scene/runtime.ts src/components/SceneBackground.astro src/styles/global.css src/styles/light.css src/pages/index.astro CLAUDE.md"
sed -i -E \
  -e 's/alleyFactor/depthsFactor/g; s/ALLEY_START/DEPTHS_START/g; s/ALLEY_END/DEPTHS_END/g; s/ALLEY_DARK/DEPTHS_DARK/g' \
  -e 's/setAlley/setDepths/g; s/minAlleyScroll/minDepthsScroll/g; s/alleyWall/voidWall/g' \
  -e 's/scene-bg__alley/scene-bg__depths/g; s/content-alley/content-depths/g; s/bg-alley/bg-depths/g' \
  -e 's/"alley"/"depths"/g; s/"turn"/"depths"/g; s/\.turn\b/.depths/g; s/\bturn: /depths: /g' \
  -e 's/Alley/Depths/g; s/const alley = /const depths = /g; s/alley \?/depths ?/g; s/quickSetter\(alley,/quickSetter(depths,/g' \
  $FILES
grep -rnE "alley|Alley|\"turn\"|\.turn\b" $FILES
npm test 2>&1 | grep -E "Tests |FAIL"
```
Expected: the grep prints nothing; tests pass (45). If `grep` shows a leftover (e.g. a local variable `alley` in `SceneBackground.astro`), rename it to `depths` by hand and re-run.

- [ ] **Step 2: Write the failing tests for JSON-driven Anchors and darkening to the page end**

Append to `src/lib/scene/path.test.ts` (and add `depthsExposure` to its import list from `./path`):
```ts
import anchors from "./anchors.json";

describe("ANCHOR_U from anchors.json", () => {
	it("reads pool and depths from the shared JSON", () => {
		expect(ANCHOR_U.pool).toBe(anchors.pool);
		expect(ANCHOR_U.depths).toBe(anchors.depths);
		expect(ANCHOR_U.entrance).toBe(0);
	});
});

describe("depthsFactor keeps darkening to the end of the page", () => {
	it("is still below 1 just before the end and reaches 1 at u = 1", () => {
		expect(depthsFactor(0.97)).toBeLessThan(1);
		expect(depthsFactor(1)).toBe(1);
	});
});

describe("depthsExposure", () => {
	it("is full exposure in Poolrooms and as dim as allowed at the far end", () => {
		expect(depthsExposure(0)).toBe(1);
		expect(depthsExposure(1)).toBeCloseTo(0.12);
	});
	it("never goes fully black", () => {
		expect(depthsExposure(1)).toBeGreaterThan(0);
	});
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npm test -- src/lib/scene/path.test.ts`
Expected: FAIL — cannot resolve `./anchors.json` / `depthsExposure` is not exported.

- [ ] **Step 4: Implement**

Create `src/lib/scene/anchors.json`:
```json
{
	"pool": 0.3,
	"depths": 0.72
}
```
In `src/lib/scene/path.ts` add `import anchors from "./anchors.json";` at the top and replace the `ANCHOR_U` definition and the Depths constants with:
```ts
export const ANCHOR_U: Record<AnchorName, number> = {
	entrance: 0,
	pool: anchors.pool,
	depths: anchors.depths,
};
```
```ts
export const DEPTHS_START = ANCHOR_U.depths;
export const DEPTHS_END = 1;
```
Add below `depthsFactor`:
```ts
const DEPTHS_MIN_EXPOSURE = 0.12;

/** Tone-mapping exposure for the Depths: dims as far as it can without going black. */
export function depthsExposure(factor: number): number {
	return 1 - (1 - DEPTHS_MIN_EXPOSURE) * clamp(factor, 0, 1);
}
```

- [ ] **Step 5: Run to verify pass, typecheck, build**

```bash
npm test 2>&1 | grep -E "Tests |FAIL"; npx astro check 2>&1 | grep -E "errors"; npm run build > .superpowers/c1-t1.log 2>&1; echo build=$?
grep -o 'data-anchor="[a-z]*"' dist/index.html
```
Expected: all tests pass; `0 errors`; build=0; anchors print `entrance`, `pool`, `depths`.

- [ ] **Step 6: Commit**

```bash
npx biome check --write src/lib/scene src/components/SceneBackground.astro src/styles src/pages/index.astro
git add -A
git commit -m "refactor: rename the Alley to the Depths; Anchor fractions in anchors.json

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Scene tooling — Blender runner and pure geometry helpers

**Files:**
- Create: `scene/blender.mjs`, `scene/blender.test.ts`, `scene/lib/__init__.py`, `scene/lib/geo.py`, `scene/tests/test_geo.py`
- Modify: `vitest.config.ts`, `package.json`, `.gitignore`, `CLAUDE.md`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `scene/blender.mjs`: `resolveBlender(env?, exists?) → string` (throws if `env.BLENDER` points at a missing file), `overwriteError(target, force, exists?) → string | null`, `parseArgs(argv) → { blend?: string; script?: string; force: boolean; passthrough: string[] }`; CLI `node scene/blender.mjs [--blend file.blend] script.py [--force] [-- args]`
  - `scene/lib/geo.py`: `TILE = 0.1`, `TEX_UNIT = 0.4`, `u_profile(radius, spring, floor, segments) → list[(x, z)]` (length `segments + 3`), `arc_lengths(points) → list[float]`, `point_at_u(points, u) → tuple`, `resample_polyline(points, n) → list[tuple]`, `module_positions(start, end, spacing) → list[float]` (end exclusive), `VARIANTS` (`classic`, `mosaic`, `glazed`), `tile_pixels(variant, size=512, seed=7) → list[float]` (RGBA, row-major from the bottom-left, as `Image.pixels`)
  - npm scripts: `scene:gen`, `scene:export`, `scene:tiles`, `scene:test`

- [ ] **Step 1: Write the failing runner tests**

Add `"scene/**/*.test.ts"` to `test.include` in `vitest.config.ts` (so it reads `include: ["src/**/*.test.ts", "scene/**/*.test.ts"]`), then create `scene/blender.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { overwriteError, parseArgs, resolveBlender } from "./blender.mjs";

const WIN = "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe";

describe("resolveBlender", () => {
	it("prefers the BLENDER environment variable when it exists", () => {
		expect(resolveBlender({ BLENDER: "/opt/blender" }, (p) => p === "/opt/blender")).toBe("/opt/blender");
	});
	it("explains a BLENDER variable that points at nothing", () => {
		expect(() => resolveBlender({ BLENDER: "/nope" }, () => false)).toThrow(/BLENDER is set to "\/nope"/);
	});
	it("finds the default Windows install", () => {
		expect(resolveBlender({}, (p) => p === WIN)).toBe(WIN);
	});
	it("falls back to blender on PATH", () => {
		expect(resolveBlender({}, () => false)).toBe("blender");
	});
});

describe("overwriteError", () => {
	it("refuses to regenerate over an existing .blend without --force", () => {
		expect(overwriteError("scene/poolrooms.blend", false, () => true)).toMatch(/--force/);
	});
	it("allows it with --force", () => {
		expect(overwriteError("scene/poolrooms.blend", true, () => true)).toBeNull();
	});
	it("allows the first generation", () => {
		expect(overwriteError("scene/poolrooms.blend", false, () => false)).toBeNull();
	});
});

describe("parseArgs", () => {
	it("splits runner flags from the script and passthrough args", () => {
		expect(parseArgs(["--blend", "a.blend", "s.py", "--force", "--", "mosaic"])).toEqual({
			blend: "a.blend",
			script: "s.py",
			force: true,
			passthrough: ["mosaic"],
		});
	});
	it("works without --blend or passthrough", () => {
		expect(parseArgs(["s.py"])).toEqual({ blend: undefined, script: "s.py", force: false, passthrough: [] });
	});
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- scene/blender.test.ts`
Expected: FAIL — cannot resolve `./blender.mjs`.

- [ ] **Step 3: Implement `scene/blender.mjs`**

```js
#!/usr/bin/env node
// Runs a Blender Python script headless. Usage:
//   node scene/blender.mjs [--blend file.blend] script.py [--force] [-- args for the script]
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_PATHS = [
	"C:/Program Files/Blender Foundation/Blender 5.2/blender.exe",
	"/Applications/Blender.app/Contents/MacOS/Blender",
];
const BLEND = "scene/poolrooms.blend";

/**
 * @param {Record<string, string | undefined>} env
 * @param {(path: string) => boolean} exists
 * @returns {string}
 */
export function resolveBlender(env = process.env, exists = existsSync) {
	if (env.BLENDER) {
		if (!exists(env.BLENDER)) {
			throw new Error(`BLENDER is set to "${env.BLENDER}", but no file exists there.`);
		}
		return env.BLENDER;
	}
	return DEFAULT_PATHS.find((path) => exists(path)) ?? "blender";
}

/**
 * Refuse to regenerate over a .blend that may hold hand edits.
 * @param {string} target
 * @param {boolean} force
 * @param {(path: string) => boolean} exists
 * @returns {string | null}
 */
export function overwriteError(target, force, exists = existsSync) {
	if (force || !exists(target)) return null;
	return `${target} already exists and may contain hand edits. Re-run with --force to regenerate it.`;
}

/**
 * @param {string[]} argv
 * @returns {{ blend: string | undefined, script: string | undefined, force: boolean, passthrough: string[] }}
 */
export function parseArgs(argv) {
	const sep = argv.indexOf("--");
	const own = sep === -1 ? argv : argv.slice(0, sep);
	const passthrough = sep === -1 ? [] : argv.slice(sep + 1);
	const blendAt = own.indexOf("--blend");
	const blend = blendAt === -1 ? undefined : own[blendAt + 1];
	const rest = own.filter((arg, i) => arg !== "--force" && i !== blendAt && i !== blendAt + 1);
	return { blend, script: rest[0], force: own.includes("--force"), passthrough };
}

function main() {
	const { blend, script, force, passthrough } = parseArgs(process.argv.slice(2));
	if (!script) {
		console.error("usage: node scene/blender.mjs [--blend file.blend] script.py [--force] [-- args]");
		process.exit(2);
	}
	if (script.endsWith("generate.py")) {
		const error = overwriteError(BLEND, force);
		if (error) {
			console.error(error);
			process.exit(1);
		}
	}
	if (blend && !existsSync(blend)) {
		console.error(`${blend} not found. Run "npm run scene:gen" first.`);
		process.exit(1);
	}
	let blender;
	try {
		blender = resolveBlender();
	} catch (error) {
		console.error(error instanceof Error ? error.message : error);
		process.exit(1);
	}
	const args = [
		"--background",
		...(blend ? [blend] : ["--factory-startup"]),
		"--python-exit-code",
		"1",
		"--python",
		script,
		"--",
		...passthrough,
	];
	const result = spawnSync(blender, args, { stdio: "inherit" });
	if (result.error) {
		console.error(
			`Could not start Blender at "${blender}": ${result.error.message}. Set BLENDER to your blender executable.`,
		);
		process.exit(1);
	}
	process.exit(result.status ?? 1);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- scene/blender.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Write the failing geometry tests**

Create `scene/lib/__init__.py` (empty file) and `scene/tests/test_geo.py`:
```python
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
```

- [ ] **Step 6: Run to verify failure**

Run: `python -m unittest discover -s scene/tests -p "test_*.py"`
Expected: FAIL/ERROR — `cannot import name 'geo'` (module missing).

- [ ] **Step 7: Implement `scene/lib/geo.py`**

```python
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
```

- [ ] **Step 8: Run to verify pass**

Run: `python -m unittest discover -s scene/tests -p "test_*.py"`
Expected: `OK` (11 tests).

- [ ] **Step 9: Wire scripts and ignore rules**

`package.json` `scripts` — add:
```json
"scene:gen": "node scene/blender.mjs scene/generate.py",
"scene:export": "node scene/blender.mjs --blend scene/poolrooms.blend scene/export.py",
"scene:tiles": "node scene/blender.mjs --blend scene/poolrooms.blend scene/render_tiles.py",
"scene:test": "python -m unittest discover -s scene/tests -p \"test_*.py\" && node scene/blender.mjs --blend scene/poolrooms.blend scene/tests/check_blend.py"
```
Append to `.gitignore`:
```
# Blender
*.blend1
scene/renders/
__pycache__/
```
In `CLAUDE.md` add under `## Commands`:
```markdown
Scene (Blender 5.2, headless via `scene/blender.mjs`; set `BLENDER` if Blender is elsewhere):

```bash
npm run scene:gen      # first generation of scene/poolrooms.blend (refuses to overwrite without --force)
npm run scene:export   # sample CameraPath + anchors, write public/scene/poolrooms.glb
npm run scene:tiles    # render tile variants to scene/renders/
npm run scene:test     # python unit tests + structural checks inside Blender
```

After the first generation, `scene/poolrooms.blend` is the source of truth and may be edited by hand in Blender; re-export after edits.
```

- [ ] **Step 10: Commit**

```bash
npx biome check --write scene/blender.mjs scene/blender.test.ts vitest.config.ts package.json
git add -A
git commit -m "feat: headless Blender runner and pure scene geometry helpers

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Generate the Poolrooms `.blend`

**Files:**
- Create: `scene/lib/build.py`, `scene/generate.py`, `scene/tests/check_blend.py`, `scene/poolrooms.blend` (generated, committed)

**Interfaces:**
- Consumes: `geo.*` (Task 2), runner (Task 2).
- Produces (inside `scene/poolrooms.blend`):
  - Tile surfaces: `PassageA` (y 0–20, r 2), `Hall` (y 20–40, r 4), `PassageB` (y 40–92, r 2), `EntranceWall`, `HallEntry`, `HallExit`, `Rib*`, `FarWall`, `FarDoorway`, `FarDoorwayEnd`
  - `Water*` planes at z = 0, `SideCut0..4` (hidden cutters), `SideStub0..4` + `SideStubEnd0..4` (Void), `SkyCut0..1` (hidden), `SkyLight0..1` (Sky), `Ladder0..2` (Metal)
  - `CameraPath` (Bezier, 6 points, z = 1.0), `Sun`, cameras `RenderEntrance`, `RenderHall`, Cycles/AgX render settings
  - packed image `tile`, materials `Tile`, `Water`, `Void`, `Sky`, `Metal`
  - `build.build_scene(variant="classic")`, `build.set_tile_variant(variant)`

- [ ] **Step 1: Write the structural check (the failing test)**

Create `scene/tests/check_blend.py`:
```python
"""Structural checks for scene/poolrooms.blend. Runs inside Blender (npm run scene:test)."""

import sys

import bpy

errors = []


def need(condition, message):
    if not condition:
        errors.append(message)


names = set(bpy.data.objects.keys())
for name in [
    "PassageA", "Hall", "PassageB", "EntranceWall", "HallEntry", "HallExit",
    "FarWall", "FarDoorway", "WaterPassageA", "WaterHall", "WaterPassageB",
    "CameraPath", "Sun", "RenderEntrance", "RenderHall",
]:
    need(name in names, f"missing object {name}")

for prefix, count in [("SideCut", 5), ("SideStub", 5), ("SkyCut", 2), ("SkyLight", 2), ("Ladder", 3), ("Rib", 10)]:
    found = [n for n in names if n.startswith(prefix) and not n.startswith("SideStubEnd")]
    need(len(found) >= count, f"expected at least {count} {prefix}* objects, found {len(found)}")

for material in ["Tile", "Water", "Void", "Sky", "Metal"]:
    need(material in bpy.data.materials, f"missing material {material}")

path = bpy.data.objects.get("CameraPath")
need(path is not None and path.type == "CURVE", "CameraPath must be a curve")
if path is not None and path.type == "CURVE":
    points = path.data.splines[0].bezier_points
    need(len(points) >= 5, "CameraPath needs at least 5 points")
    need(all(abs(p.co.z - 1.0) < 1e-6 for p in points), "CameraPath must sit 1.0 m above the water")

image = bpy.data.images.get("tile")
need(image is not None and image.packed_file is not None, "tile image must be packed into the .blend")

for cutter in [o for o in bpy.data.objects if o.name.startswith(("SideCut", "SkyCut"))]:
    need(cutter.hide_render, f"{cutter.name} must be hidden from render/export")

if errors:
    print("check_blend: FAILED\n  " + "\n  ".join(errors))
    sys.exit(1)
print("check_blend: ok")
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run scene:test`
Expected: unit tests OK, then `scene/poolrooms.blend not found. Run "npm run scene:gen" first.` and exit code 1.

- [ ] **Step 3: Implement `scene/lib/build.py`**

```python
"""Builds the Poolrooms scene with bpy. Runs inside Blender only."""

import math

import bmesh
import bpy
from mathutils import Vector

from . import geo

PASSAGE_R = 2.0
HALL_R = 4.0
SPRING = 2.0
FLOOR = -0.35
SEG = 24
RIB_T = 0.5
RIB_INSET = 0.3
TEX = geo.TEX_UNIT
CAMERA_Z = 1.0
FAR_WALL_Y = 92.0

SECTIONS = [("PassageA", 0.0, 20.0, PASSAGE_R), ("Hall", 20.0, 40.0, HALL_R), ("PassageB", 40.0, 92.0, PASSAGE_R)]
SIDE_OPENINGS = [9.0, 15.0, 50.0, 62.0, 74.0]
SKYLIGHTS = [26.0, 34.0]
LADDERS = [(PASSAGE_R, 11.0), (HALL_R, 30.0), (PASSAGE_R, 56.0)]
CAMERA_PATH = [(0.0, 1.0), (0.3, 14.0), (-0.4, 30.0), (0.2, 46.0), (-0.2, 62.0), (0.0, 78.0)]


# --- helpers -----------------------------------------------------------------

def _link(obj):
    bpy.context.scene.collection.objects.link(obj)
    return obj


def _mesh_object(name, bm, material):
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    mesh.materials.append(material)
    return _link(bpy.data.objects.new(name, mesh))


def _face(bm, uv, verts, uvs):
    face = bm.faces.new(verts)
    for loop, coord in zip(face.loops, uvs):
        loop[uv].uv = coord
    return face


def _new_bm():
    bm = bmesh.new()
    return bm, bm.loops.layers.uv.new("UVMap")


def _material(name):
    mat = bpy.data.materials.new(name)
    try:
        mat.use_nodes = True
    except AttributeError:
        pass
    return mat, mat.node_tree.nodes["Principled BSDF"]


# --- scene -------------------------------------------------------------------

def clear():
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for datablocks in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.images,
                       bpy.data.lights, bpy.data.cameras):
        for block in list(datablocks):
            datablocks.remove(block)


def set_tile_variant(variant):
    image = bpy.data.images.get("tile") or bpy.data.images.new("tile", 512, 512, alpha=False)
    image.file_format = "PNG"
    image.pixels.foreach_set(geo.tile_pixels(variant))
    image.pack()
    return image


def make_materials(variant):
    image = set_tile_variant(variant)

    tile, bsdf = _material("Tile")
    tex = tile.node_tree.nodes.new("ShaderNodeTexImage")
    tex.image = image
    tile.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.18
    tile.use_backface_culling = False

    water, bsdf = _material("Water")
    bsdf.inputs["Base Color"].default_value = (0.32, 0.72, 0.70, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.04
    bsdf.inputs["Alpha"].default_value = 0.5
    try:
        water.surface_render_method = "BLENDED"
    except AttributeError:
        pass

    void, bsdf = _material("Void")
    bsdf.inputs["Base Color"].default_value = (0.008, 0.009, 0.01, 1.0)
    bsdf.inputs["Roughness"].default_value = 1.0
    void.use_backface_culling = False

    sky, bsdf = _material("Sky")
    bsdf.inputs["Base Color"].default_value = (0.0, 0.0, 0.0, 1.0)
    bsdf.inputs["Emission Color"].default_value = (1.0, 0.97, 0.92, 1.0)
    bsdf.inputs["Emission Strength"].default_value = 6.0

    metal, bsdf = _material("Metal")
    bsdf.inputs["Base Color"].default_value = (0.52, 0.6, 0.68, 1.0)
    bsdf.inputs["Metallic"].default_value = 1.0
    bsdf.inputs["Roughness"].default_value = 0.3

    return {"Tile": tile, "Water": water, "Void": void, "Sky": sky, "Metal": metal}


def build_section(name, y0, y1, radius, material, spring=SPRING):
    """Vaulted passage: U surface extruded along +Y plus the submerged floor. UVs in TEX units."""
    bm, uv = _new_bm()
    prof = geo.u_profile(radius, spring, FLOOR, SEG)
    lens = geo.arc_lengths(prof)
    for i in range(len(prof) - 1):
        (xa, za), (xb, zb) = prof[i], prof[i + 1]
        verts = [bm.verts.new((xa, y0, za)), bm.verts.new((xb, y0, zb)),
                 bm.verts.new((xb, y1, zb)), bm.verts.new((xa, y1, za))]
        _face(bm, uv, verts, [(lens[i] / TEX, y0 / TEX), (lens[i + 1] / TEX, y0 / TEX),
                              (lens[i + 1] / TEX, y1 / TEX), (lens[i] / TEX, y1 / TEX)])
    floor = [bm.verts.new((-radius, y0, FLOOR)), bm.verts.new((-radius, y1, FLOOR)),
             bm.verts.new((radius, y1, FLOOR)), bm.verts.new((radius, y0, FLOOR))]
    _face(bm, uv, floor, [(-radius / TEX, y0 / TEX), (-radius / TEX, y1 / TEX),
                          (radius / TEX, y1 / TEX), (radius / TEX, y0 / TEX)])
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    return _mesh_object(name, bm, material)


def build_wall(name, y, thickness, outer_r, inner_r, material, inner_spring=SPRING):
    """Arch frame across the passage: faces between the outer and inner U on both planes, plus the soffit."""
    bm, uv = _new_bm()
    outer = geo.u_profile(outer_r, SPRING, FLOOR, SEG)
    inner = geo.u_profile(inner_r, inner_spring, FLOOR, SEG)
    ya, yb = y - thickness / 2, y + thickness / 2
    for yy in (ya, yb):
        for i in range(len(outer) - 1):
            pts = [outer[i], outer[i + 1], inner[i + 1], inner[i]]
            verts = [bm.verts.new((x, yy, z)) for x, z in pts]
            _face(bm, uv, verts, [(x / TEX, z / TEX) for x, z in pts])
    lens = geo.arc_lengths(inner)
    for i in range(len(inner) - 1):
        (xa, za), (xb, zb) = inner[i], inner[i + 1]
        verts = [bm.verts.new((xa, ya, za)), bm.verts.new((xb, ya, zb)),
                 bm.verts.new((xb, yb, zb)), bm.verts.new((xa, yb, za))]
        _face(bm, uv, verts, [(lens[i] / TEX, ya / TEX), (lens[i + 1] / TEX, ya / TEX),
                              (lens[i + 1] / TEX, yb / TEX), (lens[i] / TEX, yb / TEX)])
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    return _mesh_object(name, bm, material)


def build_cap(name, y, radius, material, spring=SPRING):
    """Closed end wall: one n-gon over the U profile (the floor edge closes it)."""
    bm, uv = _new_bm()
    prof = geo.u_profile(radius, spring, FLOOR, SEG)
    verts = [bm.verts.new((x, y, z)) for x, z in prof]
    _face(bm, uv, verts, [(x / TEX, z / TEX) for x, z in prof])
    return _mesh_object(name, bm, material)


def build_water(name, y0, y1, radius, material):
    bm, uv = _new_bm()
    verts = [bm.verts.new((-radius, y0, 0.0)), bm.verts.new((radius, y0, 0.0)),
             bm.verts.new((radius, y1, 0.0)), bm.verts.new((-radius, y1, 0.0))]
    _face(bm, uv, verts, [(-radius / TEX, y0 / TEX), (radius / TEX, y0 / TEX),
                          (radius / TEX, y1 / TEX), (-radius / TEX, y1 / TEX)])
    return _mesh_object(name, bm, material)


def _prism_x(name, y, profile, x0, x1, material):
    """Closed prism along X whose cross-section (in the YZ plane) is `profile` offset to y."""
    bm, uv = _new_bm()
    ring0 = [bm.verts.new((x0, y + px, z)) for px, z in profile]
    ring1 = [bm.verts.new((x1, y + px, z)) for px, z in profile]
    n = len(profile)
    for i in range(n):
        j = (i + 1) % n
        _face(bm, uv, [ring0[i], ring0[j], ring1[j], ring1[i]],
              [((y + profile[i][0]) / TEX, profile[i][1] / TEX), ((y + profile[j][0]) / TEX, profile[j][1] / TEX),
               ((y + profile[j][0]) / TEX, profile[j][1] / TEX + 1), ((y + profile[i][0]) / TEX, profile[i][1] / TEX + 1)])
    _face(bm, uv, list(reversed(ring0)), [((y + px) / TEX, z / TEX) for px, z in reversed(profile)])
    _face(bm, uv, ring1, [((y + px) / TEX, z / TEX) for px, z in profile])
    return _mesh_object(name, bm, material)


def _boolean(target, cutter):
    mod = target.modifiers.new(f"Cut{cutter.name}", "BOOLEAN")
    mod.operation = "DIFFERENCE"
    mod.object = cutter
    mod.solver = "EXACT"
    mod.use_hole_tolerant = True
    mod.material_mode = "TRANSFER"
    cutter.hide_render = True
    cutter.display_type = "WIRE"


def _section_at(sections, y):
    return next(obj for obj, y0, y1, r in sections if y0 < y < y1), \
        next(r for obj, y0, y1, r in sections if y0 < y < y1)


def build_side_opening(index, y, sections, mats):
    target, radius = _section_at(sections, y)
    profile = geo.u_profile(1.1, 1.4, FLOOR + 0.02, 16)
    cutter = _prism_x(f"SideCut{index}", y, profile, -radius - 0.6, -radius + 0.6, mats["Tile"])
    _boolean(target, cutter)
    stub = build_section(f"SideStub{index}", 0.0, 3.0, 1.1, mats["Void"], spring=1.4)
    end = build_cap(f"SideStubEnd{index}", 3.0, 1.1, mats["Void"], spring=1.4)
    for obj in (stub, end):
        obj.rotation_euler = (0.0, 0.0, math.radians(90))  # local +Y becomes world -X
        obj.location = (-radius, y, 0.0)


def build_skylight(index, y, hall, mats):
    crown = SPRING + HALL_R
    bm, uv = _new_bm()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * 1.6, y + v.co.y * 1.6, crown + v.co.z * 2.0))
    cutter = _mesh_object(f"SkyCut{index}", bm, mats["Tile"])
    _boolean(hall, cutter)
    bm, uv = _new_bm()
    z = crown + 0.4
    verts = [bm.verts.new((-0.8, y - 0.8, z)), bm.verts.new((0.8, y - 0.8, z)),
             bm.verts.new((0.8, y + 0.8, z)), bm.verts.new((-0.8, y + 0.8, z))]
    _face(bm, uv, verts, [(0, 0), (1, 0), (1, 1), (0, 1)])
    _mesh_object(f"SkyLight{index}", bm, mats["Sky"])


def build_ladder(index, wall_x, y, material):
    x = wall_x - 0.12
    pts = [(x, y - 0.25, -0.3), (x, y - 0.25, 1.05)]
    pts += [(x, y - 0.25 * math.cos(a), 1.05 + 0.25 * math.sin(a)) for a in (math.pi * i / 8 for i in range(1, 8))]
    pts += [(x, y + 0.25, 1.05), (x, y + 0.25, -0.3)]
    curve = bpy.data.curves.new(f"Ladder{index}Curve", "CURVE")
    curve.dimensions = "3D"
    curve.bevel_depth = 0.022
    curve.bevel_resolution = 4
    spline = curve.splines.new("POLY")
    spline.points.add(len(pts) - 1)
    for point, co in zip(spline.points, pts):
        point.co = (*co, 1.0)
    curve_obj = _link(bpy.data.objects.new(f"Ladder{index}Curve", curve))
    depsgraph = bpy.context.evaluated_depsgraph_get()
    mesh = bpy.data.meshes.new_from_object(curve_obj.evaluated_get(depsgraph))
    mesh.materials.clear()
    mesh.materials.append(material)
    _link(bpy.data.objects.new(f"Ladder{index}", mesh))
    bpy.data.objects.remove(curve_obj, do_unlink=True)
    bpy.data.curves.remove(curve)


def build_camera_path():
    curve = bpy.data.curves.new("CameraPath", "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 24
    spline = curve.splines.new("BEZIER")
    spline.bezier_points.add(len(CAMERA_PATH) - 1)
    for point, (x, y) in zip(spline.bezier_points, CAMERA_PATH):
        point.co = (x, y, CAMERA_Z)
        point.handle_left_type = "AUTO"
        point.handle_right_type = "AUTO"
    return _link(bpy.data.objects.new("CameraPath", curve))


def _camera(name, location, target):
    data = bpy.data.cameras.new(name)
    data.lens = 20
    obj = _link(bpy.data.objects.new(name, data))
    obj.location = location
    obj.rotation_euler = (Vector(target) - Vector(location)).to_track_quat("-Z", "Y").to_euler()
    return obj


def build_lighting_and_render():
    sun_data = bpy.data.lights.new("Sun", "SUN")
    sun_data.energy = 4.0
    sun_data.angle = math.radians(6)
    sun = _link(bpy.data.objects.new("Sun", sun_data))
    sun.rotation_euler = (math.radians(18), math.radians(-22), 0.0)

    scene = bpy.context.scene
    world = scene.world or bpy.data.worlds.new("World")
    scene.world = world
    try:
        world.use_nodes = True
    except AttributeError:
        pass
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.78, 0.84, 0.86, 1.0)
    background.inputs["Strength"].default_value = 0.35

    _camera("RenderEntrance", (0.0, 1.0, CAMERA_Z), (0.0, 30.0, 1.4))
    _camera("RenderHall", (-2.5, 23.0, 1.2), (1.5, 36.0, 2.2))
    scene.camera = bpy.data.objects["RenderEntrance"]
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 64
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 1280
    scene.render.resolution_y = 800
    scene.view_settings.view_transform = "AgX"


def build_scene(variant="classic"):
    clear()
    mats = make_materials(variant)
    sections = []
    for name, y0, y1, radius in SECTIONS:
        sections.append((build_section(name, y0, y1, radius, mats["Tile"]), y0, y1, radius))
        build_water(f"Water{name}", y0, y1, radius, mats["Water"])
        if radius == PASSAGE_R:
            for i, y in enumerate(geo.module_positions(y0, y1, 6.0)):
                build_wall(f"Rib{name}{i}", y, RIB_T, radius, radius - RIB_INSET, mats["Tile"])

    build_cap("EntranceWall", 0.0, PASSAGE_R, mats["Tile"])
    build_wall("HallEntry", 20.0, 0.6, HALL_R, PASSAGE_R, mats["Tile"])
    build_wall("HallExit", 40.0, 0.6, HALL_R, PASSAGE_R, mats["Tile"])
    build_wall("FarWall", FAR_WALL_Y, 0.4, PASSAGE_R, 0.9, mats["Tile"], inner_spring=1.3)
    build_section("FarDoorway", FAR_WALL_Y + 0.2, FAR_WALL_Y + 4.0, 0.9, mats["Void"], spring=1.3)
    build_cap("FarDoorwayEnd", FAR_WALL_Y + 4.0, 0.9, mats["Void"], spring=1.3)

    for i, y in enumerate(SIDE_OPENINGS):
        build_side_opening(i, y, sections, mats)
    hall = next(obj for obj, _, _, _ in sections if obj.name == "Hall")
    for i, y in enumerate(SKYLIGHTS):
        build_skylight(i, y, hall, mats)
    for i, (radius, y) in enumerate(LADDERS):
        build_ladder(i, radius, y, mats["Metal"])

    build_camera_path()
    build_lighting_and_render()
```

- [ ] **Step 4: Implement `scene/generate.py`**

```python
"""Generate scene/poolrooms.blend. Run via: npm run scene:gen [-- --force] [-- <variant>]"""

import os
import sys

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from lib import build  # noqa: E402

args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
variant = args[0] if args else "classic"

build.build_scene(variant)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, "poolrooms.blend"))
print(f"generate: wrote scene/poolrooms.blend (tiles: {variant})")
```

- [ ] **Step 5: Generate and run the checks**

```bash
npm run scene:gen 2>&1 | tail -3
npm run scene:test 2>&1 | tail -3
ls -la scene/poolrooms.blend
```
Expected: `generate: wrote scene/poolrooms.blend (tiles: classic)`; unit tests `OK`; `check_blend: ok`; the `.blend` exists. If Blender reports an API error (a renamed enum or input in 5.2), fix the smallest thing in `build.py`, ledger it as a ruling, and re-run with `npm run scene:gen -- --force` (the first-generation guard now applies).

- [ ] **Step 6: Guard check**

Run: `npm run scene:gen; echo exit=$?`
Expected: the "already exists and may contain hand edits" message and `exit=1`.

- [ ] **Step 7: Commit**

```bash
git add scene/lib/build.py scene/generate.py scene/tests/check_blend.py scene/poolrooms.blend
git commit -m "feat: generate the flooded, vaulted Poolrooms in Blender

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Export `poolrooms.glb` with the camera path and Anchors

**Files:**
- Create: `scene/export.py`, `scene/poolrooms-glb.test.ts`, `public/scene/poolrooms.glb` (generated, committed)
- Modify: `src/lib/scene/path.ts`, `src/lib/scene/path.test.ts`

**Interfaces:**
- Consumes: `scene/poolrooms.blend` (Task 3), `anchors.json` (Task 1), `geo.resample_polyline`, `geo.point_at_u`.
- Produces:
  - `polylineU(points: readonly (readonly [number, number, number])[], target: readonly [number, number, number]): number` in `path.ts`
  - `public/scene/poolrooms.glb` containing nodes `path_00`…`path_23` (24, evenly spaced along `CameraPath`) and `anchor_pool`, `anchor_depths`, meshes with materials `Tile`, `Water`, `Void`, `Sky`, `Metal`; no cutters, cameras or lights

- [ ] **Step 1: Write the failing `polylineU` test**

Append to `src/lib/scene/path.test.ts` (add `polylineU` to the import):
```ts
describe("polylineU", () => {
	const line = [
		[0, 0, 0],
		[10, 0, 0],
		[10, 0, 10],
	] as const;
	it("is 0 at the start and 1 at the end", () => {
		expect(polylineU(line, [0, 0, 0])).toBe(0);
		expect(polylineU(line, [10, 0, 10])).toBe(1);
	});
	it("projects a point onto the nearest segment", () => {
		expect(polylineU(line, [5, 3, 0])).toBeCloseTo(0.25);
		expect(polylineU(line, [12, 0, 5])).toBeCloseTo(0.75);
	});
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/lib/scene/path.test.ts`
Expected: FAIL — `polylineU` is not exported.

- [ ] **Step 3: Implement `polylineU` in `path.ts`**

```ts
type Vec3 = readonly [number, number, number];

/** Fraction (0..1) of the polyline's length at the point nearest to `target`. */
export function polylineU(points: readonly Vec3[], target: Vec3): number {
	let walked = 0;
	let best = { dist: Number.POSITIVE_INFINITY, at: 0 };
	for (let i = 1; i < points.length; i++) {
		const a = points[i - 1];
		const b = points[i];
		const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
		const len2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2;
		const len = Math.sqrt(len2);
		const t =
			len2 === 0
				? 0
				: clamp(
						((target[0] - a[0]) * ab[0] + (target[1] - a[1]) * ab[1] + (target[2] - a[2]) * ab[2]) /
							len2,
						0,
						1,
					);
		const p = [a[0] + ab[0] * t, a[1] + ab[1] * t, a[2] + ab[2] * t];
		const dist = Math.hypot(target[0] - p[0], target[1] - p[1], target[2] - p[2]);
		if (dist < best.dist) best = { dist, at: walked + len * t };
		walked += len;
	}
	return walked === 0 ? 0 : best.at / walked;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- src/lib/scene/path.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing glb test**

Create `scene/poolrooms-glb.test.ts`:
```ts
import { readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import anchors from "../src/lib/scene/anchors.json";
import { polylineU } from "../src/lib/scene/path";

const GLB = new URL("../public/scene/poolrooms.glb", import.meta.url);
const MAX_BYTES = 6 * 1024 * 1024;

type Node = { name?: string; translation?: [number, number, number] };

function readGlbJson(buffer: Buffer): { nodes: Node[]; materials?: { name?: string }[] } {
	if (buffer.readUInt32LE(0) !== 0x46546c67) throw new Error("not a GLB file");
	const length = buffer.readUInt32LE(12);
	if (buffer.readUInt32LE(16) !== 0x4e4f534a) throw new Error("first GLB chunk is not JSON");
	return JSON.parse(buffer.subarray(20, 20 + length).toString("utf8"));
}

const json = readGlbJson(readFileSync(GLB));
const byName = new Map(json.nodes.map((n) => [n.name, n]));
const path = json.nodes
	.filter((n) => /^path_\d+$/.test(n.name ?? ""))
	.sort((a, b) => Number(a.name?.slice(5)) - Number(b.name?.slice(5)))
	.map((n) => n.translation ?? [0, 0, 0]);

describe("poolrooms.glb", () => {
	it("stays within budget", () => {
		expect(statSync(GLB).size).toBeLessThanOrEqual(MAX_BYTES);
	});

	it("carries a contiguous camera path", () => {
		expect(path.length).toBeGreaterThanOrEqual(8);
		path.forEach((_, i) => {
			expect(byName.has(`path_${String(i).padStart(2, "0")}`)).toBe(true);
		});
	});

	it("anchors match anchors.json", () => {
		for (const key of ["pool", "depths"] as const) {
			const node = byName.get(`anchor_${key}`);
			expect(node, `anchor_${key}`).toBeDefined();
			expect(polylineU(path, node?.translation ?? [0, 0, 0])).toBeCloseTo(anchors[key], 1);
		}
	});

	it("uses the named materials and exports no cutters", () => {
		const materials = new Set(json.materials?.map((m) => m.name));
		for (const name of ["Tile", "Water", "Void", "Sky", "Metal"]) expect(materials.has(name)).toBe(true);
		expect(json.nodes.some((n) => /^(SideCut|SkyCut)/.test(n.name ?? ""))).toBe(false);
	});
});
```

- [ ] **Step 6: Run to verify failure**

Run: `npm test -- scene/poolrooms-glb.test.ts`
Expected: FAIL — `ENOENT` for `public/scene/poolrooms.glb`.

- [ ] **Step 7: Implement `scene/export.py`**

```python
"""Export public/scene/poolrooms.glb from scene/poolrooms.blend. Run via: npm run scene:export"""

import json
import os
import sys

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)

from lib import geo  # noqa: E402

PATH_SAMPLES = 24

with open(os.path.join(ROOT, "src", "lib", "scene", "anchors.json"), encoding="utf-8") as f:
    anchors = json.load(f)

path_obj = bpy.data.objects["CameraPath"]
depsgraph = bpy.context.evaluated_depsgraph_get()
evaluated = path_obj.evaluated_get(depsgraph)
mesh = evaluated.to_mesh()
points = [tuple(path_obj.matrix_world @ v.co) for v in mesh.vertices]
evaluated.to_mesh_clear()
samples = geo.resample_polyline(points, PATH_SAMPLES)

markers = []
for i, co in enumerate(samples):
    empty = bpy.data.objects.new(f"path_{i:02d}", None)
    empty.location = co
    markers.append(empty)
for key in ("pool", "depths"):
    empty = bpy.data.objects.new(f"anchor_{key}", None)
    empty.location = geo.point_at_u(samples, anchors[key])
    markers.append(empty)
for empty in markers:
    bpy.context.scene.collection.objects.link(empty)

out = os.path.join(ROOT, "public", "scene", "poolrooms.glb")
os.makedirs(os.path.dirname(out), exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=out,
    export_format="GLB",
    use_renderable=True,
    export_apply=True,
    export_cameras=False,
    export_lights=False,
    export_extras=False,
    export_yup=True,
)
print(f"export: wrote {out} ({os.path.getsize(out) / 1024:.0f} KB)")
# The .blend is not saved, so the markers never persist.
```

- [ ] **Step 8: Export and run the tests**

```bash
npm run scene:export 2>&1 | tail -2
npm test 2>&1 | grep -E "Tests |FAIL"
```
Expected: `export: wrote …poolrooms.glb (N KB)` with N well under 6144; all tests pass. If the glb test reports a `SideCut` node, the exporter ignored `use_renderable`; ledger a ruling and instead move cutters into a collection excluded from the view layer before export.

- [ ] **Step 9: Commit**

```bash
npx biome check --write src/lib/scene scene/poolrooms-glb.test.ts
git add scene/export.py scene/poolrooms-glb.test.ts public/scene/poolrooms.glb src/lib/scene
git commit -m "feat: export poolrooms.glb with the camera path and Anchors

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Load the glb in the homepage runtime

**Files:**
- Create: `src/lib/scene/gltf.ts`, `src/lib/scene/gltf.test.ts`, `src/lib/scene/camera.ts`
- Modify: `src/lib/scene/poolrooms.ts` (rewrite), `src/lib/scene/runtime.ts`, `src/lib/scene/path.ts` (remove `PATH_POINTS`), `src/components/SceneBackground.astro`

**Interfaces:**
- Consumes: `public/scene/poolrooms.glb` (Task 4), `depthsFactor`, `depthsExposure`, `damp`, `pointerLook` (Task 1).
- Produces:
  - `type Vec3 = readonly [number, number, number]`; `pathFromNodes(nodes: readonly { name: string; position: Vec3 }[]): Vec3[]` (numeric order of `path_NN`; throws `Error` with "at least 2" when fewer than 2)
  - `createPathCamera(points: readonly Vec3[]): { place(camera: THREE.PerspectiveCamera, u: number, look: { yaw: number; pitch: number }): void }`
  - `SCENE_URL = "/scene/poolrooms.glb"`; `loadPoolrooms(url?: string): Promise<Poolrooms>` where `Poolrooms = { scene: THREE.Scene; path: Vec3[]; lights: { hemi: THREE.HemisphereLight; sun: THREE.DirectionalLight }; setDepths(factor: number): void; update(time: number): void; dispose(): void }`
  - `mountScene(canvas, initialU, onContextLost, url?) : Promise<SceneHandle>` (async now)

- [ ] **Step 1: Write the failing `pathFromNodes` tests**

Create `src/lib/scene/gltf.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { pathFromNodes } from "./gltf";

const node = (name: string, z: number) => ({ name, position: [0, 1, z] as const });

describe("pathFromNodes", () => {
	it("orders path_NN nodes numerically, not alphabetically", () => {
		const path = pathFromNodes([node("path_10", -10), node("path_2", -2), node("path_0", 0)]);
		expect(path.map((p) => p[2])).toEqual([0, -2, -10]);
	});

	it("ignores unrelated nodes", () => {
		const path = pathFromNodes([node("PassageA", 5), node("path_00", 0), node("anchor_pool", 3), node("path_01", -1)]);
		expect(path).toHaveLength(2);
	});

	it("fails loudly with fewer than 2 points", () => {
		expect(() => pathFromNodes([node("path_00", 0)])).toThrow(/at least 2/);
		expect(() => pathFromNodes([])).toThrow(/at least 2/);
	});
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/lib/scene/gltf.test.ts`
Expected: FAIL — cannot resolve `./gltf`.

- [ ] **Step 3: Implement `src/lib/scene/gltf.ts`**

```ts
export type Vec3 = readonly [number, number, number];

const PATH_NODE = /^path_(\d+)$/;

/** Camera path from the exported `path_NN` empties, in numeric order. */
export function pathFromNodes(nodes: readonly { name: string; position: Vec3 }[]): Vec3[] {
	const points = nodes
		.flatMap((n) => {
			const match = PATH_NODE.exec(n.name);
			return match ? [{ index: Number(match[1]), position: n.position }] : [];
		})
		.sort((a, b) => a.index - b.index)
		.map((p) => p.position);
	if (points.length < 2) {
		throw new Error(`scene: the camera path needs at least 2 path_NN nodes, found ${points.length}`);
	}
	return points;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- src/lib/scene/gltf.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Implement `src/lib/scene/camera.ts`**

```ts
import * as THREE from "three";
import type { Vec3 } from "./gltf";

export interface PathCamera {
	place(camera: THREE.PerspectiveCamera, u: number, look: { yaw: number; pitch: number }): void;
}

export function createPathCamera(points: readonly Vec3[]): PathCamera {
	const curve = new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
	const position = new THREE.Vector3();
	const tangent = new THREE.Vector3();
	const target = new THREE.Vector3();
	return {
		place(camera, u, look) {
			const t = Math.min(Math.max(u, 0), 1);
			curve.getPointAt(t, position);
			curve.getTangentAt(t, tangent);
			camera.position.copy(position);
			camera.lookAt(target.copy(position).add(tangent));
			camera.rotateY(look.yaw);
			camera.rotateX(look.pitch);
		},
	};
}
```

- [ ] **Step 6: Rewrite `src/lib/scene/poolrooms.ts`**

```ts
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { pathFromNodes, type Vec3 } from "./gltf";

export const SCENE_URL = "/scene/poolrooms.glb";

export interface Poolrooms {
	scene: THREE.Scene;
	path: Vec3[];
	lights: { hemi: THREE.HemisphereLight; sun: THREE.DirectionalLight };
	setDepths(factor: number): void;
	update(time: number): void;
	dispose(): void;
}

const POOL_AIR = new THREE.Color("#e9f1ef");
const DEPTHS_DARK = new THREE.Color("#040506");

/** Loads the Blender-exported Poolrooms. Lighting here is interim until Plan C2 bakes it. */
export async function loadPoolrooms(url: string = SCENE_URL): Promise<Poolrooms> {
	const gltf = await new GLTFLoader().loadAsync(url);
	const root = gltf.scene;
	root.updateMatrixWorld(true);

	const nodes: { name: string; position: Vec3 }[] = [];
	const world = new THREE.Vector3();
	root.traverse((object) => {
		if (/^path_\d+$/.test(object.name)) {
			object.getWorldPosition(world);
			nodes.push({ name: object.name, position: [world.x, world.y, world.z] });
		}
		if (object instanceof THREE.Mesh) {
			const material = object.material as THREE.MeshStandardMaterial;
			if (material.name === "Water") {
				material.transparent = true;
				material.depthWrite = false;
			}
		}
	});
	const path = pathFromNodes(nodes);

	const scene = new THREE.Scene();
	const background = POOL_AIR.clone();
	const fog = new THREE.Fog(POOL_AIR.clone(), 12, 70);
	scene.background = background;
	scene.fog = fog;
	scene.add(root);

	const hemi = new THREE.HemisphereLight("#fffaf0", "#9fd6d2", 1.6);
	const sun = new THREE.DirectionalLight("#fff6e8", 1.2);
	sun.position.set(-3, 10, 2);
	scene.add(hemi, sun);

	return {
		scene,
		path,
		lights: { hemi, sun },
		setDepths(factor) {
			background.lerpColors(POOL_AIR, DEPTHS_DARK, factor);
			fog.color.lerpColors(POOL_AIR, DEPTHS_DARK, factor);
			fog.near = THREE.MathUtils.lerp(12, 2, factor);
			fog.far = THREE.MathUtils.lerp(70, 14, factor);
		},
		update() {},
		dispose() {
			root.traverse((object) => {
				if (object instanceof THREE.Mesh) {
					object.geometry.dispose();
					const material = object.material as THREE.MeshStandardMaterial;
					material.map?.dispose();
					material.dispose();
				}
			});
		},
	};
}
```

- [ ] **Step 7: Make `runtime.ts` load the glb**

Replace `src/lib/scene/runtime.ts` with:
```ts
import { gsap } from "gsap";
import * as THREE from "three";
import { createPathCamera } from "./camera";
import { damp, depthsExposure, depthsFactor, pointerLook } from "./path";
import { loadPoolrooms, SCENE_URL } from "./poolrooms";

export interface SceneHandle {
	setU(u: number): void;
	dispose(): void;
}

const FOLLOW = 4;

export async function mountScene(
	canvas: HTMLCanvasElement,
	initialU: number,
	onContextLost: () => void,
	url: string = SCENE_URL,
): Promise<SceneHandle> {
	const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
	renderer.toneMapping = THREE.AgXToneMapping;

	let world: Awaited<ReturnType<typeof loadPoolrooms>>;
	try {
		world = await loadPoolrooms(url);
	} catch (error) {
		renderer.dispose();
		throw error;
	}

	const camera = new THREE.PerspectiveCamera(60, 1, 0.05, 200);
	const pathCamera = createPathCamera(world.path);

	let targetU = initialU;
	let u = initialU;
	const look = { yaw: 0, pitch: 0 };
	let lookTarget = { yaw: 0, pitch: 0 };

	const resize = () => {
		renderer.setSize(window.innerWidth, window.innerHeight, false);
		camera.aspect = window.innerWidth / window.innerHeight;
		camera.updateProjectionMatrix();
	};

	const onPointer = (event: PointerEvent) => {
		lookTarget = pointerLook(
			(event.clientX / window.innerWidth) * 2 - 1,
			(event.clientY / window.innerHeight) * 2 - 1,
		);
	};

	// gsap.ticker: time in seconds, deltaTime in ms. The only frame loop on the page.
	const tick = (time: number, deltaTime: number) => {
		const dt = Math.min(deltaTime / 1000, 0.1);
		u = damp(u, targetU, FOLLOW, dt);
		look.yaw = damp(look.yaw, lookTarget.yaw, FOLLOW, dt);
		look.pitch = damp(look.pitch, lookTarget.pitch, FOLLOW, dt);
		pathCamera.place(camera, u, look);

		const factor = depthsFactor(u);
		world.setDepths(factor);
		renderer.toneMappingExposure = depthsExposure(factor);
		world.update(time);
		renderer.render(world.scene, camera);
	};

	// A lost context never comes back here: stop rendering and let the static background take over.
	const onLost = () => {
		gsap.ticker.remove(tick);
		onContextLost();
	};

	resize();
	canvas.addEventListener("webglcontextlost", onLost);
	window.addEventListener("resize", resize);
	window.addEventListener("pointermove", onPointer, { passive: true });
	gsap.ticker.add(tick);

	return {
		setU(next) {
			targetU = next;
		},
		dispose() {
			gsap.ticker.remove(tick);
			canvas.removeEventListener("webglcontextlost", onLost);
			window.removeEventListener("resize", resize);
			window.removeEventListener("pointermove", onPointer);
			world.dispose();
			renderer.dispose();
		},
	};
}
```
In `src/components/SceneBackground.astro`, change the mount line to await the now-async function:
```ts
				const handle = await mountScene(canvas, bridge.current(), () => {
```
In `src/lib/scene/path.ts`, delete the `PATH_POINTS` constant and its doc comment (the path now comes from the glb).

- [ ] **Step 8: Verify tests, types, build, bundle split**

```bash
npm test 2>&1 | grep -E "Tests |FAIL"; npx astro check 2>&1 | grep -E "errors"
npm run build > .superpowers/c1-t5.log 2>&1; echo build=$?
ls -la dist/scene/poolrooms.glb; grep -l "GLTFLoader\|KHR_" dist/_astro/*.js | head -3; grep -c "WebGLRenderer" dist/index.html
```
Expected: tests pass; `0 errors`; build=0; the glb is in `dist/scene/`; loader code only in the runtime chunk; `0` in `dist/index.html`.

- [ ] **Step 9: Verify in the browser**

`npx astro preview --port 4399` (background), then with agent-browser at 1440×900:
1. `/`: `document.documentElement.dataset.scene === "scene"`; screenshot at the top shows tiled vaults and water.
2. Scroll to the Featured Projects section: the hall (wider vault, skylights) is in view; screenshot.
3. Scroll to the bottom: `dataset.zone === "depths"`, the view is very dim but not black, the far doorway is visible ahead and never reached; screenshot.
4. Console has no errors.

- [ ] **Step 10: Verify the missing-glb fallback (Review Focus 2)**

```bash
mv dist/scene/poolrooms.glb dist/scene/poolrooms.glb.bak
```
Reload `/` in the browser: `dataset.scene === "static"`, the canvas is hidden, the tile-grid background is visible, and the only console output is the `[scene] falling back` warning. Then restore:
```bash
mv dist/scene/poolrooms.glb.bak dist/scene/poolrooms.glb
```
Stop the preview server.

- [ ] **Step 11: Commit**

```bash
npx biome check --write src/lib/scene src/components/SceneBackground.astro
git add -A
git commit -m "feat: homepage walks through the Blender-exported Poolrooms

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Dev-only `/lab`

**Files:**
- Create: `src/pages/lab.astro`, `src/lib/scene/lab.ts`
- Modify: `astro.config.mjs`, `package.json` (dev dependency `lil-gui`)

**Interfaces:**
- Consumes: `loadPoolrooms`, `createPathCamera`, `depthsFactor`, `depthsExposure`.
- Produces: `startLab(canvas: HTMLCanvasElement): Promise<void>`; page `/lab` in dev only.

- [ ] **Step 1: Install lil-gui**

```bash
npm install -D lil-gui@^0.20
```

- [ ] **Step 2: Implement `src/lib/scene/lab.ts`**

```ts
import { gsap } from "gsap";
import GUI from "lil-gui";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createPathCamera } from "./camera";
import { depthsExposure, depthsFactor } from "./path";
import { loadPoolrooms } from "./poolrooms";

/** Dev-only tuning view for the Poolrooms scene. Never shipped (see astro.config.mjs). */
export async function startLab(canvas: HTMLCanvasElement): Promise<void> {
	const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
	renderer.toneMapping = THREE.AgXToneMapping;

	const world = await loadPoolrooms();
	const camera = new THREE.PerspectiveCamera(60, 1, 0.05, 200);
	const pathCamera = createPathCamera(world.path);
	const controls = new OrbitControls(camera, canvas);
	controls.enabled = false;

	const state = {
		mode: "path" as "path" | "free",
		u: 0,
		depths: -1,
		hemi: world.lights.hemi.intensity,
		sun: world.lights.sun.intensity,
	};
	const gui = new GUI({ title: "Poolrooms lab" });
	gui.add(state, "mode", ["path", "free"]).onChange((mode: "path" | "free") => {
		controls.enabled = mode === "free";
		if (mode === "free") {
			controls.target.copy(camera.position).add(camera.getWorldDirection(new THREE.Vector3()));
			controls.update();
		}
	});
	gui.add(state, "u", 0, 1, 0.001);
	gui.add(state, "depths", -1, 1, 0.01).name("depths (-1 = from u)");
	gui.add(state, "hemi", 0, 5, 0.01).onChange((v: number) => {
		world.lights.hemi.intensity = v;
	});
	gui.add(state, "sun", 0, 5, 0.01).onChange((v: number) => {
		world.lights.sun.intensity = v;
	});

	const resize = () => {
		renderer.setSize(window.innerWidth, window.innerHeight, false);
		camera.aspect = window.innerWidth / window.innerHeight;
		camera.updateProjectionMatrix();
	};
	window.addEventListener("resize", resize);
	resize();

	gsap.ticker.add((time) => {
		if (state.mode === "path") pathCamera.place(camera, state.u, { yaw: 0, pitch: 0 });
		else controls.update();
		const factor = state.depths >= 0 ? state.depths : depthsFactor(state.u);
		world.setDepths(factor);
		renderer.toneMappingExposure = depthsExposure(factor);
		world.update(time);
		renderer.render(world.scene, camera);
	});
}
```

- [ ] **Step 3: Create `src/pages/lab.astro`**

```astro
---
import "../styles/global.css";
---

<html lang="en">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width,initial-scale=1" />
		<meta name="robots" content="noindex" />
		<title>Poolrooms lab</title>
	</head>
	<body class="m-0 overflow-hidden bg-black">
		<canvas id="lab" class="block h-[100dvh] w-screen"></canvas>
		<script>
			import { startLab } from "../lib/scene/lab";

			const canvas = document.getElementById("lab");
			if (canvas instanceof HTMLCanvasElement) startLab(canvas);
		</script>
	</body>
</html>
```

- [ ] **Step 4: Keep `/lab` out of production**

In `astro.config.mjs` add `import { rm } from "node:fs/promises";`, change `sitemap()` to `sitemap({ filter: (page) => !page.includes("/lab") })`, and add this integration to the `integrations` array:
```js
		{
			name: "drop-lab",
			hooks: {
				"astro:build:done": async ({ dir }) => {
					await rm(new URL("lab/", dir), { recursive: true, force: true });
				},
			},
		},
```

- [ ] **Step 5: Verify**

```bash
npx astro check 2>&1 | grep -E "errors"
npm run build > .superpowers/c1-t6.log 2>&1; echo build=$?
test ! -e dist/lab && echo "no dist/lab"; grep -c "/lab" dist/sitemap-0.xml
```
Expected: `0 errors`; build=0; `no dist/lab`; `0`.
Then run `npm run dev` (background) and with agent-browser open `http://localhost:4321/lab` at 1440×900: the GUI panel shows; dragging `u` to 0.5 moves into the passage past the hall; switching `mode` to `free` allows orbiting; screenshot once. Stop the dev server.

- [ ] **Step 6: Commit**

```bash
npx biome check --write src/lib/scene/lab.ts astro.config.mjs package.json
git add -A
git commit -m "feat: dev-only /lab to tune the Poolrooms scene

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Tile variant renders for the user's choice; preview deploy

**Files:**
- Create: `scene/render_tiles.py`

**Interfaces:**
- Consumes: `build.set_tile_variant`, cameras `RenderEntrance`, `RenderHall` (Task 3).
- Produces: `scene/renders/tiles-<variant>-<view>.png` for `classic`, `mosaic`, `glazed` × `entrance`, `hall` (git-ignored).

- [ ] **Step 1: Implement `scene/render_tiles.py`**

```python
"""Render each tile variant from the two render cameras. Run via: npm run scene:tiles
The .blend is not saved, so the stored tile variant is unchanged."""

import os
import sys

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from lib import build, geo  # noqa: E402

out_dir = os.path.join(HERE, "renders")
os.makedirs(out_dir, exist_ok=True)
scene = bpy.context.scene

for variant in geo.VARIANTS:
    build.set_tile_variant(variant)
    for camera_name in ("RenderEntrance", "RenderHall"):
        scene.camera = bpy.data.objects[camera_name]
        view = camera_name.removeprefix("Render").lower()
        scene.render.filepath = os.path.join(out_dir, f"tiles-{variant}-{view}.png")
        bpy.ops.render.render(write_still=True)
        print(f"render_tiles: {variant} / {view}")
```

- [ ] **Step 2: Render**

Run: `npm run scene:tiles 2>&1 | grep "render_tiles:"` (Cycles on CPU; allow up to 10 minutes, use a 600000 ms timeout)
Expected: six `render_tiles:` lines and six PNGs in `scene/renders/`.

- [ ] **Step 3: Look at the renders**

Read each of the six PNGs. If a render shows a construction error (black geometry, a hole where a boolean failed, the camera inside a wall), fix `build.py`, regenerate with `npm run scene:gen -- --force`, re-export (`npm run scene:export`), re-run `npm run scene:test` and `npm test`, and render again. Record each fix as a ruling.

- [ ] **Step 4: Commit**

```bash
git add scene/render_tiles.py
git commit -m "feat: render tile variants for review

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 5: Ask before deploying the preview**

This publishes to `https://eitaar-dev-v6.eitaar.workers.dev`. Ask the user; only on an explicit yes run:
```bash
npm run build && npx -y wrangler@4 deploy
```
and smoke-test `/` (scene loads, reaches the Depths) and that `/lab` returns 404.

- [ ] **Step 6: Hand the tile choice to the user**

Present the six renders side by side (Poolrooms reference in mind) and ask which variant to keep. Applying the choice (`npm run scene:gen -- --force -- <variant>` then `npm run scene:export`) and baking belong to Plan C2.
