import path from "node:path";
import type { RspressPlugin } from "@rspress/core";
import type { RemarkPluginFactory } from "rspress-plugin-devkit";
import { remarkWikilink } from "./remark-wikilink.ts";
import type {
	NormalizedPluginOptions,
	RemarkWikiLinkPluginOptions,
	RspressPluginObsidianWikiLinkOptions,
} from "./types.ts";

export { buildContentIndex, getCachedContentIndex } from "./content-index.ts";
export { findWikilinkMatches, parseWikiLink } from "./parse-wikilink.ts";
export { resolveWikiLink } from "./resolve-wikilink.ts";
export type { RspressPluginObsidianWikiLinkOptions } from "./types.ts";

function normalizePluginOptions(
	options: RspressPluginObsidianWikiLinkOptions = {},
): NormalizedPluginOptions {
	return {
		onBrokenLink: options.onBrokenLink ?? "error",
		onAmbiguousLink: options.onAmbiguousLink ?? "error",
		enableFuzzyMatching: options.enableFuzzyMatching ?? false,
	};
}

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
		config(config) {
			docsRoot = path.resolve(process.cwd(), config.root ?? "docs");
			return config;
		},
		markdown: {
			remarkPlugins: [remarkPluginTuple],
		},
	};
}
