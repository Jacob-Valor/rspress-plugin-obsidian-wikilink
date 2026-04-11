---
description: Complete configuration reference for rspress-plugin-obsidian-wikilink. Covers all options including transclusion, media embeds, callouts, backlinks, tag linking, tag pages, default styles, and link resolution rules.
---

# Advanced

## All Configuration Options

```ts
pluginObsidianWikiLink({
  // Link diagnostics
  onBrokenLink: "error",              // "error" | "warn" (default: "error")
  onAmbiguousLink: "error",           // "error" | "warn" (default: "error")

  // Resolution
  enableFuzzyMatching: false,         // shortest-suffix path fallback
  enableCaseInsensitiveLookup: false, // case-insensitive path lookup

  // Content features
  enableTagLinking: false,            // #tag → /tags/tag
  enableTagPages: false,              // generate /tags/{name} index pages
  enableCallouts: false,              // > [!note] → styled HTML
  enableBacklinks: false,             // append backlinks panel
  enableTransclusion: false,          // ![[Page]] → inline content
  enableMediaEmbeds: false,           // ![[img.png]] → <img>

  // Styling
  enableDefaultStyles: false,         // inject bundled CSS
});
```

### `onBrokenLink`

Controls how the plugin handles links to non-existent pages or headings:

- `"error"` (default) — fail the build when a link target is missing
- `"warn"` — emit a warning but leave the original wikilink text in place

### `onAmbiguousLink`

Controls how the plugin handles ambiguous links (multiple pages share the same basename):

- `"error"` (default) — fail the build when multiple pages match
- `"warn"` — emit a warning but leave the original wikilink text in place

### `enableFuzzyMatching`

- `false` (default) — only exact path, basename, title, and alias lookups
- `true` — enables case-insensitive and shortest-suffix fallback matching

### `enableCaseInsensitiveLookup`

- `false` (default) — case-sensitive path/basename lookups
- `true` — falls back to case-insensitive matching when exact case fails

### `enableTagLinking`

- `false` (default) — tags are left as-is in the output
- `true` — converts `#tag` to `[#tag](/tags/tag)`; skips code blocks and URL fragments

Tag names must start with a letter or underscore (pure-numeric strings like `#123` are never matched).

### `enableTagPages`

- `false` (default) — no tag pages generated
- `true` — auto-generates a `/tags/{name}` index page for every unique tag found in frontmatter `tags:` fields

Each generated page lists all pages with that tag:

```yaml
---
tags:
  - tutorial
  - obsidian
---
```

Produces `/tags/tutorial` and `/tags/obsidian`, each listing all pages tagged with that value.

> **Note**: combine with `enableTagLinking: true` so that inline `#tag` links point to the generated pages.

### `enableCallouts`

- `false` (default) — Obsidian callouts remain as plain blockquotes
- `true` — transforms callouts to styled HTML `<div>` (static) or `<details>` (foldable)

**Supported base types:**

| Type | Icon |
|------|------|
| `note` | 📝 |
| `tip` | 💡 |
| `info` | ℹ️ |
| `success` | ✅ |
| `question` | ❓ |
| `warning` | ⚠️ |
| `danger` | 🚨 |
| `bug` | 🐛 |
| `example` | 📋 |
| `quote` | 📜 |
| `abstract` | 📋 |
| `caution` | ⚠️ |
| `failure` | ❌ |

**Supported aliases** (map to canonical type above):

| Aliases | Canonical |
|---------|-----------|
| `summary`, `tldr` | `abstract` |
| `check`, `done` | `success` |
| `help`, `faq` | `question` |
| `attention` | `caution` |
| `fail`, `missing` | `failure` |

**Static callout:**
```markdown
> [!warning] Watch out
> This will be transformed.
```

Output:
```html
<div class="callout callout-warning">
  <div class="callout-title">⚠️ Watch out</div>
  <div class="callout-content">This will be transformed.</div>
</div>
```

**Foldable callouts** use native `<details>`/`<summary>` — no JavaScript required:

