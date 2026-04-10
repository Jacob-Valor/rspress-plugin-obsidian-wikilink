import fs from "node:fs";
import path from "node:path";
import type { ContentIndex } from "./types.ts";

const WIKILINK_RE = /!?\[\[([^\]]+?)\]\]/g;

export async function buildBacklinksIndex(
	index: ContentIndex,
): Promise<Map<string, { routePath: string; title: string }[]>> {
	const backlinks = new Map<string, { routePath: string; title: string }[]>();

	for (const page of index.pages) {
		let content: string;
		try {
			content = await fs.promises.readFile(page.absolutePath, "utf-8");
		} catch {
			continue;
		}

		for (const match of content.matchAll(WIKILINK_RE)) {
			const inner = match[1] ?? "";
			const target = inner.split("|")[0]?.split("#")[0]?.trim() ?? "";
			if (!target) continue;

			const exactKey = target.replace(/\\/g, "/").toLowerCase();
			for (const candidate of index.pages) {
				if (candidate.absolutePath === page.absolutePath) continue;

				const isMatch =
					candidate.pathKey.toLowerCase() === exactKey ||
					candidate.baseName.toLowerCase() === exactKey ||
					candidate.baseName.toLowerCase() === path.basename(exactKey);

				if (isMatch) {
					const existing = backlinks.get(candidate.routePath) ?? [];
					const already = existing.some((e) => e.routePath === page.routePath);
					if (!already) {
						existing.push({
							routePath: page.routePath,
							title: page.title ?? page.baseName,
						});
						backlinks.set(candidate.routePath, existing);
					}
				}
			}
		}
	}

	return backlinks;
}

export function renderBacklinksHtml(
	refs: { routePath: string; title: string }[],
): string {
	if (refs.length === 0) return "";
	const items = refs
		.map((r) => `<li><a href="${r.routePath}">${r.title}</a></li>`)
		.join("\n");
	return `<div class="obsidian-backlinks">\n<h2>Backlinks</h2>\n<ul>\n${items}\n</ul>\n</div>`;
}
