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
