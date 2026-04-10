# rspress-plugin-obsidian-wikilink

Obsidian-style wikilinks for Rspress. Write your docs in Obsidian, publish with Rspress.

## Features

| Syntax | Description |
|--------|-------------|
| `[[Page]]` | Link to another page |
| `[[Page\|Alias]]` | Link with custom display text |
| `[[Page#Heading]]` | Link to a specific heading |
| `[[Page#Heading\|Alias]]` | Link to heading with alias |
| `[[#Heading]]` | Link to heading in current page |
| `[[Page#^block]]` | Block reference |
| `![[Page]]` | Transclude full page content |
| `![[Page#Heading]]` | Transclude a specific section |
| `![[Page#^block]]` | Transclude a specific block |
| `![[image.png\|300x200]]` | Embed media with optional size |
| `#tag` | Tag links (opt-in) |
| `> [!note]` | Callouts (opt-in) |
| Backlinks panel | Auto-generated per page (opt-in) |

The plugin rewrites wikilinks during the Rspress remark pipeline. All features are opt-in via configuration.

## Install

```bash
# Bun (recommended)
bun add rspress-plugin-obsidian-wikilink

# npm
npm install rspress-plugin-obsidian-wikilink

# pnpm
pnpm add rspress-plugin-obsidian-wikilink

# yarn
yarn add rspress-plugin-obsidian-wikilink
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
  onBrokenLink: "error",              // "error" | "warn" (default: "error")
  onAmbiguousLink: "error",           // "error" | "warn" (default: "error")
  enableFuzzyMatching: false,         // shortest-suffix fallback (default: false)
  enableCaseInsensitiveLookup: false, // case-insensitive path lookup (default: false)
  enableTagLinking: false,            // #tag → /tags/tag (default: false)
  enableCallouts: false,              // > [!note] → styled divs (default: false)
  enableBacklinks: false,             // append backlinks panel (default: false)
  enableTransclusion: false,          // ![[Page]] → inline content (default: false)
  enableMediaEmbeds: false,           // ![[img.png]] → <img> (default: false)
});
```

### `onBrokenLink`

- `"error"` — fail the build on missing page or heading
- `"warn"` — emit a warning and leave the original wikilink text in place

### `onAmbiguousLink`

- `"error"` — fail the build when a basename matches multiple pages
- `"warn"` — emit a warning and leave the original wikilink text in place

### `enableFuzzyMatching`

- `false` — only exact path, basename, title, and alias lookups
- `true` — enables case-insensitive and shortest-suffix fallback matching

### `enableCaseInsensitiveLookup`

- `false` — case-sensitive path/basename lookups (default)
- `true` — fall back to case-insensitive matching when exact case fails

### `enableTagLinking`

- `false` — tags are left as-is (default)
- `true` — converts `#tag` to `[#tag](/tags/tag)` (skips code blocks)

### `enableCallouts`

- `false` — callouts are left as blockquotes (default)
- `true` — transforms Obsidian callouts to styled HTML divs

Supported types: `note`, `tip`, `warning`, `danger`, `info`, `success`, `question`, `bug`, `example`, `quote`

```markdown
> [!tip] Pro Tip
> This is a callout
```

Output:
```html
<div class="callout callout-tip">
  <div class="callout-title">💡 Pro Tip</div>
  <div class="callout-content">This is a callout</div>
</div>
```

### `enableBacklinks`

- `false` — no backlinks (default)
- `true` — appends a `<div class="obsidian-backlinks">` panel listing all pages that link to the current page

### `enableTransclusion`

- `false` — `![[Page]]` is treated as a regular embed anchor (default)
- `true` — inlines the target file's content at the embed location

Supports section and block scoping:

| Syntax | Behavior |
|--------|----------|
| `![[Page]]` | Inlines full page content (frontmatter stripped) |
| `![[Page#Heading]]` | Inlines only the content under that heading |
| `![[Page#^block]]` | Inlines only the paragraph annotated with `^block` |

Output:
```html
<div class="obsidian-transclusion" data-src="/page">
  ...inlined content...
</div>
```

### `enableMediaEmbeds`

- `false` — `![[file]]` is treated as a regular embed anchor (default)
- `true` — renders media files as native HTML elements

| Extension | Output |
|-----------|--------|
| `png`, `jpg`, `jpeg`, `gif`, `svg`, `webp`, `avif` | `<img>` |
| `mp3`, `wav`, `ogg`, `m4a`, `flac` | `<audio controls>` |
| `mp4`, `webm`, `mov`, `mkv` | `<video controls>` |
| `pdf` | `<iframe>` |

Size parameter: `![[image.png|300x200]]` → `<img width="300" height="200" />`

## Resolution rules

Resolution order for `[[target]]`:

1. Exact path match
2. Unique basename match
3. Unique frontmatter `title` match
4. Unique frontmatter `aliases` match
5. Fuzzy matching (when `enableFuzzyMatching` is enabled)
6. Case-insensitive fallback (when `enableCaseInsensitiveLookup` is enabled)
7. Rejected as broken or ambiguous

Examples:

| Wikilink | Resolves via |
|----------|-------------|
| `[[guide/getting-started]]` | Exact path |
| `[[getting-started]]` | Basename (unique) |
| `[[Onboarding Guide]]` | Frontmatter `title` |
| `[[Start Here]]` | Frontmatter `aliases` |
| `[[#Install]]` | Current page heading |
| `[[guide/getting-started#^install-block]]` | Block reference |
| `![[guide/getting-started#Install]]` | Section transclusion |

Supported heading formats: ATX, ATX with closing `#`, up to 3 leading spaces, setext, explicit IDs `{#custom-anchor}`

## Development

```bash
# Install dependencies (Bun recommended)
bun install

# Type checking
bun run typecheck

# Run tests
bun test

# Build docs
bun run docs:build
```

## Package exports

Functions:

- `pluginObsidianWikiLink`
- `buildContentIndex`
- `getCachedContentIndex`
- `buildBacklinksIndex`
- `renderBacklinksHtml`
- `parseWikiLink`
- `findWikilinkMatches`
- `resolveWikiLink`

Types:

- `RspressPluginObsidianWikiLinkOptions`
- `NormalizedPluginOptions`
- `ParsedWikiLink`
- `ContentPage`
- `ContentIndex`
- `ResolvedWikiLink`
- `ResolveContext`
- And more — see `src/types.ts`

## License

MIT License — see [LICENSE](LICENSE) file for details.

## Status

v0.1.1 — full Obsidian markdown feature coverage for static Rspress docs.
