import { getCollection } from "astro:content";
import rss from "@astrojs/rss";

export async function GET(context) {
	const posts = await getCollection("posts");
	return rss({
		title: "eitaar.dev",
		description: "Posts from eitaar.dev",
		site: context.site,
		items: posts.map((post) => ({
			...post.data,
			link: `/posts/${post.id}/`,
		})),
	});
}
