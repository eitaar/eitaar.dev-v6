// @ts-check

import { rm } from "node:fs/promises";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import icon from "astro-icon";
// https://astro.build/config
export default defineConfig({
	site: "https://eitaar.dev",
	compressHTML: true,
	integrations: [
		mdx(),
		sitemap({ filter: (page) => !page.includes("/lab") }),
		icon(),
		{
			name: "drop-lab",
			hooks: {
				"astro:build:done": async ({ dir }) => {
					await rm(new URL("lab/", dir), { recursive: true, force: true });
				},
			},
		},
	],
	vite: {
		plugins: [tailwindcss()],
	},
});
