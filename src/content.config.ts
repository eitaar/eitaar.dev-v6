import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const posts = defineCollection({
	loader: glob({ base: "./src/content/posts", pattern: "**/*.{md,mdx}" }),
	// Type-check frontmatter using a schema
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			description: z.string(),
			pubDate: z.coerce.date(),
			updatedDate: z.coerce.date().optional(),
			heroImage: z.optional(image()),
			tags: z.array(z.string()).default([]),
		}),
});

const projects = defineCollection({
	loader: glob({ base: "./src/content/projects", pattern: "**/*.{md,mdx}" }),
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			summary: z.string(),
			category: z.string(),
			pubDate: z.coerce.date(),
			repoUrl: z.optional(z.url()),
			demoUrl: z.optional(z.url()),
			techStack: z.array(z.string()),
			heroImage: z.optional(image()),
			topProject: z.optional(z.boolean()),
		}),
});

export const collections = { posts, projects };
