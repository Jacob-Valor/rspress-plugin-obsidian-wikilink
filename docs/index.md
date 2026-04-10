---
description: Obsidian-style wikilinks for Rspress documentation. Supports [[Page]], [[Page|Alias]], [[Page#Heading]], block references, and embed syntax.
---

# rspress-plugin-obsidian-wikilink

Rspress plugin that transforms Obsidian-style wikilinks into standard markdown links during the remark pipeline. Write your docs in Obsidian flavor, publish with Rspress.

## Features

| Syntax | Description |
|--------|-------------|
| `[[Page]]` | Link to another page |
| `[[Page|Alias]]` | Link with custom display text |
| `[[Page#Heading]]` | Link to a specific heading |
| `[[Page#Heading|Alias]]` | Link to heading with alias |
| `[[#Heading]]` | Link to heading in current page |
| `[[Page#^block]]` | Block reference (Obsidian-style) |
| `![[Page]]` | Embed another page |
| `#tag` | Tag links (when enabled) |

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
  plugins: [pluginObsidianWikiLink()],
});
```

Start writing with wikilinks:

```markdown
Check out [[getting-started]] to begin.

See [[advanced#Configuration]] for options.

![[embedded-page]]
```

## Next Steps

- [[guide/getting-started|Getting Started]] — Full installation and setup guide
- [[guide/advanced|Advanced Usage]] — Configuration, resolution rules, debugging
- [[guide/api|API Reference]] — Programmatic usage and type definitions