```markdown
> [!note]- Collapsed by default
> Hidden until the user clicks.

> [!tip]+ Expanded by default
> Visible immediately, but collapsible.
```

### `enableBacklinks`

- `false` (default) — no backlinks appended
- `true` — scans all pages for incoming links and appends a `<div class="obsidian-backlinks">` panel at the bottom of each page

The backlinks index is cached per content-index snapshot, so it does not re-read all files on every page compile.

### `enableTransclusion`

- `false` (default) — `![[Page]]` is rewritten to an embed anchor
- `true` — inlines the referenced file's content at the embed location

| Syntax | Result |
|--------|--------|
| `![[Page]]` | Full file content (frontmatter stripped) |
| `![[Page#Heading]]` | Only the section under that heading |
| `![[Page#^block]]` | Only the paragraph annotated with `^block` |

Supports ATX and setext headings in the target file. Any `[[wikilinks]]` found inside transcluded content are resolved automatically.

Output wraps content in:
```html
<div class="obsidian-transclusion" data-src="/page">
  ...inlined content...
</div>
```

### `enableMediaEmbeds`

- `false` (default) — `![[file]]` is rewritten to an embed anchor
- `true` — renders media files as native HTML elements

| Extension | Output element |
|-----------|---------------|
| `png`, `jpg`, `jpeg`, `gif`, `svg`, `webp`, `avif` | `<img loading="lazy">` |
| `mp3`, `wav`, `ogg`, `m4a`, `flac` | `<audio controls>` |
| `mp4`, `webm`, `mov`, `mkv` | `<video controls>` |
| `pdf` | `<iframe>` |

Size parameter: `![[image.png|300x200]]` → `width="300" height="200"`. Width-only: `![[image.png|300]]` → `width="300"`.

Media paths are resolved in order:
1. Relative to the current file's directory
2. Relative to the docs root
3. Root-relative fallback (`/filename`)

### `enableDefaultStyles`

- `false` (default) — no styles injected
- `true` — automatically injects the bundled stylesheet via Rspress `globalStyles`

Covers all CSS classes emitted by this plugin: `.callout-*`, `.obsidian-backlinks`, `.obsidian-transclusion`, `.obsidian-embed`. Uses Rspress CSS variables (`--rp-c-brand`, `--rp-c-bg-soft`, etc.) for automatic dark/light mode compatibility.

You can also import the stylesheet manually instead:

```css
@import "rspress-plugin-obsidian-wikilink/styles.css";
```

## Obsidian Comments

`%% ... %%` comments are stripped automatically — no option required:

```markdown
Visible text. %% Private note — not published. %% More visible text.
```

Multi-line block comments:

```markdown
%%
This entire paragraph is a private draft.
%%
```

> **Limitation**: comments that span multiple paragraphs (opening `%%` in one paragraph, closing `%%` in another) are not stripped.

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
- Setext H1: `Heading\n=======`
- Setext H2: `Heading\n-------`
- Explicit IDs: `## Heading {#custom-anchor}`

## Block ID Formats

The plugin indexes both block ID formats:

```markdown
Standalone block ID on its own line:

^my-block

Inline block ID appended to a paragraph: ^inline-block
```

Both are reachable via `[[Page#^my-block]]` and `[[Page#^inline-block]]`.

## Frontmatter Fields

The plugin reads these frontmatter fields from each page:

| Field | Purpose |
|-------|---------|
| `title` | Used as a lookup key (`[[My Title]]`) and as the default label |
| `aliases` | Additional lookup keys (`[[Alias Name]]`) |
| `tags` | Indexed in `byTag`; used to generate tag pages when `enableTagPages` is on |

## Debugging

Use `"warn"` to inspect which links can't be resolved without failing the build:

```ts
pluginObsidianWikiLink({
  onBrokenLink: "warn",
  onAmbiguousLink: "warn",
});
```

## Next Steps

- See the [[api|API Reference]] for programmatic usage
