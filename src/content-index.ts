import fs from "node:fs";
import path from "node:path";
import GithubSlugger from "github-slugger";
import { normalizeLookupValue, stripMarkdownFormatting } from "./slug.ts";
import type {
	BlockEntry,
	ContentIndex,
	ContentPage,
	HeadingEntry,
} from "./types.ts";
import { normalizeFsPath, normalizePathKey } from "./utils.ts";

const MARKDOWN_EXTENSIONS = new Set([".md", ".mdx"]);
const contentIndexCache = new Map<
	string,
	{ signature: string; index: ContentIndex }
>();

interface MarkdownFileEntry {
	absolutePath: string;
	relativePath: string;
	mtimeMs: number;
	size: number;
}

/**
 * Scan `rootDir` for `.md`/`.mdx` files and build a fresh {@link ContentIndex}
 * with pre-computed lookup tables (by path, basename, title, alias, tag).
 * Always bypasses the module-level cache — prefer {@link getCachedContentIndex}
 * for repeated builds.
 */
export async function buildContentIndex(
	rootDir: string,
): Promise<ContentIndex> {
	const absoluteRoot = path.resolve(rootDir);
	const files = scanMarkdownFiles(absoluteRoot);
	return buildContentIndexFromFiles(absoluteRoot, files);
}

/**
 * Like {@link buildContentIndex} but memoized on a per-root basis. The cache
 * is invalidated whenever the set of markdown files, their mtimes, or sizes
 * change — safe for Rspress dev-server file-watching.
 */
export async function getCachedContentIndex(
	rootDir: string,
): Promise<ContentIndex> {
	const absoluteRoot = path.resolve(rootDir);
	const files = scanMarkdownFiles(absoluteRoot);
	const signature = files
		.map((file) => `${file.relativePath}:${file.mtimeMs}:${file.size}`)
		.join("|");

	const cached = contentIndexCache.get(absoluteRoot);
	if (cached?.signature === signature) {
		return cached.index;
	}

	const index = await buildContentIndexFromFiles(absoluteRoot, files);
	contentIndexCache.set(absoluteRoot, { signature, index });
	return index;
}

async function buildContentIndexFromFiles(
	rootDir: string,
	files: MarkdownFileEntry[],
): Promise<ContentIndex> {
	const settled = await Promise.allSettled(
		files.map((file) => buildContentPage(file)),
	);
	const pages: ContentPage[] = [];
	for (const result of settled) {
		if (result.status === "fulfilled") {
			pages.push(result.value);
		} else {
			console.warn(
				`[rspress-plugin-obsidian-wikilink] Failed to index file: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`,
			);
		}
	}
	const byAbsolutePath = new Map<string, ContentPage>();
	const byPathKey = new Map<string, ContentPage>();
	const byBaseName = new Map<string, ContentPage[]>();
	const byTitle = new Map<string, ContentPage[]>();
	const byAlias = new Map<string, ContentPage[]>();
	const byTag = new Map<string, ContentPage[]>();

	for (const page of pages) {
		byAbsolutePath.set(page.absolutePath, page);
		byPathKey.set(page.pathKey, page);

		if (page.baseName.length > 0) {
			const existing = byBaseName.get(page.baseName) ?? [];
			existing.push(page);
			byBaseName.set(page.baseName, existing);
		}

		if (page.title) {
			pushNamedPage(byTitle, page.title, page);
		}

		for (const alias of page.aliases) {
			pushNamedPage(byAlias, alias, page);
		}

		for (const tag of page.tags) {
			pushNamedPage(byTag, tag, page);
			// For nested tags like "parent/child/leaf", also aggregate into
			// each ancestor segment so byTag["parent"] includes the page too.
			const parts = tag.split("/");
			for (let depth = 1; depth < parts.length; depth++) {
				pushNamedPage(byTag, parts.slice(0, depth).join("/"), page);
			}
		}
	}

	return {
		rootDir,
		pages,
		byAbsolutePath,
		byPathKey,
		byBaseName,
		byTitle,
		byAlias,
		byTag,
	};
}

function scanMarkdownFiles(rootDir: string): MarkdownFileEntry[] {
	const results: MarkdownFileEntry[] = [];
	const queue = [rootDir];

	while (queue.length > 0) {
		const currentDir = queue.shift();
		if (!currentDir) {
			continue;
		}

		const entries = fs.readdirSync(currentDir, { withFileTypes: true });

		for (const entry of entries) {
			const absolutePath = path.join(currentDir, entry.name);

			if (entry.isDirectory()) {
				if (
					entry.name === ".git" ||
					entry.name === "node_modules" ||
					entry.name.startsWith(".")
				) {
					continue;
				}

				queue.push(absolutePath);
				continue;
			}

			if (!entry.isFile()) {
				continue;
			}

			if (!MARKDOWN_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
				continue;
			}

			const relativePath = normalizeFsPath(
				path.relative(rootDir, absolutePath),
			);
			if (!isRoutableRelativePath(relativePath)) {
				continue;
			}

			const stats = fs.statSync(absolutePath);
			results.push({
				absolutePath: normalizeFsPath(path.resolve(absolutePath)),
				relativePath,
				mtimeMs: stats.mtimeMs,
				size: stats.size,
			});
		}
	}

	results.sort((left, right) =>
		left.relativePath.localeCompare(right.relativePath),
	);
	return results;
}

