---
description: Install and configure rspress-plugin-obsidian-wikilink in your Rspress project. Learn wikilink syntax, transclusion, media embeds, callouts, and tag linking.
---

# Getting Started

Welcome to **rspress-plugin-obsidian-wikilink** — a Rspress plugin that brings full Obsidian-style markdown to your documentation.

## Prerequisites

- Node.js 22.14.0 or later
- An existing Rspress project (or create one with `npx rspress init`)

## Install

```bash
bun add rspress-plugin-obsidian-wikilink
# or
npm install rspress-plugin-obsidian-wikilink
```

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
| `[[Page#^block]]` | Block reference |

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

## Optional Features

| Option | What it enables |
|--------|----------------|
| `enableTagLinking` | `#tag` → `[#tag](/tags/tag)` |
| `enableCallouts` | `> [!note]` → styled HTML divs |
| `enableBacklinks` | Appends backlinks panel to each page |
| `enableTransclusion` | `![[Page]]` inlines file content |
| `enableMediaEmbeds` | `![[img.png]]` renders as `<img>` |
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
  enableCallouts: true,
  enableBacklinks: true,
  enableTransclusion: true,
  enableMediaEmbeds: true,
});
```

## Next Steps

- Explore [[advanced|Advanced Usage]] for all configuration options
- See the [[api|API Reference]] for programmatic usage
