# rspress-plugin-obsidian-wikilink

Obsidian-style wikilinks for Rspress.

## Features

- `[[Page]]`
- `[[Page|Alias]]`
- `[[Page#Heading]]`
- `[[Page#Heading|Alias]]`
- `[[#Heading]]` for current-page anchors
- `[[Page#^block]]` for Obsidian-style block references
- `![[Page]]`, `![[Page#Heading]]`, and `![[Page#^block]]` embed syntax
- frontmatter `title` and `aliases` lookup

The plugin rewrites supported wikilinks into markdown links during the Rspress remark pipeline and rewrites supported embed syntax into HTML anchors with an `obsidian-embed` marker class.

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
  enableFuzzyMatching: false, // default: false
  enableCaseInsensitiveLookup: false, // default: false
  wikilinkPattern: "/!?\\[\\[([^\\[\\]]+?)\\]\\]/g", // custom regex pattern
  enableTagLinking: false, // default: false
  enableCallouts: false, // default: false
});
```

### `onBrokenLink`

- `"error"` — fail the file on missing page or missing heading
- `"warn"` — emit a warning and leave the original wikilink text in place

### `onAmbiguousLink`

- `"error"` — fail the file when a basename matches multiple pages
- `"warn"` — emit a warning and leave the original wikilink text in place

### `enableFuzzyMatching`

- `false` — only exact path, basename, title, and alias lookups are allowed
- `true` — enables case-insensitive and shortest-suffix fallback path matching after strict lookups fail

### `enableTagLinking`

- `false` — tags are not converted to links (default)
- `true` — converts `#tag` to `[#tag](/tags/tag)`

### `enableCallouts`

- `false` — callouts are not transformed (default)
- `true` — transforms Obsidian callouts to styled HTML divs

Supported callout types: `note`, `tip`, `warning`, `danger`, `info`, `success`, `question`, `bug`, `example`, `quote`

Example:
```markdown
> [!tip] Pro Tip
> This is a callout
```

Becomes:
```html
<div class="callout callout-tip">
<div class="callout-title">💡 Pro Tip</div>
<div class="callout-content">
This is a callout
</div>
</div>
```

### `enableCaseInsensitiveLookup`

- `false` — case-sensitive path/basename lookups (default)
- `true` — fall back to case-insensitive matching when exact case fails

### `wikilinkPattern`

Custom regex pattern for matching wikilinks. Default: `/!?\\[\\[([^\\[\\]]+?)\\]\\]/g`

Example for double-bracket only:
```ts
wikilinkPattern: "/\\[\\[([^\\[\\]]+?)\\]\\]/g"
```

## Resolution rules

Current resolution order:

1. Try an exact path match first
2. Fall back to an exact basename match only when it is unique
3. Fall back to a unique frontmatter `title` or `aliases` match
4. Optionally try fuzzy path matching when `enableFuzzyMatching` is enabled
5. Reject ambiguous or missing targets by default

Examples:

- `[[guide/getting-started]]` → exact path match
- `[[getting-started]]` → basename match only if exactly one page has that basename
- `[[Onboarding Guide]]` → frontmatter `title` match when unique
- `[[Start Here]]` → frontmatter `aliases` match when unique
- `[[#Install]]` → current page heading lookup
- `[[guide/getting-started#^install-block]]` → block reference lookup
- `![[guide/getting-started#Install]]` → embed syntax rewritten to an HTML anchor

Supported heading resolution includes:

- standard ATX headings
- ATX headings with closing `#`
- headings with up to 3 leading spaces
- setext headings
- explicit IDs like `{#custom-anchor}`

## Out of scope for v0.1.0

- transclusion
- media-specific embed rendering (`![[image.png|100x145]]`, PDFs, audio)
- multi-hop fuzzy heuristics beyond the built-in optional shortest-suffix path fallback

## Development

```bash
bun install
bun run typecheck
bun test
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

And types:

- `RspressPluginObsidianWikiLinkOptions`
- `ParsedWikiLink`
- `ContentPage`
- `ContentIndex`
- `ResolvedWikiLink`
- `ResolveContext`
- And more — see `src/types.ts`

## Status

Current scope is v0.1.0 focused on reliable wikilink rewriting for Rspress docs.