function isRoutableRelativePath(relativePath: string): boolean {
	return relativePath.split("/").every((segment) => !/^_[^_]/.test(segment));
}

async function buildContentPage(file: MarkdownFileEntry): Promise<ContentPage> {
	const markdown = await fs.promises.readFile(file.absolutePath, "utf-8");
	const routePath = deriveRoutePath(file.relativePath);
	const pathKey = normalizePathKey(file.relativePath);
	const baseName = path.basename(pathKey);
	const { title, aliases, tags, cssclasses, excerpt } =
		extractFrontmatterMetadata(markdown);
	const headings = extractHeadings(markdown);
	const blocks = extractBlocks(markdown);

	return {
		absolutePath: file.absolutePath,
		relativePath: file.relativePath,
		routePath,
		pathKey,
		baseName,
		title,
		aliases,
		tags,
		cssclasses,
		excerpt,
		headings,
		blocks,
	};
}

function deriveRoutePath(relativePath: string): string {
	const withoutExtension = relativePath.replace(/\.(md|mdx)$/i, "");
	const routeKey = normalizePathKey(withoutExtension);
	return routeKey.length === 0 ? "/" : `/${routeKey}`;
}

export { normalizePathKey } from "./utils.ts";

function getContentLineFlags(lines: string[]): boolean[] {
	const flags = new Array<boolean>(lines.length).fill(false);
	let inFence = false;
	let inFrontmatter = lines[0]?.trim() === "---";

	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index] ?? "";

		if (inFrontmatter) {
			if (index > 0 && line.trim() === "---") {
				inFrontmatter = false;
			}
			continue;
		}

		if (/^(```|~~~)/.test(line.trim())) {
			inFence = !inFence;
			continue;
		}

		if (inFence) {
			continue;
		}

		flags[index] = true;
	}

	return flags;
}

function extractHeadings(markdown: string): HeadingEntry[] {
	const slugger = new GithubSlugger();
	const headings: HeadingEntry[] = [];
	const lines = markdown.split(/\r?\n/);
	const isContent = getContentLineFlags(lines);

	for (let index = 0; index < lines.length; index += 1) {
		if (!isContent[index]) {
			continue;
		}

		const line = lines[index] ?? "";

		const atxMatch = /^\s{0,3}(#{1,6})[ \t]+(.+?)[ \t]*#*[ \t]*$/.exec(line);
		if (atxMatch) {
			pushHeading(headings, slugger, atxMatch[2] ?? "");
			continue;
		}

		const nextLine = lines[index + 1] ?? "";
		if (!/^\s{0,3}(=+|-+)\s*$/.test(nextLine)) {
			continue;
		}

		const rawHeading = line.trim();
		if (rawHeading.length === 0) {
			continue;
		}

		pushHeading(headings, slugger, rawHeading);
		index += 1; // skip the setext underline on the next iteration
	}

	return headings;
}

function extractBlocks(markdown: string): BlockEntry[] {
	const blocks: BlockEntry[] = [];
	const seen = new Set<string>();
	const lines = markdown.split(/\r?\n/);
	const isContent = getContentLineFlags(lines);

	for (let index = 0; index < lines.length; index += 1) {
		if (!isContent[index]) {
			continue;
		}

		const line = lines[index] ?? "";

		const standaloneMatch = /^\^([A-Za-z0-9-]+)\s*$/.exec(line.trim());
		if (standaloneMatch?.[1]) {
			pushBlock(blocks, seen, standaloneMatch[1]);
			continue;
		}

		const explicitIdMatch = line.match(/\{#([A-Za-z0-9-]+)\}\s*$/);
		if (explicitIdMatch?.[1] && !/^\s{0,3}(#{1,6})[ \t]+/.test(line)) {
			pushBlock(blocks, seen, explicitIdMatch[1]);
			continue;
		}

		// Inline block ID: "Paragraph text ^block-id" appended at end of line
		const inlineBlockMatch = /\s\^([A-Za-z0-9-]+)\s*$/.exec(line);
		if (inlineBlockMatch?.[1]) {
			pushBlock(blocks, seen, inlineBlockMatch[1]);
		}
	}

	return blocks;
}

function pushBlock(blocks: BlockEntry[], seen: Set<string>, id: string): void {
	const normalizedId = id.trim();
	if (!normalizedId || seen.has(normalizedId)) {
		return;
	}

	seen.add(normalizedId);
	blocks.push({ id: normalizedId });
}

function pushHeading(
	headings: HeadingEntry[],
	slugger: GithubSlugger,
	rawHeading: string,
): void {
	const trimmedHeading = rawHeading.trim();
	const explicitIdMatch = trimmedHeading.match(
		/\s*\{#([A-Za-z0-9_:.-]+)\}\s*$/,
	);
	const explicitId = explicitIdMatch?.[1];
	const headingText = explicitIdMatch
		? trimmedHeading
				.slice(0, trimmedHeading.length - explicitIdMatch[0].length)
				.trim()
		: trimmedHeading;
	const normalizedText = stripMarkdownFormatting(headingText);

	if (normalizedText.length === 0) {
		return;
	}

	headings.push({
		rawText: normalizedText,
		slug: slugger.slug(normalizedText),
		explicitId,
	});
}

function extractFrontmatterMetadata(markdown: string): {
	title?: string;
	aliases: string[];
	tags: string[];
	cssclasses: string[];
	excerpt?: string;
} {
	const lines = markdown.split(/\r?\n/);
	if (lines[0]?.trim() !== "---") {
		return { aliases: [], tags: [], cssclasses: [] };
	}

	const closingIndex = lines.findIndex(
		(line, index) => index > 0 && line.trim() === "---",
	);
	if (closingIndex < 0) {
		console.warn(
			`[rspress-plugin-obsidian-wikilink] Malformed frontmatter in file: opening "---" found but no closing "---". Frontmatter metadata will be ignored.`,
		);
		return { aliases: [], tags: [], cssclasses: [] };
	}

	let title: string | undefined;
	let excerpt: string | undefined;
	const aliases: string[] = [];
	const tags: string[] = [];
	const cssclasses: string[] = [];
	let pendingListKey: "aliases" | "tags" | "cssclasses" | undefined;

	for (let index = 1; index < closingIndex; index += 1) {
		const line = lines[index] ?? "";

		if (
			pendingListKey === "aliases" ||
			pendingListKey === "tags" ||
			pendingListKey === "cssclasses"
		) {
			const listItemMatch = /^\s*-\s+(.+?)\s*$/.exec(line);
			if (listItemMatch?.[1]) {
				const itemValue = stripWrappingQuotes(listItemMatch[1].trim());
				if (itemValue) {
					if (pendingListKey === "aliases") {
						aliases.push(itemValue);
					} else if (pendingListKey === "tags") {
						tags.push(itemValue);
					} else {
						cssclasses.push(itemValue);
					}
				}
				continue;
			}

			if (line.trim().length === 0) {
				continue;
			}

			pendingListKey = undefined;
		}

		const keyMatch = /^\s*([A-Za-z0-9_-]+)\s*:\s*(.*?)\s*$/.exec(line);
		if (!keyMatch) {
			continue;
		}

		const rawKey = keyMatch[1];
		const rawValue = keyMatch[2];
		if (typeof rawKey !== "string" || typeof rawValue !== "string") {
			continue;
		}

		const key = rawKey.toLowerCase();
		const value = rawValue.trim();

		if (key === "title") {
			const parsedTitle = stripWrappingQuotes(value);
			if (parsedTitle) {
				title = parsedTitle;
			}
			continue;
		}

		if (key === "excerpt") {
			excerpt = stripWrappingQuotes(value) || undefined;
			continue;
		}

		if (key === "aliases" || key === "alias") {
			if (value.length === 0) {
				pendingListKey = "aliases";
				continue;
			}
			for (const alias of parseInlineAliases(value)) {
				aliases.push(alias);
			}
			continue;
		}

		if (key === "tags" || key === "tag") {
			if (value.length === 0) {
				pendingListKey = "tags";
				continue;
			}
			for (const tag of parseInlineAliases(value)) {
				tags.push(tag);
			}
			continue;
		}

		if (key === "cssclasses" || key === "cssclass") {
			if (value.length === 0) {
				pendingListKey = "cssclasses";
				continue;
			}
			for (const cls of parseInlineAliases(value)) {
				cssclasses.push(cls);
			}
		}
	}

	return {
		title,
		excerpt,
		aliases: [...new Set(aliases)],
		tags: [...new Set(tags)],
		cssclasses: [...new Set(cssclasses)],
	};
}

function parseInlineAliases(value: string): string[] {
	const trimmed = value.trim();
	if (!trimmed) {
		return [];
	}

	const listMatch = /^\[(.*)\]$/.exec(trimmed);
	if (!listMatch) {
		const alias = stripWrappingQuotes(trimmed);
		return alias ? [alias] : [];
	}

	const listValue = listMatch[1];
	if (typeof listValue !== "string") {
		return [];
	}

	return listValue
		.split(",")
		.map((part) => stripWrappingQuotes(part.trim()))
		.filter((part): part is string => part.length > 0);
}

function stripWrappingQuotes(value: string): string {
	return value.replace(/^(["'])(.*)\1$/, "$2").trim();
}

function pushNamedPage(
	map: Map<string, ContentPage[]>,
	rawValue: string,
	page: ContentPage,
): void {
	const key = normalizeLookupValue(rawValue);
	if (!key) {
		return;
	}

	const existing = map.get(key) ?? [];
	existing.push(page);
	map.set(key, existing);
}

export { normalizeFsPath } from "./utils.ts";
