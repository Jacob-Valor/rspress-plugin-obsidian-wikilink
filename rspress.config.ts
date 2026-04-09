import * as path from "path";
import { defineConfig } from "@rspress/core";
import { pluginObsidianWikiLink } from "./src";

export default defineConfig({
  root: path.join(__dirname, "docs"),
  title: "Rspress x SuperSub Example",
  plugins: [pluginObsidianWikiLink()],
});
