---
description: Complete configuration reference for rspress-plugin-obsidian-wikilink. Covers all options including transclusion, media embeds, callouts, backlinks, tag linking, and link resolution rules.
---

# Advanced

## All Configuration Options

```ts
pluginObsidianWikiLink({
  onBrokenLink: "error",              // "error" | "warn"
  onAmbiguousLink: "error",           // "error" | "warn"
  enableFuzzyMatching: false,         // shortest-suffix path fallback
  enableCaseInsensitiveLookup: false, // case-insensitive path lookup
  enableTagLinking: false,            // #tag → /tags/tag
  enableCallouts: false,              // > [!note] → styled divs
  enableBacklinks: false,             // append backlinks panel
  enableTransclusion: false,          // ![[Page]] → inline content
  enableMediaEmbeds: false,           // ![[img.png]] → <img>
  wikilinkPattern: "/!?\\[\\[([^\\[\\]]+?)\\]\\]/g",
});
```

### `onBrokenLink`

Controls how the plugin handles links to non-existent pages or headings:

- `"error"` (default) — Fail the build when a link target is missing
- `"warn"` — Emit a warning but leave the original wikilink text in place

### `onAmbiguousLink`

Controls how the plugin handles ambiguous links (multiple pages with the same basename):

- `"error"` (default) — Fail the build when multiple pages match
- `"warn"` — Emit a warning but leave the original wikilink text in place

### `enableFuzzyMatching`

- `false` (default) — Only exact path, basename, title, and alias lookups
- `true` — Enables case-insensitive and shortest-suffix fallback matching

### `enableCaseInsensitiveLookup`

- `false` (default) — Case-sensitive path/basename lookups
- `true` — Falls back to case-insensitive matching when exact case fails

### `enableTagLinking`

- `false` (default) — Tags are left as-is in the output
- `true` — Converts `#tag` to `[#tag](/tags/tag)`. Skips tags inside code blocks.

### `enableCallouts`

- `false` (default) — Obsidian callouts remain as blockquotes
- `true` — Transforms callouts to styled HTML divs

Supported types: `note`, `tip`, `warning`, `danger`, `info`, `success`, `question`, `bug`, `example`, `quote`

```markdown
> [!warning] Watch out
> This will be transformed
```

Output:
```html
<div class="callout callout-warning">
  <div class="callout-title">⚠️ Watch out</div>
  <div class="callout-content">This will be transformed</div>
</div>
```

### `enableBacklinks`

- `false` (default) — No backlinks appended
- `true` — Scans all pages for incoming links and appends a `<div class="obsidian-backlinks">` panel at the bottom of each page

### `enableTransclusion`

- `false` (default) — `![[Page]]` is rewritten to an embed anchor
- `true` — Inlines the referenced file's content at the embed location

| Syntax | Result |
|--------|--------|
| `![[Page]]` | Full file content (frontmatter stripped) |
| `![[Page#Heading]]` | Only the section under that heading |
| `![[Page#^block]]` | Only the paragraph annotated with `^block` |

Output wraps content in:
```html
<div class="obsidian-transclusion" data-src="/page">
  ...inlined content...
</div>
```

### `enableMediaEmbeds`

- `false` (default) — `![[file]]` is rewritten to an embed anchor
- `true` — Renders media files as native HTML elements

| Extension | Output element |
|-----------|---------------|
| `png`, `jpg`, `jpeg`, `gif`, `svg`, `webp`, `avif` | `<img loading="lazy">` |
| `mp3`, `wav`, `ogg`, `m4a`, `flac` | `<audio controls>` |
| `mp4`, `webm`, `mov`, `mkv` | `<video controls>` |
| `pdf` | `<iframe>` |

Size parameter: `![[image.png|300x200]]` → `width="300" height="200"`. Width-only: `![[image.png|300]]` → `width="300"`.

### `wikilinkPattern`

Custom regex for matching wikilinks. Must include a capture group for the inner content.

Default: `/!?\[\[([^\[\]]+?)\]\]/g`

Example (disable embed prefix):
```ts
wikilinkPattern: "/\\[\\[([^\\[\\]]+?)\\]\\]/g"
```

## Link Resolution

Resolution order for `[[target]]`:

1. **Exact path** — `[[guide/getting-started]]`
2. **Unique basename** — `[[getting-started]]` (one page matches)
3. **Frontmatter `title`** — `[[Onboarding Guide]]` (unique match)
4. **Frontmatter `aliases`** — `[[Start Here]]` (unique match)
5. **Fuzzy matching** — (when `enableFuzzyMatching` is on) case-insensitive, shortest-suffix
6. **Case-insensitive** — (when `enableCaseInsensitiveLookup` is on)
7. **Rejected** — broken or ambiguous

## Heading Resolution

Supported heading formats in target files:

- Standard ATX: `# Heading`
- ATX with closing: `# Heading ##`
- Up to 3 leading spaces: `   # Heading`
- Setext: `Heading\n=======`
- Explicit IDs: `## Heading {#custom-anchor}`

## Debugging

Use `"warn"` to see which links can't be resolved without failing the build:

```ts
pluginObsidianWikiLink({
  onBrokenLink: "warn",
  onAmbiguousLink: "warn",
});
```

## Next Steps

- See the [[api|API Reference]] for programmatic usage
