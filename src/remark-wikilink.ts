import type { HTML, Link, PhrasingContent, Root, Text } from "mdast";
import { type RemarkPluginFactory, unistVisit } from "rspress-plugin-devkit";
import type { Parent } from "unist";
import type { VFile } from "vfile";
import { getCachedContentIndex } from "./content-index.ts";
import { findWikilinkMatches, parseWikiLink } from "./parse-wikilink.ts";
import { resolveWikiLink } from "./resolve-wikilink.ts";
import type {
	NormalizedPluginOptions,
	RemarkWikiLinkPluginOptions,
} from "./types.ts";
import { normalizeFsPath } from "./utils.ts";

const TAG_PATTERN = /#([a-zA-Z0-9_-]+)/g;
const CALLOUT_PATTERN = /^> \[!(\w+)\](?:[-+]?\s*(.*))?$/;

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
