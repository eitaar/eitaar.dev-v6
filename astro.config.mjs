// @ts-check

import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import icon from "astro-icon";
// https://astro.build/config
export default defineConfig({
	site: "https://eitaar.dev",
	compressHTML: true,
	integrations: [mdx(), sitemap(), icon()],
	vite: {
		plugins: [tailwindcss()],
	},
});
