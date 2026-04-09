import path from "node:path";
import type { RspressPlugin } from "@rspress/core";
import type { RemarkPluginFactory } from "rspress-plugin-devkit";
import { remarkWikilink } from "./remark-wikilink.js";
import {
  normalizePluginOptions,
  type NormalizedPluginOptions,
  type RspressPluginObsidianWikiLinkOptions,
} from "./types.js";

interface RemarkWikiLinkPluginOptions {
  getDocsRoot: () => string;
  options: NormalizedPluginOptions;
}

export type { RspressPluginObsidianWikiLinkOptions } from "./types.js";
export { buildContentIndex } from "./content-index.js";
export { getCachedContentIndex } from "./content-index.js";
export { parseWikiLink, findWikilinkMatches } from "./parse-wikilink.js";
export { resolveWikiLink } from "./resolve-wikilink.js";

export function pluginObsidianWikiLink(
  options: RspressPluginObsidianWikiLinkOptions = {},
): RspressPlugin {
  const normalizedOptions = normalizePluginOptions(options);
  let docsRoot = path.resolve(process.cwd(), "docs");

  const remarkPluginTuple: [RemarkPluginFactory<RemarkWikiLinkPluginOptions>, RemarkWikiLinkPluginOptions] = [
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
