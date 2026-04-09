import type { ParsedWikiLink, WikilinkMatch } from "./types.js";

const WIKILINK_PATTERN = /\[\[([^\[\]]+?)\]\]/g;

export function findWikilinkMatches(input: string): WikilinkMatch[] {
  const matches: WikilinkMatch[] = [];

  for (const match of input.matchAll(WIKILINK_PATTERN)) {
    const fullMatch = match[0];
    const inner = match[1];
    const start = match.index ?? -1;

    if (start < 0 || typeof inner !== "string") {
      continue;
    }

    if (start > 0 && input[start - 1] === "!") {
      continue;
    }

    matches.push({
      fullMatch,
      inner,
      start,
      end: start + fullMatch.length,
    });
  }

  return matches;
}

export function parseWikiLink(inner: string, raw: string): ParsedWikiLink {
  const pipeIndex = inner.indexOf("|");
  const targetAndAnchor = pipeIndex >= 0 ? inner.slice(0, pipeIndex) : inner;
  const alias = pipeIndex >= 0 ? inner.slice(pipeIndex + 1).trim() || undefined : undefined;

  const hashIndex = targetAndAnchor.indexOf("#");
  const rawTarget = hashIndex >= 0 ? targetAndAnchor.slice(0, hashIndex) : targetAndAnchor;
  const rawAnchor = hashIndex >= 0 ? targetAndAnchor.slice(hashIndex + 1) : undefined;

  const target = rawTarget.trim();
  const anchor = rawAnchor?.trim() || undefined;

  return {
    raw,
    target,
    anchor,
    alias,
    isCurrentPageAnchor: target.length === 0 && typeof anchor === "string",
  };
}
