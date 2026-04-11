import type { ContentIndex, ContentPage } from "./types.ts";

interface TagEntry {
	displayName: string;
	pages: ContentPage[];
}

/**
 * Collect unique tags from all pages, preserving the original casing of the
 * first occurrence. Deduplication is case-insensitive.
 */
function collectTags(index: ContentIndex): Map<string, TagEntry> {
	const tagMap = new Map<string, TagEntry>();

	for (const page of index.pages) {
		for (const tag of page.tags) {
			const key = tag.toLowerCase();
			const existing = tagMap.get(key);
			if (existing) {
				existing.pages.push(page);
			} else {
				tagMap.set(key, { displayName: tag, pages: [page] });
			}
		}
	}

	return tagMap;
}

function generateTagPageContent(
	displayName: string,
	pages: ContentPage[],
): string {
	const listItems = pages
		.map((p) => {
			const label = p.title ?? p.baseName;
			return `- [${label}](${p.routePath})`;
		})
		.join("\n");

	return [
		"---",
		`title: "#${displayName}"`,
		"---",
		"",
		`# #${displayName}`,
		"",
		listItems,
		"",
	].join("\n");
}

export interface AdditionalPage {
	routePath: string;
	content: string;
}

/**
 * Generate one AdditionalPage per unique tag found across all indexed pages.
 * Each page is served at /tags/{displayName} and lists all pages with that tag.
 */
export function generateTagPages(index: ContentIndex): AdditionalPage[] {
	const tagMap = collectTags(index);

	return [...tagMap.entries()].map(([, { displayName, pages }]) => ({
		routePath: `/tags/${displayName}`,
		content: generateTagPageContent(displayName, pages),
	}));
}
