import fs from "node:fs";
import path from "node:path";
import type {
	Blockquote,
	HTML,
	Link,
	PhrasingContent,
	Root,
	Text,
} from "mdast";
import { type RemarkPluginFactory, unistVisit } from "rspress-plugin-devkit";
import type { Parent } from "unist";
import type { VFile } from "vfile";
import { getCachedBacklinksIndex, renderBacklinksHtml } from "./backlinks.ts";
import { getCachedContentIndex } from "./content-index.ts";
import { findWikilinkMatches, parseWikiLink } from "./parse-wikilink.ts";
import { resolveWikiLink } from "./resolve-wikilink.ts";
import type {
	ContentIndex,
	ContentPage,
	NormalizedPluginOptions,
	RemarkWikiLinkPluginOptions,
} from "./types.ts";
import { normalizeFsPath } from "./utils.ts";

// Tags must start with a letter or underscore (not a digit) and must not be
// preceded by a word character or "/" (prevents matching URL fragments,
// hex colour codes, and markdown heading anchors).
const TAG_PATTERN = /(?<![/\w])#([a-zA-Z_][a-zA-Z0-9_-]*)/g;
// Capture optional fold operator: '+' = expanded, '-' = collapsed, absent = static
const CALLOUT_HEADER_PATTERN = /^\[!(\w+)\]([-+])?\s*(.*)$/;
// Obsidian inline and block comments: %% ... %%
const COMMENT_PATTERN = /%%[\s\S]*?%%/g;

const WIKILINK_EMBED_PATTERN = /!\[\[([^\]]+)\]\]/g;

const IMAGE_EXTS = new Set([
	"png",
	"jpg",
	"jpeg",
	"gif",
	"svg",
	"webp",
	"avif",
]);
const AUDIO_EXTS = new Set(["mp3", "wav", "ogg", "m4a", "flac"]);
const VIDEO_EXTS = new Set(["mp4", "webm", "mov", "mkv"]);
const PDF_EXT = "pdf";

const CALLOUT_ICONS: Record<string, string> = {
	note: "📝",
	tip: "💡",
	warning: "⚠️",
	danger: "🚨",
	info: "ℹ️",
	success: "✅",
	question: "❓",
	bug: "🐛",
	example: "📋",
	quote: "📜",
	abstract: "📋",
	failure: "❌",
	caution: "⚠️",
};

// Maps Obsidian callout type aliases to their canonical type for icon lookup.
const CALLOUT_TYPE_ALIASES: Record<string, string> = {
	abstract: "abstract",
	summary: "abstract",
	tldr: "abstract",
	check: "success",
	done: "success",
	help: "question",
	faq: "question",
	caution: "caution",
	attention: "caution",
	failure: "failure",
	fail: "failure",
	missing: "failure",
};

const SKIP_PARENT_TYPES = new Set([
	"link",
	"linkReference",
	"definition",
	"inlineCode",
	"code",
	"html",
	"mdxJsxTextElement",
	"mdxJsxFlowElement",
	"mdxFlowExpression",
	"mdxTextExpression",
]);

