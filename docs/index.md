---
description: Obsidian-style wikilinks for Rspress. Supports wikilinks, transclusion, media embeds, callouts, backlinks, tags, and block references.
---

# rspress-plugin-obsidian-wikilink

Rspress plugin that brings full Obsidian markdown support to your documentation site. Write in Obsidian, publish with Rspress.

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

## Quick Start

Install the plugin:

```bash
bun add rspress-plugin-obsidian-wikilink
```

Add it to your `rspress.config.ts`:

```ts
import path from "node:path";
import { defineConfig } from "@rspress/core";
import { pluginObsidianWikiLink } from "rspress-plugin-obsidian-wikilink";

export default defineConfig({
  root: path.join(__dirname, "docs"),
  plugins: [
    pluginObsidianWikiLink({
      enableCallouts: true,
      enableTagLinking: true,
      enableBacklinks: true,
      enableTransclusion: true,
      enableMediaEmbeds: true,
    }),
  ],
});
```

Start writing with Obsidian syntax:

```markdown
See [[getting-started]] to begin.

![[shared/intro]]

> [!tip] Did you know?
> You can use all Obsidian wikilink syntax here.

Related: #tutorial #docs
```

## Next Steps

- [[guide/getting-started|Getting Started]] — Full installation and setup guide
- [[guide/advanced|Advanced Usage]] — All configuration options
- [[guide/api|API Reference]] — Programmatic usage and types
