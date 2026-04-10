---
description: Install and configure rspress-plugin-obsidian-wikilink in your Rspress project. Learn basic wikilink syntax and quick setup steps.
---

# Getting Started

Welcome to **rspress-plugin-obsidian-wikilink** — a Rspress plugin that brings Obsidian-style wikilinks to your documentation.

## Prerequisites

Before installing, ensure you have:

- Node.js 22.14.0 or later
- An existing Rspress project (or create one with `npx rspress init`)

## Install

Install the plugin and its peer dependencies:

```bash
bun add rspress-plugin-obsidian-wikilink
# or with npm
npm install rspress-plugin-obsidian-wikilink
```

Peer dependencies (must be installed in your project):

```bash
bun add @rspress/core typescript
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

## Basic Usage

Once configured, you can use wikilinks in your markdown files:

| Syntax | Description |
|--------|-------------|
| `[[Page]]` | Link to another page |
| `[[Page\|Alias]]` | Link with custom display text |
| `[[Page#Heading]]` | Link to a specific heading |
| `[[Page#Heading|Alias]]` | Link to heading with alias |
| `[[#Heading]]` | Link to heading in current page |
| `[[Page#^block]]` | Block reference (Obsidian-style) |
| `![[Page]]` | Embed another page |
| `#tag` | Tag link (requires enableTagLinking) |

## Next Steps

- Explore [[advanced|Advanced Usage]] for configuration options
- Learn about the [[api|API Reference]] for programmatic usage
