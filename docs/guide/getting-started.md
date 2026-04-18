---
description: Install and configure rspress-plugin-obsidian-wikilink. Covers wikilink syntax, transclusion, media embeds, callouts, tags, comments, highlights, footnotes, and frontmatter support.
---

# Getting Started

Welcome to **rspress-plugin-obsidian-wikilink** — a Rspress plugin that brings full Obsidian-style markdown to your documentation.

## Prerequisites

- Node.js 22.14.0 or later
- An existing Rspress project (or create one with `npx rspress init`)

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

## Quick Setup

Add the plugin to your `rspress.config.ts`:

```ts
import path from "node:path";
import { defineConfig } from "@rspress/core";
import { pluginObsidianWikiLink } from "rspress-plugin-obsidian-wikilink";

export default defineConfig({
  root: path.join(__dirname, "docs"),
  plugins: [pluginObsidianWikiLink()],
});
```

## Basic Wikilink Syntax

| Syntax | Description |
|--------|-------------|
| `[[Page]]` | Link to another page |
| `[[Page\|Alias]]` | Link with custom display text |
| `[[Page#Heading]]` | Link to a specific heading |
| `[[Page#Heading\|Alias]]` | Link to heading with alias |
| `[[#Heading]]` | Link to heading in current page |
| `[[Page#^block]]` | Block reference (standalone or inline) |

## Embed & Transclusion Syntax

Enable with `enableTransclusion: true` and `enableMediaEmbeds: true`:

| Syntax | Description |
|--------|-------------|
| `![[Page]]` | Transclude full page content |
| `![[Page#Heading]]` | Transclude a specific section only |
| `![[Page#^block]]` | Transclude a specific block only |
| `![[image.png]]` | Embed an image |
| `![[image.png\|300x200]]` | Embed image with width×height |
| `![[video.mp4]]` | Embed a video |
| `![[audio.mp3]]` | Embed audio |
| `![[doc.pdf]]` | Embed a PDF |

## Obsidian Comments

`%% ... %%` comments are **always stripped** — no configuration needed:

```markdown
This is visible. %% This is a private note. %% Back to visible.
```

Multi-line block comments also work:

```markdown
%%
Draft content — not published.
%%
```

## Text Highlighting

`==text==` is transformed to `<mark>` tags — no option needed:

```markdown
This is ==highlighted text== in a sentence.
```

## Footnotes

Footnote references `[^1]` are converted to superscript links, with definitions rendered at the end of the page — no option needed:

```markdown
This is a statement[^1] with a footnote.

[^1]: This is the footnote definition.
```

Inline footnotes are also supported:

```markdown
Inline footnote^[This is inline] works differently.
```

## Frontmatter

The plugin reads these frontmatter fields from each page:

| Field | Purpose |
|-------|---------|
| `title` | Used as a lookup key (`[[My Title]]`) and as the default label |
| `aliases` | Additional lookup keys (`[[Alias Name]]`). Also accepts singular `alias` |
| `tags` | Tag page generation and categorization. Also accepts singular `tag` |
| `cssclasses` | Custom CSS classes applied to the page container |
| `excerpt` | Page excerpt/description for SEO |

```yaml
---
title: My Custom Title
aliases:
  - First Alias
  - Second Alias
tags:
  - tutorial
  - obsidian
cssclasses:
  - custom-layout
  - dark-theme
excerpt: A brief description of this page
---
```

## Optional Features

| Option | What it enables |
|--------|----------------|
| `enableTagLinking` | `#tag` → `[#tag](/tags/tag)` (includes nested and Unicode tags) |
| `enableTagPages` | Auto-generate `/tags/{name}` index pages |
| `enableCallouts` | `> [!note]` → styled HTML (+ foldable with `+`/`-`) |
| `enableBacklinks` | Appends backlinks panel to each page |
| `enableTransclusion` | `![[Page]]` inlines file content |
| `enableMediaEmbeds` | `![[img.png]]` renders as `<img>` |
| `enableDefaultStyles` | Injects bundled CSS for all plugin classes |
| `enableFuzzyMatching` | Shortest-suffix path fallback |
| `enableCaseInsensitiveLookup` | Case-insensitive path resolution |

Full configuration example:

```ts
pluginObsidianWikiLink({
  onBrokenLink: "error",
  onAmbiguousLink: "error",
  enableFuzzyMatching: false,
  enableCaseInsensitiveLookup: false,
  enableTagLinking: true,
  enableTagPages: true,
  enableCallouts: true,
  enableBacklinks: true,
  enableTransclusion: true,
  enableMediaEmbeds: true,
  enableDefaultStyles: true,
});
```

## Next Steps

- Explore [[advanced|Advanced Usage]] for all configuration options in detail
- See the [[api|API Reference]] for programmatic usage
