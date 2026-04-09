# rspress-plugin-obsidian-wikilink

Obsidian-style wikilinks for Rspress.

## Features

- `[[Page]]`
- `[[Page|Alias]]`
- `[[Page#Heading]]`
- `[[Page#Heading|Alias]]`
- `[[#Heading]]` for current-page anchors

The plugin rewrites supported wikilinks into normal markdown links during the Rspress remark pipeline.

## Install

```bash
bun add rspress-plugin-obsidian-wikilink
```

Peer requirements:

- `@rspress/core`
- `typescript`

## Usage

```ts
import path from "node:path";
import { defineConfig } from "@rspress/core";
import { pluginObsidianWikiLink } from "rspress-plugin-obsidian-wikilink";

export default defineConfig({
  root: path.join(__dirname, "docs"),
  plugins: [pluginObsidianWikiLink()],
});
```

## Options

```ts
pluginObsidianWikiLink({
  onBrokenLink: "error", // default: "error"
  onAmbiguousLink: "error", // default: "error"
});
```

### `onBrokenLink`

- `"error"` — fail the file on missing page or missing heading
- `"warn"` — emit a warning and leave the original wikilink text in place

### `onAmbiguousLink`

- `"error"` — fail the file when a basename matches multiple pages
- `"warn"` — emit a warning and leave the original wikilink text in place

## Resolution rules

v0.0.1 is intentionally strict:

1. Try an exact path match first
2. Fall back to an exact basename match only when it is unique
3. Reject ambiguous or missing targets by default

Examples:

- `[[guide/getting-started]]` → exact path match
- `[[getting-started]]` → basename match only if exactly one page has that basename
- `[[#Install]]` → current page heading lookup

Supported heading resolution includes:

- standard ATX headings
- ATX headings with closing `#`
- headings with up to 3 leading spaces
- setext headings
- explicit IDs like `{#custom-anchor}`

## Out of scope for v0.0.1

- `![[embed]]`
- transclusion
- block refs like `[[Page#^block]]`
- title/frontmatter-based lookup
- fuzzy path matching

## Development

```bash
bun install
bun run typecheck
bun test
bun run build
bun run docs:build
```

## Package exports

The package exports:

- `pluginObsidianWikiLink`
- `buildContentIndex`
- `getCachedContentIndex`
- `parseWikiLink`
- `findWikilinkMatches`
- `resolveWikiLink`

## Status

Current scope is a small, strict v0.0.1 focused on reliable wikilink rewriting for Rspress docs.
