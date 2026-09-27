# eitaar.dev v6 — Foundation & Scene Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up v6 on v5's foundation with the new content model, a DOM homepage laid out along the Poolrooms → Alley path, and a capability-gated Three.js background (with a static fallback), deployed to a workers.dev preview.

**Architecture:** Astro 7 static site (copied from v5). All readable content is DOM. The homepage mounts one fixed background: a static CSS layer by default, upgraded to a Three.js canvas only on capable desktops. Scroll position is mapped to a camera-path parameter `u ∈ [0,1]` through three **Anchors** (`entrance`, `pool`, `turn`) marked on DOM sections with `data-anchor`; the same `u` drives the Alley darkening (`--alley` CSS variable) in both modes. Pure logic lives in `src/lib/**` and is unit-tested with Vitest; Three.js code is verified in the browser.

**Tech Stack:** Astro 7, Tailwind CSS v4 (`@tailwindcss/vite`), TypeScript strict, Three.js 0.186, Vitest 5, Biome, Cloudflare Workers (static assets).

**Spec:** [docs/plans/2026-09-27-v6-redesign-design.md](../../plans/2026-09-27-v6-redesign-design.md) — also read [CONTEXT.md](../../../CONTEXT.md) (vocabulary) and [ADR 0001](../../adr/0001-webgl-background-dom-content.md).

**Not in this plan (follow-up plans):**
- **Plan B — Visual system:** typography comparison, palette tokens, panel/hero styling polish, reading-page restyle. This plan uses the system font stack and v5's light tokens so B can replace them wholesale.
- **Plan C — Scene assets & look-dev:** Blender models, water/fog/flicker/grain shaders, the static render image for the fallback, the symbolic object. This plan builds the scene from primitive placeholder geometry behind a stable `createPoolrooms()` interface that C replaces.
- Writing Writeups and Posts; switching the eitaar.dev domain.

## Global Constraints

- Node `>=22.12.0`; Astro 7; Tailwind v4 via `@tailwindcss/vite` (not PostCSS); TypeScript `astro/tsconfigs/strict`.
- Site copy is English only.
- No dark mode, no theme toggle, no sound, no text drawn inside the 3D scene (all deferred / out of scope).
- Every readable thing is DOM; the canvas and static layers are `aria-hidden="true"`.
- No 3D canvas when **any** of: viewport width `< 1024px`, `(pointer: coarse)`, no WebGL2, `(prefers-reduced-motion: reduce)`.
- No GSAP (ADR 0001).
- Vocabulary from `CONTEXT.md`: frontmatter field is `featured` (never `topProject`); scene names are Poolrooms, Alley, Anchor.
- Featured Projects are exactly: `yot`, `eitaar-dev`, `wahoot`.
- Posts link appears only when at least one Post exists.
- Formatting: Biome (tabs, double quotes, 100 cols, LF). Run `npx biome check --write <changed files>` before each commit.
- Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Shell: commands below are POSIX (Git Bash). Working directory is `C:/Users/eitab/Documents/js/eitaar.dev-v6` unless stated.

## Review Focus

1. **Page shorter than the viewport (maxScroll = 0)** — camera stays at `u = 0`, no `NaN`, no division by zero. → Task 5 test `buildScrollAnchors: zero-height page`.
2. **Anchors that collapse or are missing** (short sections, a misspelled `data-anchor`, a section removed) — mapping stays monotonic and the bottom of the page still reaches `u = 1`. → Task 5 tests `collapsed anchors` / `isAnchorName`.
3. **WebGL context creation throws even though detection passed** (driver blocklist, context limit) — page falls back to the static background and stays usable. → Task 7 test `startBackground: mount failure`.
4. **Page loaded already scrolled** (reload mid-page, back navigation) — scene starts at the matching `u`, not at the entrance. → Task 7 test `createUBridge: late connect`.
5. **Zero Posts / a Project with no repos or demo** — no Posts link anywhere, `/posts` still builds, the Project detail page renders without link rows. → Task 2 tests `hasPosts` / `projectLinks: none`.

---

## File Structure

| Path | Responsibility |
|---|---|
| `package.json`, `astro.config.mjs`, `wrangler.jsonc`, `vitest.config.ts` | tooling & build config |
| `CLAUDE.md` | agent guidance for v6 |
| `src/content.config.ts` | collection schemas (`featured`, `repos`) |
| `src/content/projects/*.md` | Project entries (yot merged, `eitaar-dev` replaces `portfolio`) |
| `src/lib/content.ts` (+ `.test.ts`) | pure helpers: sort, featured filter, posts visibility, project links |
| `src/lib/scene/capability.ts` (+ `.test.ts`) | should this device get the 3D scene? |
| `src/lib/scene/path.ts` (+ `.test.ts`) | Anchors, scroll→`u`, Alley factor, pointer look, damping, path points |
| `src/lib/scene/scroll.ts` | browser: measure `[data-anchor]` sections, emit `u` on scroll/resize |
| `src/lib/scene/background.ts` (+ `.test.ts`) | orchestration: choose mode, mount scene, fall back; `u` bridge |
| `src/lib/scene/poolrooms.ts` | Three.js world (placeholder geometry; replaced in Plan C) |
| `src/lib/scene/runtime.ts` | Three.js renderer, camera on path, loop, resize, visibility, dispose |
| `src/components/SceneBackground.astro` | fixed background layers + client wiring |
| `src/components/Header.astro`, `Footer.astro`, `BaseHead.astro`, `Project.astro` | shell components |
| `src/layouts/Layout.astro` | base shell; `scene` prop mounts the background |
| `src/pages/index.astro` | homepage sections with Anchors |
| `src/pages/projects/[...slug].astro`, `projects/index.astro` | Project pages |
| `src/styles/global.css`, `src/styles/light.css` | tokens, panels, background layers |

---

### Task 1: Scaffold v6 from v5 and strip the v5 identity

**Files:**
- Create (copy): `astro.config.mjs`, `biome.json`, `package.json`, `package-lock.json`, `tsconfig.json`, `wrangler.jsonc`, `.gitignore`, `.prettierrc`, `.vscode/`, `public/`, `src/`
- Modify: `package.json`, `wrangler.jsonc`, `astro.config.mjs`, `src/components/BaseHead.astro`, `src/components/Header.astro`, `src/components/Footer.astro`, `src/layouts/Layout.astro`, `src/styles/global.css`
- Delete: `src/styles/dark.css`, `src/assets/fonts/`
- Create: `CLAUDE.md`

**Interfaces:**
- Consumes: nothing.
- Produces: a building Astro project; `Layout` props `{ title: string; description: string; showHeader?: boolean; showFooter?: boolean }`; `<html>` has fixed `data-theme="light"` and the `js` class is added by inline script.

- [ ] **Step 1: Copy the v5 foundation (no build output, no v5 docs/agent state)**

```bash
V5="C:/Users/eitab/Documents/js/eitaar.dev-v5"
cp -r "$V5"/{astro.config.mjs,biome.json,package.json,package-lock.json,tsconfig.json,wrangler.jsonc,.gitignore,.prettierrc,.vscode,public,src} .
ls -a
```
Expected: the listed files plus the existing `CONTEXT.md`, `docs/`, `.git/`.

- [ ] **Step 2: Rename the package, drop GSAP, add a test script**

In `package.json`: set `"name": "eitaar-dev-v6"`; remove the `"gsap"` dependency line; add `"test": "vitest run"` to `scripts`. Then:

```bash
npm uninstall gsap && npm install
```
Expected: install succeeds, `gsap` absent from `package.json`.

