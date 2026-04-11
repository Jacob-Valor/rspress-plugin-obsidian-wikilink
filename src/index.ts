import path from "node:path";
import { fileURLToPath } from "node:url";
import type { RspressPlugin } from "@rspress/core";
import type { RemarkPluginFactory } from "rspress-plugin-devkit";
import { buildContentIndex } from "./content-index.ts";
import { remarkWikilink } from "./remark-wikilink.ts";
import { generateTagPages } from "./tag-pages.ts";
import type {
	NormalizedPluginOptions,
	RemarkWikiLinkPluginOptions,
	RspressPluginObsidianWikiLinkOptions,
} from "./types.ts";

export type { BacklinkRef } from "./backlinks.ts";
export {
	buildBacklinksIndex,
	getCachedBacklinksIndex,
	renderBacklinksHtml,
} from "./backlinks.ts";
export { buildContentIndex, getCachedContentIndex } from "./content-index.ts";
export { findWikilinkMatches, parseWikiLink } from "./parse-wikilink.ts";
export { resolveWikiLink } from "./resolve-wikilink.ts";
export { generateTagPages } from "./tag-pages.ts";
export type {
	BlockEntry,
	ContentIndex,
	ContentPage,
	DiagnosticMode,
	HeadingEntry,
	NormalizedPluginOptions,
	ParsedWikiLink,
	ResolveContext,
	ResolvedWikiLink,
	ResolveStatus,
	RspressPluginObsidianWikiLinkOptions,
	WikilinkMatch,
	WikiSubpath,
} from "./types.ts";

function normalizePluginOptions(
	options: RspressPluginObsidianWikiLinkOptions = {},
): NormalizedPluginOptions {
	return {
		onBrokenLink: options.onBrokenLink ?? "error",
		onAmbiguousLink: options.onAmbiguousLink ?? "error",
		enableFuzzyMatching: options.enableFuzzyMatching ?? false,
		enableCaseInsensitiveLookup: options.enableCaseInsensitiveLookup ?? false,
		enableTagLinking: options.enableTagLinking ?? false,
		enableCallouts: options.enableCallouts ?? false,
		enableBacklinks: options.enableBacklinks ?? false,
		enableTransclusion: options.enableTransclusion ?? false,
		enableMediaEmbeds: options.enableMediaEmbeds ?? false,
		enableTagPages: options.enableTagPages ?? false,
		enableDefaultStyles: options.enableDefaultStyles ?? false,
	};
}

// Resolved at module load time — works from both src/ (dev) and dist/ (published).
const STYLES_PATH = fileURLToPath(new URL("./styles.css", import.meta.url));

export function pluginObsidianWikiLink(
	options: RspressPluginObsidianWikiLinkOptions = {},
): RspressPlugin {
	const normalizedOptions = normalizePluginOptions(options);
	let docsRoot = path.resolve(process.cwd(), "docs");

	const remarkPluginTuple: [
		RemarkPluginFactory<RemarkWikiLinkPluginOptions>,
		RemarkWikiLinkPluginOptions,
	] = [
		remarkWikilink,
		{
			getDocsRoot: () => docsRoot,
			options: normalizedOptions,
		},
	];

	return {
		name: "rspress-plugin-obsidian-wikilink",

		...(normalizedOptions.enableDefaultStyles && {
			globalStyles: STYLES_PATH,
		}),

		config(config) {
			docsRoot = path.resolve(process.cwd(), config.root ?? "docs");
			return config;
		},

		...(normalizedOptions.enableTagPages && {
			async addPages(config) {
				const root = path.resolve(
					process.cwd(),
					(config as { root?: string }).root ?? "docs",
				);
				docsRoot = root;
				const index = await buildContentIndex(root);
				return generateTagPages(index);
			},
		}),

		markdown: {
			remarkPlugins: [remarkPluginTuple],
		},
	};
}
