# Security Policy

## Supported versions

Only the latest minor release receives security fixes. Upgrade to the most recent version before reporting an issue.

| Version    | Supported          |
| ---------- | ------------------ |
| latest `0.x` | :white_check_mark: |
| older      | :x:                |

## Reporting a vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Please report suspected vulnerabilities privately via one of:

- GitHub's [private vulnerability reporting](https://github.com/Jacob-Valor/rspress-plugin-obsidian-wikilink/security/advisories/new) (preferred).
- Direct email to the maintainer listed in the [package.json `author` field](./package.json).

Include:

- A description of the vulnerability and its impact
- Steps to reproduce (a minimal docs site or unit test preferred)
- The affected plugin version(s) and Rspress version
- Any proof-of-concept code

## Response expectations

- Acknowledgement within **72 hours**
- Initial assessment within **7 days**
- Fix timeline depends on severity; critical issues are prioritized

Coordinated disclosure: please allow a reasonable window to publish a fix before public disclosure.

## Scope

This plugin runs **at build time** on the same machine as the Rspress build. Risks to watch for:

- Arbitrary filesystem reads when resolving wikilink targets or transclusions
- Regex denial-of-service on attacker-controlled markdown
- HTML injection via unescaped frontmatter or callout content

Out of scope: misconfiguration of downstream sites, dependencies with their own advisories (please report those upstream).
