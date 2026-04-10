---
description: Complete API reference for rspress-plugin-obsidian-wikilink. Covers pluginObsidianWikiLink, buildContentIndex, parseWikiLink, resolveWikiLink, and all TypeScript types.
---

# API Reference

This document covers the public API exports from `rspress-plugin-obsidian-wikilink`.

## Plugin Function

### `pluginObsidianWikiLink(options?)`

Creates an Rspress plugin that rewrites wikilinks during the remark pipeline.

```ts
import { pluginObsidianWikiLink } from "rspress-plugin-obsidian-wikilink";
import { defineConfig } from "@rspress/core";

export default defineConfig({
  plugins: [
    pluginObsidianWikiLink({
      onBrokenLink: "error",
      onAmbiguousLink: "error",
      enableFuzzyMatching: false,
    }),
  ],
});
```

#### Options

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `onBrokenLink` | `"error" \| "warn"` | `"error"` | How to handle missing link targets |
| `onAmbiguousLink` | `"error" \| "warn"` | `"error"` | How to handle ambiguous links |
| `enableFuzzyMatching` | `boolean` | `false` | Enable fuzzy path matching |

## Utility Functions

### `buildContentIndex(docsRoot: string): Promise<ContentIndex>`

Builds a content index for the entire docs directory. Used internally but available for programmatic use.

```ts
import { buildContentIndex } from "rspress-plugin-obsidian-wikilink";

const index = await buildContentIndex("/path/to/docs");
```

### `getCachedContentIndex(): ContentIndex | null`

Returns the cached content index if available.

```ts
import { getCachedContentIndex } from "rspress-plugin-obsidian-wikilink";

const index = getCachedContentIndex();
if (index) {
  console.log(index.pages.length);
}
```

### `parseWikiLink(input: string): ParsedWikiLink | null`

Parses a wikilink string into its components.

```ts
import { parseWikiLink } from "rspress-plugin-obsidian-wikilink";

const parsed = parseWikiLink("[[Page#Heading|Alias]]");
console.log(parsed);
// {
//   raw: "[[Page#Heading|Alias]]",
//   target: "Page#Heading",
//   alias: "Alias",
//   isEmbed: false,
//   subpath: { kind: "heading", value: "Heading" },
//   isCurrentPageReference: false
// }
```

### `findWikilinkMatches(content: string): WikilinkMatch[]`

Finds all wikilinks in a markdown string.

```ts
import { findWikilinkMatches } from "rspress-plugin-obsidian-wikilink";

const content = "Check [[Page1]] and [[Page2|Second Page]].";
const matches = findWikilinkMatches(content);
console.log(matches.length); // 2
```

### `resolveWikiLink(parsed: ParsedWikiLink, context: ResolveContext): ResolvedWikiLink`

Resolves a parsed wikilink to its final href.

```ts
import { parseWikiLink, resolveWikiLink, getCachedContentIndex } from "rspress-plugin-obsidian-wikilink";

const parsed = parseWikiLink("[[getting-started]]");
const index = getCachedContentIndex();
// Resolve against current page context...
```

## Types

### `RspressPluginObsidianWikiLinkOptions`

```ts
interface RspressPluginObsidianWikiLinkOptions {
  onBrokenLink?: "error" | "warn";
  onAmbiguousLink?: "error" | "warn";
  enableFuzzyMatching?: boolean;
}
```

### `ParsedWikiLink`

```ts
interface ParsedWikiLink {
  raw: string;           // Original wikilink text
  target: string;        // Target page (without subpath)
  alias?: string;        // Custom display text
  isEmbed: boolean;      // Whether it's an embed (![[...]])
  subpath?: {            // Optional heading/block reference
    kind: "heading" | "block";
    value: string;
  };
  isCurrentPageReference: boolean; // True for [[#Heading]]
}
```

### `ContentPage`

```ts
interface ContentPage {
  absolutePath: string;  // Full file path
  relativePath: string; // Relative to docs root
  routePath: string;     // Rspress route path
  pathKey: string;       // Normalized path key
  baseName: string;      // Filename without extension
  title?: string;        // Frontmatter title
  aliases: string[];     // Frontmatter aliases
  headings: HeadingEntry[];
  blocks: BlockEntry[];
}
```

### `ResolvedWikiLink`

```ts
interface ResolvedWikiLink {
  status: "ok" | "broken-page" | "broken-anchor" | "ambiguous-page";
  href?: string;         // Final markdown href
  label?: string;       // Display label
  targetPage?: ContentPage;
  message?: string;     // Error/warning message
}
```
