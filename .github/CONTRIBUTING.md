# Contributing

Thanks for your interest in improving `rspress-plugin-obsidian-wikilink`. This guide covers the development workflow and expectations for contributions.

## Prerequisites

- [Bun](https://bun.sh) `>= 1.1`
- Node.js `>= 22.14` (for tooling compatibility)
- Git

## Setup

```bash
git clone https://github.com/Jacob-Valor/rspress-plugin-obsidian-wikilink.git
cd rspress-plugin-obsidian-wikilink
bun install
```

## Development loop

```bash
bun run typecheck     # TypeScript strict mode
bun run lint          # Biome lint (source + tests)
bun run format:check  # Formatting check (no writes)
bun run lint:fix      # Auto-fix lint + formatting
bun test              # 118+ tests across parser, resolver, pipeline
bun run test:coverage # Coverage report
bun run build         # Produces dist/ (cross-platform)
bun run docs:dev      # Local docs site for visual verification
```

All checks must pass locally before opening a PR. The CI workflow runs the same checks on Ubuntu, macOS, and Windows.

## Commit messages

This project uses [Conventional Commits](https://www.conventionalcommits.org/) so `semantic-release` can derive the next version automatically.

| Prefix     | Release | Example                                             |
| ---------- | ------- | --------------------------------------------------- |
| `feat:`    | minor   | `feat: support nested tag pages`                    |
| `fix:`     | patch   | `fix: escape HTML in callout titles`                |
| `perf:`    | patch   | `perf: cache github-slugger instances`              |
| `docs:`    | none    | `docs: document enableTagPages option`              |
| `refactor:`| none    | `refactor: split remark transform into modules`     |
| `test:`    | none    | `test: cover case-insensitive fallback`             |
| `chore:`   | none    | `chore: bump biome to 2.5.0`                        |

Breaking changes use `feat!:` or include a `BREAKING CHANGE:` footer — they trigger a major version bump.

## Pull requests

1. Open an issue first for non-trivial changes so the approach can be discussed.
2. Branch off `main` with a descriptive name (`feat/tag-pages`, `fix/broken-links`, …).
3. Include tests for new behavior and regression tests for bugs.
4. Update the README when user-facing options change.
5. Ensure CI passes on all three OSes.

## Adding a feature

New features must:

- Be **opt-in** via a `NormalizedPluginOptions` flag (default `false`).
- Round-trip unknown input verbatim when the feature would otherwise produce broken output.
- Emit a `VFile` diagnostic (`file.fail` or `file.message`) on resolution failure — never silently eat errors.
- Ship with a fixture under `tests/fixtures/` and a matching `describe()` block in `tests/plugin.test.ts`.

## Reporting bugs

Use the bug report template and include:

- Plugin version and Rspress version
- Minimal `rspress.config.ts`
- A small markdown sample that triggers the issue
- Expected vs actual output

## License

Contributions are licensed under the MIT License (see [LICENSE](./LICENSE)).