export const remarkWikilink: RemarkPluginFactory<RemarkWikiLinkPluginOptions> =
	({ getDocsRoot, options }) =>
	async (tree: Root, file: VFile): Promise<void> => {
		const docsRoot = getDocsRoot();
		const index = await getCachedContentIndex(docsRoot);
		const currentFilePath = getCurrentFilePath(file);

		if (!currentFilePath) {
			return;
		}

		const currentPage = index.byAbsolutePath.get(currentFilePath);
		if (!currentPage) {
			return;
		}

		const resolveOptions = {
			enableFuzzyMatching: options.enableFuzzyMatching,
			enableCaseInsensitiveLookup: options.enableCaseInsensitiveLookup,
		};

		// Strip Obsidian comments (%% ... %%) before all other transforms.
		unistVisit(tree, "text", (node, position, parent) => {
			if (!node.value.includes("%%")) return;
			const stripped = node.value.replace(COMMENT_PATTERN, "");
			if (stripped === node.value) return;

			if (
				stripped.trim().length === 0 &&
				parent &&
				typeof position === "number"
			) {
				// Remove the now-empty text node from its parent
				(parent as Parent & { children: unknown[] }).children.splice(
					position,
					1,
				);
				return;
			}

			node.value = stripped;
		});

		if (options.enableTagLinking) {
			unistVisit(tree, "text", (node, position, parent) => {
				if (!parent || typeof position !== "number") {
					return;
				}

				if (SKIP_PARENT_TYPES.has(parent.type)) {
					return;
				}

				const text = node.value;
				if (!text.includes("#")) {
					return;
				}

				const tags = [...text.matchAll(TAG_PATTERN)];
				if (tags.length === 0) {
					return;
				}

				const replacementNodes: PhrasingContent[] = [];
				let cursor = 0;

				for (const tag of tags) {
					const start = tag.index ?? 0;
					const fullMatch = tag[0] ?? "";
					const tagName = tag[1] ?? "";

					if (start > cursor) {
						replacementNodes.push(createTextNode(text.slice(cursor, start)));
					}

					replacementNodes.push(createLinkNode(`/tags/${tagName}`, fullMatch));
					cursor = start + fullMatch.length;
				}

				if (cursor < text.length) {
					replacementNodes.push(createTextNode(text.slice(cursor)));
				}

				const parentWithChildren = parent as Parent & {
					children: PhrasingContent[];
				};
				parentWithChildren.children.splice(position, 1, ...replacementNodes);
			});
		}

		if (options.enableCallouts) {
			unistVisit(tree, "blockquote", (node, position, parent) => {
				if (!parent || typeof position !== "number") {
					return;
				}

				const bq = node as Blockquote;
				const firstPara = bq.children[0];
				if (!firstPara || firstPara.type !== "paragraph") {
					return;
				}

				const firstText = firstPara.children.find(
					(c): c is Text => c.type === "text",
				);
				if (!firstText) {
					return;
				}

				const lines = firstText.value.split("\n");
				const headerLine = lines[0] ?? "";
				const calloutMatch = CALLOUT_HEADER_PATTERN.exec(headerLine);
				if (!calloutMatch) {
					return;
				}

				const rawType = calloutMatch[1]?.toLowerCase() ?? "note";
				const calloutType = CALLOUT_TYPE_ALIASES[rawType] ?? rawType;
				const foldState = calloutMatch[2]; // '+' | '-' | undefined
				const calloutTitle = calloutMatch[3]?.trim() || rawType;
				const icon = CALLOUT_ICONS[calloutType] ?? "📝";

				const remainingLines = lines.slice(1);
				if (remainingLines.length === 0) {
					bq.children.shift();
				} else {
					firstText.value = remainingLines.join("\n");
				}

				const replacements: Root["children"] = buildCalloutNodes(
					calloutType,
					calloutTitle,
					icon,
					foldState,
					bq.children as Root["children"],
				);

				const parentNode = parent as Parent & { children: Root["children"] };
				parentNode.children.splice(position, 1, ...replacements);
			});
		}

		if (options.enableMediaEmbeds || options.enableTransclusion) {
			// Two-pass approach: collect nodes to process, then resolve async
			interface EmbedWork {
				node: Text;
			}
			const embedNodes: EmbedWork[] = [];

			unistVisit(tree, "text", (node, _position, parent) => {
				if (!parent || SKIP_PARENT_TYPES.has(parent.type)) return;
				if (!node.value.includes("![[")) return;
				const embedMatches = [...node.value.matchAll(WIKILINK_EMBED_PATTERN)];
				if (embedMatches.length > 0) {
					embedNodes.push({ node });
				}
			});

			// Process all embed nodes with proper async file reads
			for (const { node } of embedNodes) {
				const text = node.value;
				const embedMatches = [...text.matchAll(WIKILINK_EMBED_PATTERN)];
				if (embedMatches.length === 0) continue;

				let result = "";
				let lastEnd = 0;

				for (const match of embedMatches) {
					const start = match.index ?? 0;
					const fullMatch = match[0];
					const inner = match[1] ?? "";

					if (start > lastEnd) {
						result += text.slice(lastEnd, start);
					}

					const pipeIdx = inner.indexOf("|");
					const targetRaw = pipeIdx >= 0 ? inner.slice(0, pipeIdx) : inner;
					const sizeParam = pipeIdx >= 0 ? inner.slice(pipeIdx + 1) : "";
					const target = targetRaw.trim();
					const ext = target.split(".").pop()?.toLowerCase() ?? "";

					if (options.enableMediaEmbeds && IMAGE_EXTS.has(ext)) {
						const sizeAttr = parseSizeAttr(sizeParam);
						const src = escapeHtmlAttribute(
							resolveMediaSrc(target, docsRoot, currentFilePath),
						);
						result += `<img src="${src}" alt="${escapeHtmlAttribute(target)}"${sizeAttr} loading="lazy" />`;
					} else if (options.enableMediaEmbeds && AUDIO_EXTS.has(ext)) {
						const src = escapeHtmlAttribute(
							resolveMediaSrc(target, docsRoot, currentFilePath),
						);
						result += `<audio controls src="${src}"></audio>`;
					} else if (options.enableMediaEmbeds && VIDEO_EXTS.has(ext)) {
						const sizeAttr = parseSizeAttr(sizeParam);
						const src = escapeHtmlAttribute(
							resolveMediaSrc(target, docsRoot, currentFilePath),
						);
						result += `<video controls src="${src}"${sizeAttr}></video>`;
					} else if (options.enableMediaEmbeds && ext === PDF_EXT) {
						const src = escapeHtmlAttribute(
							resolveMediaSrc(target, docsRoot, currentFilePath),
						);
						result += `<iframe src="${src}" width="100%" height="600px" frameborder="0"></iframe>`;
					} else if (options.enableTransclusion) {
						const resolved = resolveWikiLink(parseWikiLink(target, fullMatch), {
							currentPage,
							index,
							options: resolveOptions,
						});

						if (resolved.status === "ok" && resolved.targetPage) {
							try {
								const content = await fs.promises.readFile(
									resolved.targetPage.absolutePath,
									"utf-8",
								);
								const parsed = parseWikiLink(target, fullMatch);
								let transcludedContent: string | undefined;

								if (parsed.subpath) {
									if (parsed.subpath.kind === "heading") {
										transcludedContent = extractHeadingSection(
											content,
											parsed.subpath.value,
										);
									} else if (parsed.subpath.kind === "block") {
										transcludedContent = extractBlockSection(
											content,
											parsed.subpath.value,
										);
									}
								}

								if (transcludedContent === undefined) {
									transcludedContent = stripFrontmatter(content);
								}

								// Resolve any wikilinks inside the transcluded markdown
								transcludedContent = resolveWikilinksInText(
									transcludedContent,
									currentPage,
									index,
									resolveOptions,
								);

								result += `<div class="obsidian-transclusion" data-src="${escapeHtmlAttribute(resolved.href ?? "")}">\n${transcludedContent}\n</div>`;
							} catch {
								result += fullMatch;
							}
						} else {
							result += fullMatch;
						}
					} else {
						result += fullMatch;
					}

					lastEnd = start + fullMatch.length;
				}

				if (lastEnd < text.length) {
					result += text.slice(lastEnd);
				}

				node.value = result;
			}
		}

		unistVisit(tree, "text", (node, position, parent) => {
			if (!parent || typeof position !== "number") {
				return;
			}

			if (SKIP_PARENT_TYPES.has(parent.type)) {
				return;
			}

			const matches = findWikilinkMatches(node.value);
			if (matches.length === 0) {
				return;
			}

			const replacementNodes: PhrasingContent[] = [];
			let cursor = 0;

			for (const match of matches) {
				if (match.start > cursor) {
					replacementNodes.push(
						createTextNode(node.value.slice(cursor, match.start)),
					);
				}

				const parsed = parseWikiLink(match.inner, match.fullMatch);
				const resolved = resolveWikiLink(parsed, {
					currentPage,
					index,
					options: resolveOptions,
				});

				if (resolved.status === "ok") {
					const href = resolved.href;
					const label = resolved.label;

					if (href && label) {
						replacementNodes.push(
							parsed.isEmbed
								? createEmbedNode(href, label)
								: createLinkNode(href, label),
						);
					} else {
						replacementNodes.push(createTextNode(parsed.raw));
					}
				} else {
					reportDiagnostic(
						file,
						parsed.raw,
						resolved.message ?? "Unable to resolve wikilink.",
						resolved.status,
						options,
					);
					replacementNodes.push(createTextNode(parsed.raw));
				}

				cursor = match.end;
			}

			if (cursor < node.value.length) {
				replacementNodes.push(createTextNode(node.value.slice(cursor)));
			}

			const parentWithChildren = parent as Parent & {
				children: PhrasingContent[];
			};
			parentWithChildren.children.splice(position, 1, ...replacementNodes);
		});

		if (options.enableBacklinks) {
			const backlinksMap = await getCachedBacklinksIndex(index);
			const refs = backlinksMap.get(currentPage.routePath) ?? [];
			const html = renderBacklinksHtml(refs);
			if (html) {
				tree.children.push({ type: "html", value: html });
			}
		}
	};

