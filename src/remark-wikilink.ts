import type { HTML, Link, PhrasingContent, Root, Text } from "mdast";
import { type RemarkPluginFactory, unistVisit } from "rspress-plugin-devkit";
import fs from "node:fs";
import type { Parent } from "unist";
import type { VFile } from "vfile";
import { getCachedContentIndex } from "./content-index.ts";
import { buildBacklinksIndex, renderBacklinksHtml } from "./backlinks.ts";
import { findWikilinkMatches, parseWikiLink } from "./parse-wikilink.ts";
import { resolveWikiLink } from "./resolve-wikilink.ts";
import type {
	NormalizedPluginOptions,
	RemarkWikiLinkPluginOptions,
} from "./types.ts";
import { normalizeFsPath } from "./utils.ts";

const TAG_PATTERN = /#([a-zA-Z0-9_-]+)/g;
const CALLOUT_PATTERN = /^> \[!(\w+)\](?:[-+]?\s*(.*))?$/;

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

				let result = "";
				let lastEnd = 0;

				for (const tag of tags) {
					const start = tag.index ?? 0;
					const fullMatch = tag[0];
					const tagName = tag[1];

					if (start > lastEnd) {
						result += text.slice(lastEnd, start);
					}

					result += `[${fullMatch}](/tags/${tagName})`;
					lastEnd = start + fullMatch.length;
				}

				if (lastEnd < text.length) {
					result += text.slice(lastEnd);
				}

				node.value = result;
			});
		}

		if (options.enableCallouts) {
			unistVisit(tree, "text", (node) => {
				const text = node.value;
				if (!text.includes("[!")) {
					return;
				}

				const matches = [...text.matchAll(CALLOUT_PATTERN)];
				if (matches.length === 0) {
					return;
				}

				let result = "";
				let lastEnd = 0;

				for (const match of matches) {
					const start = match.index ?? 0;
					const calloutType = match[1]?.toLowerCase() ?? "note";
					const calloutTitle = match[2] || calloutType;
					const icon = CALLOUT_ICONS[calloutType] ?? "📝";

					if (start > lastEnd) {
						result += text.slice(lastEnd, start);
					}

					result += `<div class="callout callout-${calloutType}">\n<div class="callout-title">${icon} ${calloutTitle}</div>\n<div class="callout-content">\n`;
					lastEnd = start + match[0].length;
				}

				if (lastEnd < text.length) {
					result += text.slice(lastEnd);
				}

				node.value = result;
			});

			unistVisit(tree, "text", (node) => {
				if (!node.value.includes("> ")) {
					return;
				}

				node.value = node.value.replace(/\n> /g, "\n");
			});
		}

		if (options.enableMediaEmbeds || options.enableTransclusion) {
			unistVisit(tree, "text", (node, position, parent) => {
				if (!parent || typeof position !== "number") {
					return;
				}

				if (SKIP_PARENT_TYPES.has(parent.type)) {
					return;
				}

				const text = node.value;
				if (!text.includes("![[")) {
					return;
				}

				const embedMatches = [...text.matchAll(WIKILINK_EMBED_PATTERN)];
				if (embedMatches.length === 0) {
					return;
				}

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
						result += `<img src="${target}" alt="${target}"${sizeAttr} loading="lazy" />`;
					} else if (options.enableMediaEmbeds && AUDIO_EXTS.has(ext)) {
						result += `<audio controls src="${target}"></audio>`;
					} else if (options.enableMediaEmbeds && VIDEO_EXTS.has(ext)) {
						const sizeAttr = parseSizeAttr(sizeParam);
						result += `<video controls src="${target}"${sizeAttr}></video>`;
					} else if (options.enableMediaEmbeds && ext === PDF_EXT) {
						result += `<iframe src="${target}" width="100%" height="600px" frameborder="0"></iframe>`;
					} else if (options.enableTransclusion) {
						const resolved = resolveWikiLink(parseWikiLink(target, fullMatch), {
							currentPage,
							index,
						});

						if (resolved.status === "ok" && resolved.targetPage) {
							try {
								const content = fs.readFileSync(
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

								result += `<div class="obsidian-transclusion" data-src="${resolved.href}">\n${transcludedContent}\n</div>`;
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
			});
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
			const backlinksMap = await buildBacklinksIndex(index);
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
		const atxMatch = line.match(/^(#{1,6})\s+(.+?)(?:\s+#+)?$/);
		if (atxMatch) {
			const level = (atxMatch[1] ?? "").length;
			const title = (atxMatch[2] ?? "").trim().toLowerCase();
			if (startLine === -1) {
				if (title === normalizedTarget) {
					startLine = i;
					startLevel = level;
				}
			} else {
				if (level <= startLevel) {
					return lines.slice(startLine, i).join("\n").trim();
				}
			}
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
