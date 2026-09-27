# eitaar.dev v6 Redesign Design

**Date:** 2026-09-27
**Scope:** Replace v5's identity (Ndot47, monochrome, editorial layout) with an artistic, liminal-space site whose homepage moves through a 3D background while all content stays in the DOM.

Vocabulary (Project, Featured Project, Writeup, Post, Skill, Poolrooms, Depths, Anchor) is defined in [CONTEXT.md](../../CONTEXT.md). The rendering architecture is recorded in [ADR 0001](../adr/0001-webgl-background-dom-content.md).

## Goals

- A new identity: liminal space, artistic over UI/UX on the homepage.
- Primary readers are developers (with a little "playground"); English only.
- Homepage background is a 3D scene; every readable thing is DOM.
- Reading pages (Projects index, Project detail, Posts) prioritise legibility.

## Non-Goals (MVP)

- Dark mode and the theme toggle (later; what dark mode *is* is an open question since the Alley was dropped).
- Sound (later: opt-in, off by default).
- Text drawn inside the 3D scene.
- Free-roam camera controls.
- Archiving v5.

## Homepage Experience

- **Background:** one fixed WebGL canvas showing Poolrooms. Scroll moves the camera forward along one path; pointer adds slight look-around.
- **Path:** straight on through flooded, vaulted Poolrooms: entrance (Hero) → pool hall (Featured Projects, one shared symbolic object) → Depths (Contact onward), where it grows as dim as it can while the dark doorway at the far end stays out of reach. There is no exit.
- **Anchors:** three: entrance, pool, depths. Between anchors the camera advances loosely; sections are not otherwise mapped to camera positions.
- *Revised 2026-09-27:* the Alley (a turn into a dark side passage) was dropped in favour of the Depths.
- **Legibility:** Hero text sits directly on the scene (scene dimmed/blurred for contrast); later sections sit on panels (translucent tile / frosted).
- **Sections:** Hero, About, Featured Projects (3), Skills (compact), Contact.

## Content Model

- **Project:** one per built thing. Merge `yot` and `yot-client` into one Project; collapse portfolio versions into one Project, `eitaar.dev`.
- **Featured Project:** yot, eitaar.dev, wahoot. Each gets a Writeup. Rename the `topProject` frontmatter field to `featured`.
- **Post:** topic-level technical article, may reference related Projects.
- **Posts link hidden** until the first Post exists.

## Reading Pages

Derived from Poolrooms: tile grout as grid/rules, white / pool-aqua / muted tones, restrained so body text stays readable.

## 3D Production

- See **Scene (Plan C)** below; it supersedes the original bullet list here.
- **Budget:** light enough for desktop integrated GPUs (low poly, baked lighting over real-time reflections, small textures).
- **Stack:** plain Three.js + GSAP ScrollTrigger and ticker (see ADR 0001).

## Fallbacks

When the viewport is small, the pointer is coarse, WebGL is unavailable, or `prefers-reduced-motion` is set: no canvas. Use a static render of Poolrooms as the background, crossfading via CSS to a dark Depths image near the end of the page.

## Foundation & Rollout

- Copy v5 (Astro 7, Tailwind v4, content collections, Cloudflare Workers) as the base; replace styles, layout and homepage.
- Develop as a separate Worker on a `*.workers.dev` preview; switch eitaar.dev over when the MVP is done; retire v5.
- Writeups and Posts do not block launch.

## Design Direction (from design-taste-frontend / frontend-design)

**Design Read:** developer portfolio for fellow developers, with a liminal-space, artistic-3D language, leaning toward native CSS + Tailwind v4, a Three.js background and GSAP ScrollTrigger.

**Dials:** `DESIGN_VARIANCE 7` · `MOTION_INTENSITY 6` · `VISUAL_DENSITY 3` (portfolio-developer preset pushed toward artistic; airy, like an empty building).

**Signature:** the walk through the flooded Poolrooms into the Depths. Spend boldness there only; everything around it stays quiet and disciplined.

**Constraints for Plan B (visual system):**
- Type: no Inter, Fraunces or Instrument Serif; no serif by default. Candidates stay as listed under Open Questions, compared side by side.
- Colour: one accent (pool aqua), locked across the page; off-white / off-black, no pure `#fff` / `#000`. The Depths darkening is the one deliberate theme shift on the page.
- One corner-radius scale for the whole site (tiles suggest sharp or near-sharp).
- Copy: zero em-dashes; no scroll cues; no section-number eyebrows; at most one uppercase micro-label per three sections.
- Icons from one library via astro-icon (replace v5's hand-rolled `arrow.svg`).
- Motion must be motivated (hierarchy, storytelling, feedback, state change), use transform/opacity only, and share GSAP's ScrollTrigger and ticker with the scene.
- Grain/noise only on a fixed, `pointer-events: none` layer; no large or animated `backdrop-filter` over the live canvas.
- Text over the scene meets WCAG AA in both the Poolrooms and Depths zones.
- Dark mode is deliberately deferred, overriding the skill's dual-mode default.

## Scene (Plan C)

Order changed on 2026-09-27: the scene is built before the visual system (Plan B), because the right typeface depends on the finished atmosphere.

**Reference:** a flooded, fully tiled barrel-vaulted passage (kept locally at `.superpowers/ref/poolrooms-reference.png`, not committed). Its traits:
- the whole floor is shallow, clear aqua water; the camera moves just above it
- semicircular vaults and arches repeat into the distance
- every surface (floor under water, walls, vaults) is small square tile, about 10 cm, off-white with grey grout
- dark arched openings lead off to the side; a pool ladder hangs on the wall
- soft daylight comes from above; a dark doorway sits at the far end

**Pipeline:**
- **Geometry:** a Blender Python script generates the base space (vaults, arches, side openings, water, ladder) and the camera path, run headless. After the first generation the `.blend` file is the source of truth and may be hand-edited in Blender.
- **Camera path:** drawn in Blender as a curve and exported in the `.glb`; the runtime reads it instead of hard-coded points.
- **Lighting:** daylight through ceiling openings, baked with Cycles into lightmaps. Realtime on top: water surface motion, caustics on the tiles, the darkening into the Depths (exposure and fog).
- **Water:** low-resolution realtime planar reflection, distorted by animated normals, backed by a baked environment map.
- **Tiles:** 2 to 3 variants rendered in Blender for the user to choose from.
- **`/lab`:** a dev-only page with free camera, a `u` slider and a GUI for light and water parameters; excluded from production builds.
- **Static fallback:** Cycles renders of the same scene at the entrance and in the Depths.
- **Budget:** at most 6 MB of 3D data (aim for 3 MB); KTX2 or WebP textures, Draco or meshopt geometry.
- **Symbolic object:** decided later in Plan C.

## Open Questions

- **Typography:** compare options during the design phase (candidates: public-facility signage / DIN-like grotesk with a custom eitaar wordmark; neutral grotesk + mono; thin serif).
- **Palette:** exact tokens, derived from the Poolrooms scene.
- **Symbolic object:** what it is (Plan C, after the space is built).
- **Dark mode:** what it means now that the Alley is gone.