- [ ] **Step 3: Rename the Worker**

`wrangler.jsonc`:
```jsonc
{
	"name": "eitaar-dev-v6",
	"compatibility_date": "2026-09-27",
	"assets": {
		"directory": "./dist",
		"not_found_handling": "404-page"
	}
}
```

- [ ] **Step 4: Remove v5 fonts (typography is decided in Plan B)**

In `astro.config.mjs`: delete the whole `fonts: [...]` array and remove `fontProviders` from the `astro/config` import (keep `defineConfig`). Then:
```bash
rm -r src/assets/fonts
```
In `src/components/BaseHead.astro`: delete the `import { Font } from "astro:assets";` line and both `<Font ... />` lines.

In `src/styles/global.css`, replace the first two lines inside `@theme inline {` (`--font-share` / `--font-ndot47`) with nothing, and change the imports at the top of the file to:
```css
@import "tailwindcss";
@import "./light.css";
```
Delete `src/styles/dark.css`, and delete the `@custom-variant dark ...` line.

- [ ] **Step 5: Fix the theme to light and remove the toggle**

`src/layouts/Layout.astro` — replace the `<html>`…`</html>` block with:
```astro
<!doctype html>
<html lang="en" data-theme="light">
	<head>
		<BaseHead title={title} description={description} />
		<script is:inline>
			document.documentElement.classList.add("js");
		</script>
	</head>
	<body class="bg-bg font-sans text-content">
		{showHeader && <Header />}
		<main class="px-6 md:px-12 lg:px-48">
			<slot />
		</main>
		{showFooter && <Footer />}
	</body>
</html>
```
Also delete the unused `removeTopPadding?: boolean;` prop.

`src/components/Header.astro` — replace the whole file with:
```astro
---
const NAV_LINKS = [
	{ text: "Projects", url: "/projects" },
	{ text: "Posts", url: "/posts" },
];
---

<header
	class="fixed top-0 right-0 left-0 z-50 flex h-20 items-center justify-between px-6 py-4"
>
	<a class="text-lg font-bold" href="/">eitaar</a>
	<nav>
		<ul class="flex gap-4 text-lg text-muted">
			{
				NAV_LINKS.map((link) => (
					<li>
						<a href={link.url}>{link.text}</a>
					</li>
				))
			}
		</ul>
	</nav>
</header>
```
(The Posts link becomes conditional in Task 2.)

`src/components/Footer.astro` — replace the whole file with:
```astro
<footer class="px-6 pt-16 pb-6 md:px-12 lg:px-48">
	<p class="text-md">© 2026 eitaar</p>
</footer>
```

- [ ] **Step 6: Strip remaining v5 font utility classes**

```bash
grep -rlE "font-ndot47|font-share" src | xargs sed -i -E 's/ ?font-(ndot47|share)//g'
grep -rnE "font-ndot47|font-share|astro-icon" src
```
Expected: second grep prints nothing except possibly `astro-icon` in files using `<Icon>` — if any file still imports `astro-icon/components`, leave it (the integration stays installed).

- [ ] **Step 7: Write v6 `CLAUDE.md`**

```markdown
# CLAUDE.md

Guidance for Claude Code in this repository.

## Read first

- [CONTEXT.md](CONTEXT.md) — domain vocabulary (Project, Featured Project, Writeup, Post, Skill, Poolrooms, Alley, Anchor). Use these terms in code and copy.
- [docs/adr/](docs/adr/) — architectural decisions. ADR 0001: 3D is a fixed WebGL background, all content is DOM.
- [docs/plans/2026-09-27-v6-redesign-design.md](docs/plans/2026-09-27-v6-redesign-design.md) — v6 design.

## Commands

```bash
npm run dev          # dev server at localhost:4321
npm run build        # production build to ./dist/
npm run bp           # build + preview
npm test             # vitest (pure logic in src/lib/**)
npx astro check      # TypeScript + Astro type checking
npm run format       # prettier + biome
```

## Architecture

Astro 7 · Tailwind v4 (`@tailwindcss/vite`) · TypeScript strict · Three.js. Deployed as static assets on Cloudflare Workers (`wrangler.jsonc`).

- Pure, unit-tested logic: `src/lib/content.ts`, `src/lib/scene/{capability,path,background}.ts`.
- Browser-only scene code: `src/lib/scene/{scroll,runtime,poolrooms}.ts`, wired in `src/components/SceneBackground.astro`.
- Homepage sections mark Anchors with `data-anchor="entrance|pool|turn"`.
- No 3D on width < 1024px, coarse pointer, no WebGL2, or reduced motion — static background instead.
```

- [ ] **Step 8: Verify the build**

```bash
npx astro check && npm run build
```
Expected: `0 errors`; build completes. (The homepage still references `bottle.svg`/avatar — fine until Task 3.)

- [ ] **Step 9: Commit**

```bash
npx biome check --write astro.config.mjs src package.json wrangler.jsonc
git add -A
git commit -m "chore: scaffold v6 from v5 without fonts, theme toggle or GSAP

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Content model — `featured`, `repos`, merged Projects, conditional Posts link

**Files:**
- Create: `vitest.config.ts`, `src/lib/content.ts`, `src/lib/content.test.ts`
- Modify: `src/content.config.ts`, `src/content/projects/*.md`, `src/pages/projects/index.astro`, `src/pages/projects/[...slug].astro`, `src/pages/posts/index.astro`, `src/components/Header.astro`
- Delete: `src/content/projects/yot-client.md`, `src/content/projects/portfolio.md`
- Create: `src/content/projects/eitaar-dev.md`

**Interfaces:**
- Consumes: Task 1 project.
- Produces (in `src/lib/content.ts`):
  - `byNewest<T extends { data: { pubDate: Date } }>(a: T, b: T): number`
  - `featuredProjects<T extends { data: { pubDate: Date; featured: boolean } }>(projects: readonly T[]): T[]`
  - `hasPosts(posts: readonly unknown[]): boolean`
  - `interface ProjectLink { label: string; value: string; url: string }`
  - `projectLinks(data: { demoUrl?: string; repos: { label: string; url: string }[] }): ProjectLink[]`
  - Project schema fields `featured: boolean` (default `false`), `repos: { label: string; url: string }[]` (default `[]`).

- [ ] **Step 1: Install Vitest and configure it**

```bash
npm install -D vitest@^5
```
`vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["src/**/*.test.ts"],
		environment: "node",
	},
});
```

- [ ] **Step 2: Write the failing tests**

`src/lib/content.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { byNewest, featuredProjects, hasPosts, projectLinks } from "./content";

const entry = (id: string, date: string, featured = false) => ({
	id,
	data: { pubDate: new Date(date), featured },
});

describe("byNewest", () => {
	it("sorts newest first", () => {
		const sorted = [entry("a", "2024-01-01"), entry("b", "2026-01-01")].sort(byNewest);
		expect(sorted.map((e) => e.id)).toEqual(["b", "a"]);
	});
});

describe("featuredProjects", () => {
	it("keeps only featured entries, newest first", () => {
		const result = featuredProjects([
			entry("old", "2024-04-01", true),
			entry("hidden", "2026-08-01", false),
			entry("new", "2026-06-02", true),
		]);
		expect(result.map((e) => e.id)).toEqual(["new", "old"]);
	});

	it("does not mutate the input", () => {
		const input = [entry("a", "2024-01-01", true), entry("b", "2026-01-01", true)];
		featuredProjects(input);
		expect(input.map((e) => e.id)).toEqual(["a", "b"]);
	});
});

