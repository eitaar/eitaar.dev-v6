# eitaar.dev v6 Redesign Design

**Date:** 2026-09-27
**Scope:** Replace v5's identity (Ndot47, monochrome, editorial layout) with an artistic, liminal-space site whose homepage moves through a 3D background while all content stays in the DOM.

Vocabulary (Project, Featured Project, Writeup, Post, Skill, Poolrooms, Alley, Anchor) is defined in [CONTEXT.md](../../CONTEXT.md). The rendering architecture is recorded in [ADR 0001](../adr/0001-webgl-background-dom-content.md).

## Goals

- A new identity: liminal space, artistic over UI/UX on the homepage.
- Primary readers are developers (with a little "playground"); English only.
- Homepage background is a 3D scene; every readable thing is DOM.
- Reading pages (Projects index, Project detail, Posts) prioritise legibility.

## Non-Goals (MVP)

- Dark mode and the theme toggle (later: the world beyond the Alley, toggled as "lights").
- Sound (later: opt-in, off by default).
- Text drawn inside the 3D scene.
- Free-roam camera controls.
- Archiving v5.

## Homepage Experience

- **Background:** one fixed WebGL canvas showing Poolrooms. Scroll moves the camera forward along one path; pointer adds slight look-around.
- **Path:** entrance (Hero) → pool centre (Featured Projects, one shared symbolic object) → turn → Alley (Contact) → footer in the dark. There is no exit.
- **Anchors:** three — entrance, pool centre, the turn into the Alley. Between anchors the camera advances loosely; sections are not otherwise mapped to camera positions.
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

- **Models (Blender):** Poolrooms architecture, the Alley entrance (mostly unseen darkness), one symbolic object.
- **Shaders:** water, fog, fluorescent flicker, film grain.
- **Budget:** light enough for desktop integrated GPUs (low poly, baked lighting over real-time reflections, small textures).
- **Stack:** plain Three.js + GSAP (see ADR 0001).

## Fallbacks

When the viewport is small, the pointer is coarse, WebGL is unavailable, or `prefers-reduced-motion` is set: no canvas. Use a static render of Poolrooms as the background, crossfading via CSS to a dark Alley image/gradient near the end of the page.

## Foundation & Rollout

- Copy v5 (Astro 7, Tailwind v4, content collections, Cloudflare Workers) as the base; replace styles, layout and homepage.
- Develop as a separate Worker on a `*.workers.dev` preview; switch eitaar.dev over when the MVP is done; retire v5.
- Writeups and Posts do not block launch.

## Open Questions

- **Typography:** compare options during the design phase (candidates: public-facility signage / DIN-like grotesk with a custom eitaar wordmark; neutral grotesk + mono; thin serif).
- **Palette:** exact tokens, derived from the Poolrooms scene.
- **Symbolic object:** what it is.
