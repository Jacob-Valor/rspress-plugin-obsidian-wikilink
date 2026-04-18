## Summary

<!-- What does this PR change and why? One to three sentences. -->

## Related issue

Closes #

## Type of change

<!-- Check one. Picks the semantic-release version bump. -->

- [ ] `fix:` — bug fix (patch release)
- [ ] `feat:` — new feature (minor release)
- [ ] `feat!:` / `BREAKING CHANGE:` — breaking change (major release)
- [ ] `perf:` — performance improvement (patch release)
- [ ] `docs:` / `refactor:` / `test:` / `chore:` — no release

## Checklist

- [ ] Commits follow [Conventional Commits](https://www.conventionalcommits.org/)
- [ ] `bun run typecheck` passes
- [ ] `bun run lint` passes
- [ ] `bun run format:check` passes
- [ ] `bun test` passes (added tests for new behavior and regressions)
- [ ] `bun run build` succeeds
- [ ] `bun run docs:build` succeeds (if docs changed)
- [ ] README updated (if user-facing options changed)
- [ ] New feature is **opt-in** via a `NormalizedPluginOptions` flag defaulting to `false`

## Notes for reviewers

<!-- Anything you want reviewers to pay special attention to? Tradeoffs, follow-ups, etc. -->
