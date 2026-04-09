# Changelog

All notable changes to this project will be documented in this file.

## 0.0.1 - 2026-04-09

Initial release.

### Added

- Obsidian-style wikilink support for Rspress via a remark-based plugin
- Support for `[[Page]]`, `[[Page|Alias]]`, `[[Page#Heading]]`, `[[Page#Heading|Alias]]`, and `[[#Heading]]`
- Strict page resolution with exact path matching and exact unique basename fallback
- Heading resolution for ATX headings, setext headings, and explicit `{#id}` anchors
- Broken-link and ambiguous-link diagnostics with configurable `error` or `warn` behavior
- Cached content indexing to avoid rebuilding the full docs index on every page transform
- Test coverage for parsing, indexing, resolution, malformed links, strict matching, and heading variants
- Example Rspress docs demonstrating wikilink behavior
- Package metadata, MIT license, and release documentation
