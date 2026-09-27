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
