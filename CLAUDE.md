# CLAUDE.md

Guidance for Claude Code in this repository.

## Read first

- [CONTEXT.md](CONTEXT.md): domain vocabulary (Project, Featured Project, Writeup, Post, Skill, Poolrooms, Alley, Anchor). Use these terms in code and copy.
- [docs/adr/](docs/adr/): architectural decisions. ADR 0001: 3D is a fixed WebGL background, all content is DOM.
- [docs/plans/2026-09-27-v6-redesign-design.md](docs/plans/2026-09-27-v6-redesign-design.md): v6 design, including the Design Direction constraints.

## Commands

```bash
npm run dev          # dev server at localhost:4321
npm run build        # production build to ./dist/
npm run bp           # build + preview
npm test             # vitest (pure logic in src/lib/**)
npx astro check      # TypeScript + Astro type checking
npm run format       # prettier + biome
```

Preview deployment: https://eitaar-dev-v6.eitaar.workers.dev (`npx wrangler@4 deploy`). eitaar.dev still serves v5 until the MVP is complete.

## Architecture

Astro 7 · Tailwind v4 (`@tailwindcss/vite`) · TypeScript strict · Three.js · GSAP (ScrollTrigger + ticker). Deployed as static assets on Cloudflare Workers (`wrangler.jsonc`).

- Pure, unit-tested logic: `src/lib/content.ts`, `src/lib/scene/{capability,path,background}.ts`.
- Browser-only scene code: `src/lib/scene/{scroll,runtime,poolrooms}.ts`, wired in `src/components/SceneBackground.astro`.
- Homepage sections mark Anchors with `data-anchor="entrance|pool|turn"`.
- No 3D on width < 1024px, coarse pointer, no WebGL2, or reduced motion: static background instead.
- Scroll progress only via GSAP ScrollTrigger, per-frame work only on `gsap.ticker`. No scroll event listeners, no own rAF loops.
- Poolrooms/Alley colour change is a zone switch (`<html data-zone>`), not a per-frame CSS variable.