function getCurrentFilePath(file: VFile): string | undefined {
	const pathFromFile =
		typeof file.path === "string" ? file.path : file.history.at(-1);
	return pathFromFile ? normalizeFsPath(pathFromFile) : undefined;
}

function createTextNode(value: string): Text {
	return {
		type: "text",
		value,
	};
}

function createLinkNode(url: string, label: string): Link {
	return {
		type: "link",
		url,
		children: [
			{
				type: "text",
				value: label,
			},
		],
	};
}

function createEmbedNode(url: string, label: string): HTML {
	return {
		type: "html",
		value: `<a class="obsidian-embed" data-obsidian-embed="true" href="${escapeHtmlAttribute(url)}">${escapeHtmlText(label)}</a>`,
	};
}

function escapeHtmlText(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

function escapeHtmlAttribute(value: string): string {
	return escapeHtmlText(value).replace(/"/g, "&quot;");
}

function reportDiagnostic(
	file: VFile,
	raw: string,
	message: string,
	status: "broken-page" | "broken-anchor" | "ambiguous-page",
	options: NormalizedPluginOptions,
): void {
	const prefix = `[rspress-plugin-obsidian-wikilink:${status}] ${raw} — ${message}`;

	if (status === "ambiguous-page") {
		if (options.onAmbiguousLink === "error") {
			file.fail(prefix);
			return;
		}

		file.message(prefix);
		return;
	}

	if (options.onBrokenLink === "error") {
		file.fail(prefix);
		return;
	}

	file.message(prefix);
}

function parseSizeAttr(sizeParam: string): string {
	if (!sizeParam) return "";
	const match = sizeParam.match(/^(\d+)(?:x(\d+))?$/);
	if (!match) return "";
	const width = match[1];
	const height = match[2];
	return height ? ` width="${width}" height="${height}"` : ` width="${width}"`;
}

/**
 * Resolve a media embed target to a root-relative URL.
 * Tries the file relative to the current markdown file, then relative to
 * docsRoot. Falls back to a root-relative path if neither is found on disk.
 */
function resolveMediaSrc(
	target: string,
	docsRoot: string,
	currentFilePath: string,
): string {
	const tryRelToFile = path.resolve(path.dirname(currentFilePath), target);
	if (fs.existsSync(tryRelToFile)) {
		const rel = path.relative(docsRoot, tryRelToFile).replace(/\\/g, "/");
		if (!rel.startsWith("..")) {
			return `/${rel}`;
		}
	}

	const tryRelToRoot = path.resolve(docsRoot, target);
	if (fs.existsSync(tryRelToRoot)) {
		return `/${path.relative(docsRoot, tryRelToRoot).replace(/\\/g, "/")}`;
	}

	return target.startsWith("/") ? target : `/${target}`;
}

/**
 * Resolve any wikilinks found inside a raw markdown string (e.g. transcluded
 * content) by replacing them with HTML anchor tags. Unresolvable links are
 * left as their original raw text.
 */
function resolveWikilinksInText(
	text: string,
	currentPage: ContentPage,
	index: ContentIndex,
	options: Pick<
		NormalizedPluginOptions,
		"enableFuzzyMatching" | "enableCaseInsensitiveLookup"
	>,
): string {
	const matches = findWikilinkMatches(text);
	if (matches.length === 0) return text;

	let result = "";
	let cursor = 0;

	for (const match of matches) {
		if (match.start > cursor) {
			result += text.slice(cursor, match.start);
		}

		const parsed = parseWikiLink(match.inner, match.fullMatch);
		const resolved = resolveWikiLink(parsed, { currentPage, index, options });

		if (resolved.status === "ok" && resolved.href && resolved.label) {
			result += `<a href="${escapeHtmlAttribute(resolved.href)}">${escapeHtmlText(resolved.label)}</a>`;
		} else {
			result += match.fullMatch;
		}

		cursor = match.end;
	}

	if (cursor < text.length) {
		result += text.slice(cursor);
	}

	return result;
}

/**
 * Build the replacement AST nodes for an Obsidian callout.
 * Foldable callouts (+ expanded, - collapsed) use <details>/<summary>.
 * Static callouts use <div> elements.
 */
function buildCalloutNodes(
	calloutType: string,
	calloutTitle: string,
	icon: string,
	foldState: string | undefined,
	contentChildren: Root["children"],
): Root["children"] {
	const escapedType = escapeHtmlAttribute(calloutType);
	const escapedTitle = escapeHtmlText(calloutTitle);

	if (foldState) {
		const openAttr = foldState === "+" ? " open" : "";
		const openTag: HTML = {
			type: "html",
			value: `<details class="callout callout-${escapedType}"${openAttr}>`,
		};
		const summaryTag: HTML = {
			type: "html",
			value: `<summary class="callout-title">${icon} ${escapedTitle}</summary>`,
		};

		if (contentChildren.length > 0) {
			return [
				openTag,
				summaryTag,
				{ type: "html", value: '<div class="callout-content">' },
				...contentChildren,
				{ type: "html", value: "</div></details>" },
			];
		}

		return [
			openTag,
			summaryTag,
			{ type: "html", value: '<div class="callout-content"></div></details>' },
		];
	}

	const openDiv: HTML = {
		type: "html",
		value: `<div class="callout callout-${escapedType}">`,
	};
	const titleDiv: HTML = {
		type: "html",
		value: `<div class="callout-title">${icon} ${escapedTitle}</div>`,
	};

	if (contentChildren.length > 0) {
		return [
			openDiv,
			titleDiv,
			{ type: "html", value: '<div class="callout-content">' },
			...contentChildren,
			{ type: "html", value: "</div></div>" },
		];
	}

	return [
		openDiv,
		titleDiv,
		{ type: "html", value: '<div class="callout-content"></div></div>' },
	];
}

function stripFrontmatter(content: string): string {
	if (!content.startsWith("---")) return content;
	const end = content.indexOf("\n---", 3);
	if (end === -1) return content;
	return content.slice(end + 4).trimStart();
}

function extractHeadingSection(
	content: string,
	heading: string,
): string | undefined {
	const stripped = stripFrontmatter(content);
	const lines = stripped.split("\n");
	const normalizedTarget = heading.trim().toLowerCase();

	let startLine = -1;
	let startLevel = 0;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i] ?? "";

		// ATX heading: ## Heading text
		const atxMatch = line.match(/^(#{1,6})\s+(.+?)(?:\s+#+)?$/);
		if (atxMatch) {
			const level = (atxMatch[1] ?? "").length;
			const title = (atxMatch[2] ?? "").trim().toLowerCase();
			if (startLine === -1) {
				if (title === normalizedTarget) {
					startLine = i;
					startLevel = level;
				}
			} else if (level <= startLevel) {
				return lines.slice(startLine, i).join("\n").trim();
			}
			continue;
		}

		// Setext heading: text on line i, underline (=== or ---) on line i+1
		const nextLine = lines[i + 1] ?? "";
		const setextUnderline = nextLine.match(/^\s*(=+|-+)\s*$/);
		if (setextUnderline && line.trim().length > 0) {
			const level = (setextUnderline[1] ?? "").startsWith("=") ? 1 : 2;
			const title = line.trim().toLowerCase();
			if (startLine === -1) {
				if (title === normalizedTarget) {
					startLine = i;
					startLevel = level;
				}
			} else if (level <= startLevel) {
				return lines.slice(startLine, i).join("\n").trim();
			}
			i += 1; // skip underline
		}
	}

	if (startLine !== -1) {
		return lines.slice(startLine).join("\n").trim();
	}

	return undefined;
}

function extractBlockSection(
	content: string,
	blockId: string,
): string | undefined {
	const stripped = stripFrontmatter(content);
	const lines = stripped.split("\n");
	const normalizedId = blockId.trim().toLowerCase();

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i] ?? "";
		const lineNorm = line.trim().toLowerCase();

		if (lineNorm === `^${normalizedId}`) {
			for (let j = i - 1; j >= 0; j--) {
				const prev = (lines[j] ?? "").trim();
				if (prev) return prev;
			}
			return undefined;
		}

		if (line.toLowerCase().includes(`^${normalizedId}`)) {
			return line.replace(/\s*\^[\w-]+\s*$/, "").trim();
		}
	}

	return undefined;
}
