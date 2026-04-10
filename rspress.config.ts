import * as path from "path";
import { defineConfig } from "@rspress/core";
import { pluginObsidianWikiLink } from "./src";

export default defineConfig({
	root: path.join(__dirname, "docs"),
	title: "Rspress Obsidian WikiLink",
	description: "Obsidian-style wikilinks for Rspress documentation",
	plugins: [
		pluginObsidianWikiLink({
			enableTagLinking: true,
			enableCallouts: true,
			enableBacklinks: true,
			enableTransclusion: true,
			enableMediaEmbeds: true,
		}),
	],
});
