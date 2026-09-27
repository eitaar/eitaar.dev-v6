interface SkillGroup {
	category: string;
	items: string[];
}

export const skillGroups: SkillGroup[] = [
	{
		category: "Language / Library / Framework",
		items: ["javascript", "typescript", "vue", "nuxt", "astro", "tailwind", "python"],
	},
	{
		category: "Creativity",
		items: ["figma", "blockbench", "fusion360", "affinity"],
	},
	{
		category: "Tools",
		items: ["git", "github", "vscode", "claude code", "codex"],
	},
	{
		category: "Learning",
		items: ["rust", "pytorch", "blender", "latex"],
	},
];