describe("hasPosts", () => {
	it("is false for zero posts", () => {
		expect(hasPosts([])).toBe(false);
	});
	it("is true for one post", () => {
		expect(hasPosts([{}])).toBe(true);
	});
});

describe("projectLinks", () => {
	it("returns no rows when there is no demo and no repos", () => {
		expect(projectLinks({ repos: [] })).toEqual([]);
	});

	it("lists the demo first, then each repo by owner/name", () => {
		expect(
			projectLinks({
				demoUrl: "https://wahoot.eitaar.dev",
				repos: [
					{ label: "Server", url: "https://github.com/eitaar/yot" },
					{ label: "Client", url: "https://github.com/eitaar/yot-client" },
				],
			}),
		).toEqual([
			{ label: "Website", value: "wahoot.eitaar.dev", url: "https://wahoot.eitaar.dev" },
			{ label: "Server", value: "eitaar/yot", url: "https://github.com/eitaar/yot" },
			{ label: "Client", value: "eitaar/yot-client", url: "https://github.com/eitaar/yot-client" },
		]);
	});
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./content"`.

- [ ] **Step 4: Implement `src/lib/content.ts`**

```ts
interface Dated {
	data: { pubDate: Date };
}

export function byNewest<T extends Dated>(a: T, b: T): number {
	return b.data.pubDate.valueOf() - a.data.pubDate.valueOf();
}

export function featuredProjects<T extends { data: { pubDate: Date; featured: boolean } }>(
	projects: readonly T[],
): T[] {
	return projects.filter((project) => project.data.featured).sort(byNewest);
}

export function hasPosts(posts: readonly unknown[]): boolean {
	return posts.length > 0;
}

export interface ProjectLink {
	label: string;
	value: string;
	url: string;
}

export function projectLinks(data: {
	demoUrl?: string;
	repos: { label: string; url: string }[];
}): ProjectLink[] {
	const links: ProjectLink[] = [];
	if (data.demoUrl) {
		links.push({ label: "Website", value: new URL(data.demoUrl).host, url: data.demoUrl });
	}
	for (const repo of data.repos) {
		links.push({ label: repo.label, value: new URL(repo.url).pathname.slice(1), url: repo.url });
	}
	return links;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (7 tests).

- [ ] **Step 6: Update the projects schema**

In `src/content.config.ts`, replace the `projects` schema object with:
```ts
		z.object({
			title: z.string(),
			summary: z.string(),
			category: z.string(),
			pubDate: z.coerce.date(),
			repos: z.array(z.object({ label: z.string(), url: z.url() })).default([]),
			demoUrl: z.optional(z.url()),
			techStack: z.array(z.string()),
			heroImage: z.optional(image()),
			featured: z.boolean().default(false),
		}),
```

- [ ] **Step 7: Migrate Project entries**

```bash
cd src/content/projects
rm yot-client.md portfolio.md
sed -i '/^topProject:/d' *.md
sed -i -E 's#^repoUrl: (.+)$#repos:\n  - label: Repository\n    url: \1#' *.md
sed -i 's/^heroImage: \(.*\)$/heroImage: \1\nfeatured: true/' wahoot.md
cd -
grep -n "featured\|repos\|label" src/content/projects/*.md
```
Expected: every former `repoUrl` is now a `repos` entry; `wahoot.md` has `featured: true`; no `topProject` anywhere.

Replace `src/content/projects/yot.md` entirely:
```markdown
---
title: Yot
summary: An agent-first calendar / reminder app, with a server and a native client
category: MCP / Backend
pubDate: 2026-07-28
repos:
  - label: Server
    url: https://github.com/eitaar/yot
  - label: Client
    url: https://github.com/eitaar/yot-client
techStack: ["axum", "Rust", "SQLite", "React Native", "Expo", "TypeScript"]
heroImage: ../../assets/img/projects/yot.png
featured: true
---

An agent-first calendar / reminder app.
```

Create `src/content/projects/eitaar-dev.md`:
```markdown
---
title: eitaar.dev
summary: My portfolio website, now in its sixth version
category: Website
pubDate: 2026-09-27
repos:
  - label: Repository
    url: https://github.com/eitaar/eitaar.dev-v6
demoUrl: https://eitaar.dev
techStack: ["Astro", "Tailwind", "Three.js"]
heroImage: ../../assets/img/projects/portfolio.png
featured: true
---

A portfolio website showcasing my projects and writing.
```

- [ ] **Step 8: Use the helpers in pages**

`src/pages/projects/index.astro` frontmatter:
```astro
---
import { getCollection } from "astro:content";
import Project from "../../components/Project.astro";
import Layout from "../../layouts/Layout.astro";
import { byNewest } from "../../lib/content";

const projects = (await getCollection("projects")).sort(byNewest);
---
```

`src/pages/projects/[...slug].astro`: add `import { projectLinks } from "../../lib/content";`; change the destructure to `const { title, summary, techStack, pubDate, heroImage } = project.data;`; replace the `meta` array with:
```ts
const meta: { label: string; value: string; url?: string }[] = [
	...projectLinks(project.data),
	{ label: "Category", value: project.data.category },
	{ label: "Last Updated", value: formattedDate },
	{ label: "Tech Stack", value: techStack.join(", ") },
];
```
Uncomment the `<Content />` block so Writeups render:
```astro
		<div class="post-content w-full max-w-3xl pt-8">
			<Content />
		</div>
```

`src/pages/posts/index.astro`: add `import { byNewest } from "../../lib/content";` and replace the sort line with `const posts = (await getCollection("posts")).sort(byNewest);`.

`src/components/Header.astro` frontmatter becomes:
```astro
---
import { getCollection } from "astro:content";
import { hasPosts } from "../lib/content";

const NAV_LINKS = [
	{ text: "Projects", url: "/projects" },
	...(hasPosts(await getCollection("posts")) ? [{ text: "Posts", url: "/posts" }] : []),
];
---
```

- [ ] **Step 9: Verify**

```bash
npm test && npx astro check && npm run build
ls dist/projects
grep -c 'href="/posts"' dist/index.html dist/projects/index.html
```
Expected: tests pass, `0 errors`; `dist/projects` contains `eitaar-dev`, `yot`, `wahoot`, and no `yot-client` or `portfolio`; grep count is `0` for both files; `dist/posts/index.html` still exists.

- [ ] **Step 10: Commit**

```bash
npx biome check --write src/lib src/content.config.ts src/pages src/components vitest.config.ts
git add -A
git commit -m "feat: featured/repos content model, merge yot, hide Posts until one exists

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Homepage DOM along the path

**Files:**
- Modify: `src/pages/index.astro`, `src/styles/global.css`
- Delete: `src/assets/svg/bottle.svg`, `src/assets/img/av.png`

**Interfaces:**
- Consumes: `featuredProjects`, `hasPosts` (Task 2); `contacts` (`src/data/contacts.ts`), `skillGroups` (`src/data/skills.ts`).
- Produces: homepage sections in order Hero (`data-anchor="entrance"`), About (`.panel`), Featured Projects (`data-anchor="pool"`), Skills (`.panel`), Contact (`data-anchor="turn"`). CSS class `.panel`.

- [ ] **Step 1: Replace `src/pages/index.astro`**

```astro
---
import { getCollection } from "astro:content";
import Project from "../components/Project.astro";
import { contacts } from "../data/contacts";
import { skillGroups } from "../data/skills";
import Layout from "../layouts/Layout.astro";
import { featuredProjects, hasPosts } from "../lib/content";

const featured = featuredProjects(await getCollection("projects"));
const showPosts = hasPosts(await getCollection("posts"));
---

<Layout title="eitaar" description="eitaar's portfolio">
	<section data-anchor="entrance" class="flex min-h-screen flex-col justify-center gap-4">
		<h1 class="text-7xl leading-none font-bold tracking-tight md:text-8xl lg:text-9xl">eitaar</h1>
		<p class="text-base tracking-wide text-muted md:text-lg lg:text-xl">
			Software Developer / Student
		</p>
	</section>

	<section class="panel my-24 flex flex-col gap-6 p-8 md:p-12">
		<h2 class="text-4xl leading-none font-bold md:text-5xl">About</h2>
		<p class="text-base text-pretty md:text-lg lg:text-xl">
			I'm a student in the UK. I play with little projects that link separate things, mostly to find
			out whether they hold up once they're running. A lot of it is just me following a thought and
			seeing where it lands.
		</p>
		<p class="text-base text-pretty md:text-lg lg:text-xl">
			Off the keyboard, I tend to disappear into books and comics, or just listen to music.
		</p>
	</section>

	<section data-anchor="pool" class="panel my-24 flex flex-col gap-8 p-8 md:p-12">
		<h2 class="text-4xl leading-none font-bold md:text-5xl">Featured Projects</h2>
		<div class="flex w-full flex-col">
			{featured.map((project, i) => <Project project={project} index={i + 1} />)}
		</div>
		<a href="/projects" class="self-end underline underline-offset-4">All projects →</a>
	</section>

	<section class="panel my-24 flex flex-col gap-6 p-8 md:p-12">
		<h2 class="text-4xl leading-none font-bold md:text-5xl">Skills</h2>
		<dl class="grid gap-x-8 gap-y-3 md:grid-cols-[max-content_1fr]">
			{
				skillGroups.map((group) => (
					<>
						<dt class="text-sm tracking-wider text-muted uppercase">{group.category}</dt>
						<dd>{group.items.join(" · ")}</dd>
					</>
				))
			}
		</dl>
	</section>

	<section data-anchor="turn" class="panel my-24 flex flex-col gap-6 p-8 md:p-12">
		<h2 class="text-4xl leading-none font-bold md:text-5xl">Contact</h2>
		<ul class="grid gap-4 sm:grid-cols-2">
			{
				contacts.map((contact) => (
					<li class="flex flex-col gap-1">
						<span class="text-sm tracking-wider text-muted uppercase">{contact.label}</span>
						<a href={contact.link} class="text-xl underline-offset-4 hover:underline">
							{contact.name}
						</a>
					</li>
				))
			}
		</ul>
		{showPosts && <a href="/posts" class="underline underline-offset-4">Posts →</a>}
	</section>
</Layout>
```

- [ ] **Step 2: Remove now-unused v5 homepage assets**

```bash
rm src/assets/svg/bottle.svg src/assets/img/av.png
grep -rn "bottle.svg\|av.png\|animate-motionspin" src
```
Expected: no matches except the `--animate-motionspin` / `@keyframes motionspin` block in `global.css` — delete that block (the `--animate-motionspin` line and the whole `@keyframes motionspin { ... }` rule).

- [ ] **Step 3: Add the panel class**

Append to `src/styles/global.css`:
```css
/* ─── Panels: content surfaces over the background ─── */
.panel {
	border: 1px solid var(--border);
	background-color: color-mix(in oklab, var(--bg) 78%, transparent);
	backdrop-filter: blur(12px);
}
```

- [ ] **Step 4: Verify**

```bash
npx astro check && npm run build
grep -o 'data-anchor="[a-z]*"' dist/index.html
```
Expected: `0 errors`; grep prints `entrance`, `pool`, `turn` in that order.

- [ ] **Step 5: Commit**

```bash
npx biome check --write src/pages/index.astro src/styles/global.css
git add -A
git commit -m "feat: homepage sections along the Poolrooms path with Anchors

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Capability detection

**Files:**
- Create: `src/lib/scene/capability.ts`, `src/lib/scene/capability.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `interface Environment { viewportWidth: number; coarsePointer: boolean; reducedMotion: boolean; webgl: boolean }`
  - `const MIN_3D_WIDTH = 1024`
  - `shouldRender3D(env: Environment): boolean`
  - `readEnvironment(win?: Window): Environment` (browser only)

- [ ] **Step 1: Write the failing tests**

`src/lib/scene/capability.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { type Environment, MIN_3D_WIDTH, shouldRender3D } from "./capability";

const desktop: Environment = {
	viewportWidth: 1440,
	coarsePointer: false,
	reducedMotion: false,
	webgl: true,
};

describe("shouldRender3D", () => {
	it("renders on a capable desktop", () => {
		expect(shouldRender3D(desktop)).toBe(true);
	});

	it("renders exactly at the width threshold", () => {
		expect(shouldRender3D({ ...desktop, viewportWidth: MIN_3D_WIDTH })).toBe(true);
	});

	it.each<[string, Partial<Environment>]>([
		["narrow viewport", { viewportWidth: MIN_3D_WIDTH - 1 }],
		["coarse pointer", { coarsePointer: true }],
		["reduced motion", { reducedMotion: true }],
		["no WebGL2", { webgl: false }],
	])("does not render with %s", (_, override) => {
		expect(shouldRender3D({ ...desktop, ...override })).toBe(false);
	});
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/lib/scene/capability.test.ts`
Expected: FAIL — cannot resolve `./capability`.

- [ ] **Step 3: Implement `src/lib/scene/capability.ts`**

```ts
export interface Environment {
	viewportWidth: number;
	coarsePointer: boolean;
	reducedMotion: boolean;
	webgl: boolean;
}

export const MIN_3D_WIDTH = 1024;

export function shouldRender3D(env: Environment): boolean {
	return (
		env.webgl && !env.reducedMotion && !env.coarsePointer && env.viewportWidth >= MIN_3D_WIDTH
	);
}

function hasWebGL2(doc: Document): boolean {
	try {
		const gl = doc.createElement("canvas").getContext("webgl2");
		if (!gl) return false;
		gl.getExtension("WEBGL_lose_context")?.loseContext();
		return true;
	} catch {
		return false;
	}
}

export function readEnvironment(win: Window = window): Environment {
	return {
		viewportWidth: win.innerWidth,
		coarsePointer: win.matchMedia("(pointer: coarse)").matches,
		reducedMotion: win.matchMedia("(prefers-reduced-motion: reduce)").matches,
		webgl: hasWebGL2(win.document),
	};
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- src/lib/scene/capability.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
npx biome check --write src/lib/scene
git add src/lib/scene
git commit -m "feat: decide when a device gets the 3D background

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Path math — Anchors, scroll→u, Alley factor, pointer look, damping

**Files:**
- Create: `src/lib/scene/path.ts`, `src/lib/scene/path.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type AnchorName = "entrance" | "pool" | "turn"`
  - `isAnchorName(value: string | undefined): value is AnchorName`
  - `const ANCHOR_U: Record<AnchorName, number>` = `{ entrance: 0, pool: 0.3, turn: 0.72 }`
  - `interface ScrollAnchor { scroll: number; u: number }`
  - `buildScrollAnchors(sections: { name: AnchorName; top: number }[], maxScroll: number): ScrollAnchor[]` — strictly increasing `scroll`, first is `{0,0}`, last has `u = 1` when `maxScroll > 0`
  - `scrollToU(scroll: number, anchors: ScrollAnchor[]): number`
  - `const ALLEY_START = 0.72`, `const ALLEY_END = 0.9`
  - `alleyFactor(u: number): number` — smoothstep 0→1 over `[ALLEY_START, ALLEY_END]`
  - `pointerLook(nx: number, ny: number): { yaw: number; pitch: number }` — inputs clamped to `[-1,1]`; `MAX_YAW = 0.12`, `MAX_PITCH = 0.06` (radians)
  - `damp(current: number, target: number, lambda: number, dt: number): number`
  - `const PATH_POINTS: readonly [number, number, number][]` — camera path (Poolrooms runs along −z, turns into the Alley along +x)

- [ ] **Step 1: Write the failing tests**

`src/lib/scene/path.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import {
	ALLEY_END,
	ALLEY_START,
	ANCHOR_U,
	alleyFactor,
	buildScrollAnchors,
	damp,
	isAnchorName,
	pointerLook,
	scrollToU,
} from "./path";

describe("isAnchorName", () => {
	it("accepts the three Anchors", () => {
		expect(["entrance", "pool", "turn"].every(isAnchorName)).toBe(true);
	});
	it("rejects typos and missing values", () => {
		expect(isAnchorName("pol")).toBe(false);
		expect(isAnchorName(undefined)).toBe(false);
	});
});

describe("buildScrollAnchors", () => {
	it("maps sections to their Anchor u between page top and bottom", () => {
		const anchors = buildScrollAnchors(
			[
				{ name: "entrance", top: 0 },
				{ name: "pool", top: 1000 },
				{ name: "turn", top: 3000 },
			],
			4000,
		);
		expect(anchors).toEqual([
			{ scroll: 0, u: 0 },
			{ scroll: 1000, u: ANCHOR_U.pool },
			{ scroll: 3000, u: ANCHOR_U.turn },
			{ scroll: 4000, u: 1 },
		]);
	});

	it("zero-height page: a single anchor at the start", () => {
		const anchors = buildScrollAnchors(
			[
				{ name: "pool", top: 0 },
				{ name: "turn", top: 0 },
			],
			0,
		);
		expect(anchors).toEqual([{ scroll: 0, u: 0 }]);
		expect(scrollToU(0, anchors)).toBe(0);
	});

	it("collapsed anchors: later Anchor wins, bottom still reaches u = 1", () => {
		const anchors = buildScrollAnchors(
			[
				{ name: "pool", top: 1000 },
				{ name: "turn", top: 5000 },
			],
			2000,
		);
		expect(anchors).toEqual([
			{ scroll: 0, u: 0 },
			{ scroll: 1000, u: ANCHOR_U.pool },
			{ scroll: 2000, u: 1 },
		]);
	});

	it("missing sections: falls back to a straight 0→1 mapping", () => {
		expect(buildScrollAnchors([], 500)).toEqual([
			{ scroll: 0, u: 0 },
			{ scroll: 500, u: 1 },
		]);
	});

	it("clamps negative tops to the page start", () => {
		const anchors = buildScrollAnchors([{ name: "pool", top: -200 }], 1000);
		expect(anchors[0]).toEqual({ scroll: 0, u: 0 });
		expect(anchors.every((a) => a.scroll >= 0)).toBe(true);
	});
});

describe("scrollToU", () => {
	const anchors = [
		{ scroll: 0, u: 0 },
		{ scroll: 1000, u: 0.3 },
		{ scroll: 2000, u: 1 },
	];
	it("interpolates within a segment", () => {
		expect(scrollToU(500, anchors)).toBeCloseTo(0.15);
		expect(scrollToU(1500, anchors)).toBeCloseTo(0.65);
	});
	it("clamps outside the range", () => {
		expect(scrollToU(-50, anchors)).toBe(0);
		expect(scrollToU(99999, anchors)).toBe(1);
	});
	it("returns 0 with no anchors", () => {
		expect(scrollToU(100, [])).toBe(0);
	});
});

describe("alleyFactor", () => {
	it("is 0 in Poolrooms and 1 deep in the Alley", () => {
		expect(alleyFactor(0)).toBe(0);
		expect(alleyFactor(ALLEY_START)).toBe(0);
		expect(alleyFactor(ALLEY_END)).toBe(1);
		expect(alleyFactor(1)).toBe(1);
	});
	it("rises smoothly in between", () => {
		const mid = alleyFactor((ALLEY_START + ALLEY_END) / 2);
		expect(mid).toBeCloseTo(0.5);
	});
});

describe("pointerLook", () => {
	it("is neutral at the centre", () => {
		expect(pointerLook(0, 0)).toEqual({ yaw: 0, pitch: 0 });
	});
	it("clamps input outside [-1, 1]", () => {
		expect(pointerLook(5, -5)).toEqual(pointerLook(1, -1));
	});
	it("looks toward the pointer (right → negative yaw, down → negative pitch)", () => {
		const { yaw, pitch } = pointerLook(1, 1);
		expect(yaw).toBeLessThan(0);
		expect(pitch).toBeLessThan(0);
	});
});

describe("damp", () => {
	it("moves toward the target without overshooting", () => {
		const next = damp(0, 1, 4, 1 / 60);
		expect(next).toBeGreaterThan(0);
		expect(next).toBeLessThan(1);
	});
	it("is frame-rate independent", () => {
		let a = 0;
		for (let i = 0; i < 2; i++) a = damp(a, 1, 4, 1 / 60);
		expect(a).toBeCloseTo(damp(0, 1, 4, 2 / 60));
	});
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/lib/scene/path.test.ts`
Expected: FAIL — cannot resolve `./path`.

- [ ] **Step 3: Implement `src/lib/scene/path.ts`**

```ts
export type AnchorName = "entrance" | "pool" | "turn";

export const ANCHOR_U: Record<AnchorName, number> = {
	entrance: 0,
	pool: 0.3,
	turn: 0.72,
};

export function isAnchorName(value: string | undefined): value is AnchorName {
	return value !== undefined && Object.hasOwn(ANCHOR_U, value);
}

export interface ScrollAnchor {
	scroll: number;
	u: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function buildScrollAnchors(
	sections: { name: AnchorName; top: number }[],
	maxScroll: number,
): ScrollAnchor[] {
	const points: ScrollAnchor[] = [{ scroll: 0, u: 0 }];
	for (const section of sections) {
		if (section.name === "entrance") continue;
		points.push({ scroll: clamp(section.top, 0, maxScroll), u: ANCHOR_U[section.name] });
	}
	points.push({ scroll: maxScroll, u: 1 });
	points.sort((a, b) => a.u - b.u);

	const anchors: ScrollAnchor[] = [];
	for (const point of points) {
		const prev = anchors.at(-1);
		if (!prev || point.scroll > prev.scroll) anchors.push(point);
		else if (anchors.length > 1) anchors[anchors.length - 1] = point;
	}
	return anchors;
}

export function scrollToU(scroll: number, anchors: ScrollAnchor[]): number {
	const first = anchors[0];
	if (!first) return 0;
	if (scroll <= first.scroll) return first.u;
	for (let i = 1; i < anchors.length; i++) {
		const a = anchors[i - 1];
		const b = anchors[i];
		if (scroll <= b.scroll) return a.u + ((scroll - a.scroll) / (b.scroll - a.scroll)) * (b.u - a.u);
	}
	return anchors[anchors.length - 1].u;
}

export const ALLEY_START = 0.72;
export const ALLEY_END = 0.9;

export function alleyFactor(u: number): number {
	const x = clamp((u - ALLEY_START) / (ALLEY_END - ALLEY_START), 0, 1);
	return x * x * (3 - 2 * x);
}

const MAX_YAW = 0.12;
const MAX_PITCH = 0.06;

export function pointerLook(nx: number, ny: number): { yaw: number; pitch: number } {
	return {
		yaw: -clamp(nx, -1, 1) * MAX_YAW || 0,
		pitch: -clamp(ny, -1, 1) * MAX_PITCH || 0,
	};
}

export function damp(current: number, target: number, lambda: number, dt: number): number {
	return target + (current - target) * Math.exp(-lambda * dt);
}

/** Camera path: down the Poolrooms hall (−z), then a turn into the Alley (+x). */
export const PATH_POINTS: readonly [number, number, number][] = [
	[0, 1.6, 0],
	[0, 1.6, -20],
	[0, 1.6, -38],
	[1, 1.6, -46],
	[6, 1.6, -48],
	[18, 1.6, -48],
];
```
(`|| 0` normalises `-0` to `0` so the neutral-centre test's `toEqual` passes.)

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- src/lib/scene/path.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
npx biome check --write src/lib/scene
git add src/lib/scene
git commit -m "feat: map scroll to the camera path through Anchors

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Static background with scroll-driven Alley darkening

**Files:**
- Create: `src/lib/scene/scroll.ts`, `src/components/SceneBackground.astro`
- Modify: `src/layouts/Layout.astro`, `src/pages/index.astro`, `src/styles/global.css`, `src/styles/light.css`

**Interfaces:**
- Consumes: `isAnchorName`, `buildScrollAnchors`, `scrollToU`, `alleyFactor` (Task 5).
- Produces:
  - `trackScrollU(onU: (u: number) => void, win?: Window): () => void` — measures `[data-anchor]` sections (top minus half a viewport), re-measures on body resize, calls `onU` immediately and on every scroll; returns a disposer.
  - `SceneBackground.astro` markup: `.scene-bg` > `.scene-bg__static`, `.scene-bg__alley`, `canvas.scene-bg__canvas[hidden]`.
  - `Layout` prop `scene?: boolean` (default `false`).
  - CSS custom property `--alley` on `<html>` (0–1), token `--content-alley`.

- [ ] **Step 1: Implement `src/lib/scene/scroll.ts`**

```ts
import { buildScrollAnchors, isAnchorName, type ScrollAnchor, scrollToU } from "./path";

export function trackScrollU(onU: (u: number) => void, win: Window = window): () => void {
	const doc = win.document;
	let anchors: ScrollAnchor[] = [];

	const update = () => onU(scrollToU(win.scrollY, anchors));

	const measure = () => {
		const maxScroll = Math.max(0, doc.documentElement.scrollHeight - win.innerHeight);
		const sections = [...doc.querySelectorAll<HTMLElement>("[data-anchor]")].flatMap((el) => {
			const name = el.dataset.anchor;
			if (!isAnchorName(name)) return [];
			const top = el.getBoundingClientRect().top + win.scrollY - win.innerHeight * 0.5;
			return [{ name, top }];
		});
		anchors = buildScrollAnchors(sections, maxScroll);
		update();
	};

	const observer = new ResizeObserver(measure);
	observer.observe(doc.body);
	win.addEventListener("scroll", update, { passive: true });
	measure();

	return () => {
		observer.disconnect();
		win.removeEventListener("scroll", update);
	};
}
```

- [ ] **Step 2: Create `src/components/SceneBackground.astro`**

```astro
<div class="scene-bg" aria-hidden="true">
	<div class="scene-bg__static"></div>
	<div class="scene-bg__alley"></div>
	<canvas class="scene-bg__canvas" hidden></canvas>
</div>

<script>
	import { alleyFactor } from "../lib/scene/path";
	import { trackScrollU } from "../lib/scene/scroll";

	const root = document.documentElement;
	trackScrollU((u) => {
		root.style.setProperty("--alley", alleyFactor(u).toFixed(3));
	});
</script>
```

- [ ] **Step 3: Add the `scene` prop to Layout**

In `src/layouts/Layout.astro`: import `SceneBackground from "../components/SceneBackground.astro";`, add `scene?: boolean;` to `Props`, destructure `scene = false`, and render `{scene && <SceneBackground />}` as the first child of `<body>`. Change the body class to `class:list={["font-sans", !scene && "bg-bg"]}` (text colour now comes from the `body { color }` rule below).

In `src/pages/index.astro` change the opening tag to `<Layout title="eitaar" description="eitaar's portfolio" scene>`.

- [ ] **Step 4: Styles — background layers and Alley-aware text**

Add to `src/styles/light.css` inside `[data-theme="light"]`:
```css
	--content-alley: #e6e8ea;
	--bg-alley: #050607;
```

Append to `src/styles/global.css`:
```css
/* ─── Scene background (see ADR 0001) ─── */
.scene-bg {
	position: fixed;
	inset: 0;
	z-index: -1;
	pointer-events: none;
}

.scene-bg > * {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
}

/* Placeholder Poolrooms: tile grid over pale aqua. Plan C swaps in a static render. */
.scene-bg__static {
	background-color: #eef6f7;
	background-image:
		linear-gradient(to right, rgb(0 0 0 / 0.06) 1px, transparent 1px),
		linear-gradient(to bottom, rgb(0 0 0 / 0.06) 1px, transparent 1px);
	background-size: 48px 48px;
}

.scene-bg__alley {
	background-color: var(--bg-alley);
	opacity: var(--alley, 0);
}

[data-scene="scene"] .scene-bg__static,
[data-scene="scene"] .scene-bg__alley {
	display: none;
}

/* Text and panels follow the Alley darkening. */
body {
	color: color-mix(in oklab, var(--content), var(--content-alley) calc(var(--alley, 0) * 100%));
}

.panel {
	background-color: color-mix(
		in oklab,
		color-mix(in oklab, var(--bg), var(--bg-alley) calc(var(--alley, 0) * 100%)) 78%,
		transparent
	);
}
```
(The second `.panel` rule overrides only `background-color` from Task 3.)

- [ ] **Step 5: Verify in the browser**

```bash
npx astro check && npm run bp
```
Then, using the agent-browser skill, open `http://localhost:4321/` at 1440×900:
- Top of page: pale tile grid visible behind the text; Hero text dark.
- Scroll to the very bottom: background is near-black, Contact text and footer are light and readable.
- Reload while scrolled to the bottom: ends dark once scripts run (a brief light flash before hydration is acceptable here; Plan B may inline an early `--alley` guess).
- Open `/projects`: no tile grid (plain `bg-bg`).

Stop the preview server afterwards.

- [ ] **Step 6: Commit**

```bash
npx biome check --write src/lib/scene src/components/SceneBackground.astro src/layouts src/pages/index.astro src/styles
git add -A
git commit -m "feat: static Poolrooms background darkening into the Alley on scroll

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Capability-gated Three.js scene

**Files:**
- Create: `src/lib/scene/background.ts`, `src/lib/scene/background.test.ts`, `src/lib/scene/poolrooms.ts`, `src/lib/scene/runtime.ts`
- Modify: `src/components/SceneBackground.astro`, `package.json`

**Interfaces:**
- Consumes: `Environment`, `shouldRender3D`, `readEnvironment` (Task 4); `PATH_POINTS`, `alleyFactor`, `pointerLook`, `damp` (Task 5); `trackScrollU` (Task 6).
- Produces:
  - `type BackgroundMode = "scene" | "static"`
  - `startBackground(deps: { env: Environment; mountScene: () => Promise<void>; setMode: (mode: BackgroundMode) => void }): Promise<BackgroundMode>`
  - `createUBridge(): { push(u: number): void; current(): number; connect(fn: (u: number) => void): void }`
  - `interface Poolrooms { scene: THREE.Scene; setAlley(factor: number): void; update(time: number): void; dispose(): void }`, `createPoolrooms(): Poolrooms` — **Plan C replaces the body of this function, keeping the interface.**
  - `interface SceneHandle { setU(u: number): void; dispose(): void }`, `mountScene(canvas: HTMLCanvasElement, initialU: number): SceneHandle`
  - `<html data-scene="scene|static">`

- [ ] **Step 1: Install Three.js**

```bash
npm install three@^0.186 && npm install -D @types/three@^0.186
```

- [ ] **Step 2: Write the failing orchestration tests**

`src/lib/scene/background.test.ts`:
```ts
import { describe, expect, it, vi } from "vitest";
import { createUBridge, startBackground } from "./background";
import type { Environment } from "./capability";

const capable: Environment = {
	viewportWidth: 1440,
	coarsePointer: false,
	reducedMotion: false,
	webgl: true,
};

describe("startBackground", () => {
	it("stays static and never mounts on an incapable device", async () => {
		const mountScene = vi.fn(async () => {});
		const setMode = vi.fn();
		const mode = await startBackground({
			env: { ...capable, reducedMotion: true },
			mountScene,
			setMode,
		});
		expect(mode).toBe("static");
		expect(mountScene).not.toHaveBeenCalled();
		expect(setMode).toHaveBeenCalledWith("static");
	});

	it("switches to the scene after a successful mount", async () => {
		const setMode = vi.fn();
		const mode = await startBackground({ env: capable, mountScene: async () => {}, setMode });
		expect(mode).toBe("scene");
		expect(setMode).toHaveBeenLastCalledWith("scene");
	});

	it("mount failure: falls back to static without throwing", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const setMode = vi.fn();
		const mode = await startBackground({
			env: capable,
			mountScene: async () => {
				throw new Error("Error creating WebGL context.");
			},
			setMode,
		});
		expect(mode).toBe("static");
		expect(setMode).toHaveBeenLastCalledWith("static");
		expect(warn).toHaveBeenCalled();
		warn.mockRestore();
	});
});

describe("createUBridge", () => {
	it("late connect: receives the latest u pushed before connecting", () => {
		const bridge = createUBridge();
		bridge.push(0.4);
		bridge.push(0.8);
		const fn = vi.fn();
		bridge.connect(fn);
		expect(fn).toHaveBeenCalledWith(0.8);
	});

	it("forwards later pushes after connecting", () => {
		const bridge = createUBridge();
		const fn = vi.fn();
		bridge.connect(fn);
		bridge.push(0.5);
		expect(fn).toHaveBeenLastCalledWith(0.5);
	});

	it("current() reports the latest u, 0 before any push", () => {
		const bridge = createUBridge();
		expect(bridge.current()).toBe(0);
		bridge.push(0.9);
		expect(bridge.current()).toBe(0.9);
	});

	it("connect before any push: starts at 0", () => {
		const fn = vi.fn();
		createUBridge().connect(fn);
		expect(fn).toHaveBeenCalledWith(0);
	});
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npm test -- src/lib/scene/background.test.ts`
Expected: FAIL — cannot resolve `./background`.

- [ ] **Step 4: Implement `src/lib/scene/background.ts`**

```ts
import { type Environment, shouldRender3D } from "./capability";

export type BackgroundMode = "scene" | "static";

export async function startBackground(deps: {
	env: Environment;
	mountScene: () => Promise<void>;
	setMode: (mode: BackgroundMode) => void;
}): Promise<BackgroundMode> {
	const { env, mountScene, setMode } = deps;
	if (!shouldRender3D(env)) {
		setMode("static");
		return "static";
	}
	try {
		await mountScene();
		setMode("scene");
		return "scene";
	} catch (error) {
		console.warn("[scene] falling back to the static background", error);
		setMode("static");
		return "static";
	}
}

export function createUBridge(): {
	push(u: number): void;
	current(): number;
	connect(fn: (u: number) => void): void;
} {
	let latest = 0;
	let target: ((u: number) => void) | undefined;
	return {
		push(u) {
			latest = u;
			target?.(u);
		},
		current() {
			return latest;
		},
		connect(fn) {
			target = fn;
			fn(latest);
		},
	};
}
```

- [ ] **Step 5: Run to verify pass**

Run: `npm test -- src/lib/scene/background.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 6: Implement the placeholder world `src/lib/scene/poolrooms.ts`**

```ts
import * as THREE from "three";

export interface Poolrooms {
	scene: THREE.Scene;
	setAlley(factor: number): void;
	update(time: number): void;
	dispose(): void;
}

const POOL_SKY = new THREE.Color("#eef6f7");
const ALLEY_DARK = new THREE.Color("#050607");

/** Placeholder geometry. Plan C replaces this body with the Blender scene; keep the interface. */
export function createPoolrooms(): Poolrooms {
	const scene = new THREE.Scene();
	const background = POOL_SKY.clone();
	const fog = new THREE.Fog(POOL_SKY.clone(), 8, 45);
	scene.background = background;
	scene.fog = fog;

	const tile = new THREE.MeshStandardMaterial({ color: "#f4f7f6", roughness: 0.35 });
	const water = new THREE.MeshStandardMaterial({
		color: "#7fd3dc",
		roughness: 0.08,
		transparent: true,
		opacity: 0.85,
	});
	const alleyWall = new THREE.MeshStandardMaterial({ color: "#1b1d1f", roughness: 0.9 });

	const box = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number) => {
		const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
		mesh.position.set(x, y, z);
		scene.add(mesh);
		return mesh;
	};

	// Poolrooms hall: z 0 → -52, 8 wide, 4.5 high
	box(8, 0.2, 52, tile, 0, -0.1, -26); // floor
	box(8, 0.2, 52, tile, 0, 4.5, -26); // ceiling
	box(0.2, 4.6, 52, tile, -4, 2.2, -26); // left wall
	box(0.2, 4.6, 46, tile, 4, 2.2, -23); // right wall up to the Alley opening (z -46)
	box(0.2, 4.6, 2, tile, 4, 2.2, -51); // right wall after the opening (z -50 to -52)
	box(8, 4.6, 0.2, tile, 0, 2.2, -52); // end wall

	// Pool around the centre Anchor
	box(5, 0.05, 18, water, 0, 0.02, -21);

	// Symbolic object placeholder, floating over the pool
	const symbol = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 0), tile);
	symbol.position.set(-1.8, 2.2, -24); // off the camera path (x = 0)
	scene.add(symbol);

	// Alley: narrow passage through the right-wall opening, running +x at z -48
	box(18, 0.2, 3, alleyWall, 13, -0.1, -48); // floor
	box(18, 0.2, 3, alleyWall, 13, 3.4, -48); // ceiling
	box(18, 3.6, 0.2, alleyWall, 13, 1.7, -46.5); // left wall
	box(18, 3.6, 0.2, alleyWall, 13, 1.7, -49.5); // right wall
	box(0.2, 3.6, 3, alleyWall, 22, 1.7, -48); // dead end: there is no exit

	const hemi = new THREE.HemisphereLight("#ffffff", "#bfe3e6", 1.4);
	scene.add(hemi);
	const lamps = [-8, -20, -32, -44].map((z) => {
		const lamp = new THREE.PointLight("#f3fbff", 12, 18);
		lamp.position.set(0, 4.2, z);
		scene.add(lamp);
		return lamp;
	});

	return {
		scene,
		setAlley(factor) {
			background.lerpColors(POOL_SKY, ALLEY_DARK, factor);
			fog.color.lerpColors(POOL_SKY, ALLEY_DARK, factor);
			fog.far = THREE.MathUtils.lerp(45, 12, factor);
			hemi.intensity = THREE.MathUtils.lerp(1.4, 0.04, factor);
			for (const lamp of lamps) lamp.intensity = THREE.MathUtils.lerp(12, 0, factor);
		},
		update(time) {
			symbol.rotation.y = time * 0.2;
			symbol.position.y = 2.2 + Math.sin(time * 0.6) * 0.08;
		},
		dispose() {
			scene.traverse((object) => {
				if (object instanceof THREE.Mesh) {
					object.geometry.dispose();
				}
			});
			for (const mat of [tile, water, alleyWall]) mat.dispose();
		},
	};
}
```

- [ ] **Step 7: Implement `src/lib/scene/runtime.ts`**

```ts
import * as THREE from "three";
import { alleyFactor, damp, PATH_POINTS, pointerLook } from "./path";
import { createPoolrooms } from "./poolrooms";

export interface SceneHandle {
	setU(u: number): void;
	dispose(): void;
}

const FOLLOW = 4;

export function mountScene(canvas: HTMLCanvasElement, initialU: number): SceneHandle {
	const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

	const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
	const world = createPoolrooms();
	const curve = new THREE.CatmullRomCurve3(PATH_POINTS.map(([x, y, z]) => new THREE.Vector3(x, y, z)));

	let targetU = initialU;
	let u = initialU;
	const look = { yaw: 0, pitch: 0 };
	let lookTarget = { yaw: 0, pitch: 0 };
	const position = new THREE.Vector3();
	const tangent = new THREE.Vector3();
	const lookAt = new THREE.Vector3();

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

	let frame = 0;
	let last = performance.now();
	const tick = (now: number) => {
		const dt = Math.min((now - last) / 1000, 0.1);
		last = now;
		u = damp(u, targetU, FOLLOW, dt);
		look.yaw = damp(look.yaw, lookTarget.yaw, FOLLOW, dt);
		look.pitch = damp(look.pitch, lookTarget.pitch, FOLLOW, dt);

		curve.getPointAt(u, position);
		curve.getTangentAt(u, tangent);
		camera.position.copy(position);
		camera.lookAt(lookAt.copy(position).add(tangent));
		camera.rotateY(look.yaw);
		camera.rotateX(look.pitch);

		world.setAlley(alleyFactor(u));
		world.update(now / 1000);
		renderer.render(world.scene, camera);
		frame = requestAnimationFrame(tick);
	};

	const onVisibility = () => {
		cancelAnimationFrame(frame);
		if (!document.hidden) {
			last = performance.now();
			frame = requestAnimationFrame(tick);
		}
	};

	resize();
	window.addEventListener("resize", resize);
	window.addEventListener("pointermove", onPointer, { passive: true });
	document.addEventListener("visibilitychange", onVisibility);
	frame = requestAnimationFrame(tick);

	return {
		setU(next) {
			targetU = next;
		},
		dispose() {
			cancelAnimationFrame(frame);
			window.removeEventListener("resize", resize);
			window.removeEventListener("pointermove", onPointer);
			document.removeEventListener("visibilitychange", onVisibility);
			world.dispose();
			renderer.dispose();
		},
	};
}
```

- [ ] **Step 8: Wire it in `src/components/SceneBackground.astro`**

Replace the `<script>` block with:
```astro
<script>
	import { createUBridge, startBackground } from "../lib/scene/background";
	import { readEnvironment } from "../lib/scene/capability";
	import { alleyFactor } from "../lib/scene/path";
	import { trackScrollU } from "../lib/scene/scroll";

	const root = document.documentElement;
	const canvas = document.querySelector<HTMLCanvasElement>(".scene-bg__canvas");
	const bridge = createUBridge();

	trackScrollU((u) => {
		root.style.setProperty("--alley", alleyFactor(u).toFixed(3));
		bridge.push(u);
	});

	if (canvas) {
		startBackground({
			env: readEnvironment(),
			mountScene: async () => {
				const { mountScene } = await import("../lib/scene/runtime");
				const handle = mountScene(canvas, bridge.current());
				bridge.connect((u) => handle.setU(u));
				canvas.hidden = false;
			},
			setMode: (mode) => {
				root.dataset.scene = mode;
			},
		});
	}
</script>
```
(`mountScene` runs inside the `try` of `startBackground`, so a WebGL failure reaches the static fallback; the bridge is connected only after a successful mount, so a failed mount is never retried on scroll. The scene starts at `bridge.current()`, the `u` for wherever the page already is. The dynamic `import()` keeps Three.js out of the bundle for static-mode visitors.)

- [ ] **Step 9: Verify tests, types, build, and bundle split**

```bash
npm test && npx astro check && npm run build
grep -l "WebGLRenderer" dist/_astro/*.js
grep -c "WebGLRenderer" dist/index.html
```
Expected: all tests pass; `0 errors`; Three.js appears only in a separate chunk under `dist/_astro/`, and count `0` in `dist/index.html`.

- [ ] **Step 10: Verify in the browser**

`npm run bp`, then with the agent-browser skill:
1. **1440×900, default:** `document.documentElement.dataset.scene === "scene"`; the tiled hall renders; scrolling moves forward past the pool and turns right into darkness at Contact; moving the pointer slightly turns the view; text stays readable on panels.
2. **1440×900, reload scrolled to the bottom:** the scene starts in the Alley (dark), not at the entrance.
3. **1440×900 with `prefers-reduced-motion: reduce` emulated:** `dataset.scene === "static"`, no canvas visible, tile grid fallback shown.
4. **390×844 (mobile):** `dataset.scene === "static"`; network panel shows no Three.js chunk requested.
5. **Console:** no errors in any of the above.

Stop the preview server afterwards. If step 1 renders but is visibly wrong (e.g. camera inside a wall), adjust `PATH_POINTS` / box positions and re-run — do not change `ANCHOR_U` without re-running `npm test`.

- [ ] **Step 11: Commit**

```bash
npx biome check --write src/lib/scene src/components/SceneBackground.astro package.json
git add -A
git commit -m "feat: Three.js Poolrooms background on capable desktops with static fallback

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Preview deployment on workers.dev

**Files:**
- Modify: none (uses `wrangler.jsonc` from Task 1).

**Interfaces:**
- Consumes: the built site.
- Produces: a live preview at `https://eitaar-dev-v6.<account-subdomain>.workers.dev`. eitaar.dev is **not** changed.

- [ ] **Step 1: Confirm with the user before deploying** — this publishes the site publicly on workers.dev. Proceed only after an explicit yes.

- [ ] **Step 2: Build and deploy**

```bash
npm run build && npx wrangler deploy
```
Expected: output ends with the deployed `*.workers.dev` URL. If wrangler asks to log in, ask the user to run `! npx wrangler login` and retry.

- [ ] **Step 3: Smoke-test the preview**

With the agent-browser skill, repeat Task 7 Step 10 checks 1 and 4 against the workers.dev URL, plus: `/projects/yot` shows Server and Client repo rows; `/projects/yot-client` returns the 404 page; no Posts link in the header.

- [ ] **Step 4: Record the preview URL**

Add a line under `## Commands` in `CLAUDE.md`:
```markdown
Preview deployment: <the workers.dev URL from Step 2> (`npx wrangler deploy`). eitaar.dev still serves v5 until the MVP is complete.
```
```bash
git add CLAUDE.md
git commit -m "docs: record v6 preview URL

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
