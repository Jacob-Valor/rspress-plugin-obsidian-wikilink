---
description: Advanced configuration options for rspress-plugin-obsidian-wikilink. Learn about onBrokenLink, onAmbiguousLink, enableFuzzyMatching, heading resolution, and debugging.
---

# Advanced

This guide covers advanced configuration options and use cases.

## Configuration Options

The plugin accepts an options object to customize its behavior:

```ts
import { pluginObsidianWikiLink } from "rspress-plugin-obsidian-wikilink";

pluginObsidianWikiLink({
  onBrokenLink: "error",
  onAmbiguousLink: "error",
  enableFuzzyMatching: false,
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

Enables flexible path matching:

- `false` (default) — Only exact path, basename, title, and alias lookups
- `true` — Enables case-insensitive and shortest-suffix fallback matching

### `enableTagLinking`

Enables automatic conversion of Obsidian-style tags to links:

- `false` (default) — Tags are left as-is
- `true` — Converts `#tag` to `[#tag](/tags/tag)`

Example:

```ts
pluginObsidianWikiLink({
  enableTagLinking: true,
});
```

With this enabled, `#my-tag` in your markdown becomes `[#my-tag](/tags/my-tag)` in the output.

## Link Resolution

The plugin resolves wikilinks in this order:

1. **Exact path** — `[[guide/getting-started]]`
2. **Unique basename** — `[[getting-started]]` (if only one page matches)
3. **Frontmatter title** — `[[Onboarding Guide]]` (if unique)
4. **Frontmatter aliases** — `[[Start Here]]` (if unique)
5. **Fuzzy matching** — (when enabled) case-insensitive fallback
6. **Reject** — Ambiguous or missing targets fail by default

## Heading Resolution

Supported heading formats:

- ATX headings: `# Heading`
- ATX with closing: `# Heading ##`
- Indented: `   # Heading` (up to 3 spaces)
- Setext: `Heading\n=======`
- Custom IDs: `{#custom-anchor}`

## Block References

Obsidian-style block references using `^`:

```markdown
[[guide/getting-started#^install-step]]
```

This links to a block annotated with `^install-step` in the target page.

## Embed Syntax

Embed entire pages or sections:

- `![[Page]]` — Embed entire page
- `![[Page#Heading]]` — Embed specific section
- `![[Page#^block]]` — Embed block reference

Embeds are rewritten to HTML anchors with `obsidian-embed` class.

## Debugging

To debug link resolution, add logging to your config:

```ts
pluginObsidianWikiLink({
  onBrokenLink: "warn",
  onAmbiguousLink: "warn",
});
```

This will emit warnings for broken or ambiguous links instead of failing the build.

## Next Steps

- Check the [[api|API Reference]] for programmatic access
- See the main README for resolution rules details
