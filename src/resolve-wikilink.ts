import path from "node:path";
import { normalizePathKey } from "./content-index.js";
import { humanizeBaseName, normalizeLookupValue, slugifyHeading } from "./slug.js";
import type { ContentPage, ParsedWikiLink, ResolveContext, ResolvedWikiLink } from "./types.js";

export function resolveWikiLink(
  parsed: ParsedWikiLink,
  context: ResolveContext,
): ResolvedWikiLink {
  if (parsed.isCurrentPageAnchor) {
    return resolveCurrentPageAnchor(context.currentPage, parsed);
  }

  if (parsed.target.trim().length === 0) {
    return {
      status: "broken-page",
      message: `Wikilink target is empty in ${parsed.raw}.`,
    };
  }

  const exactPathKey = normalizePathKey(parsed.target);
  const exactPage = context.index.byPathKey.get(exactPathKey);

  if (exactPage) {
    return resolveAgainstPage(exactPage, parsed);
  }

  const exactBaseName = path.basename(exactPathKey);
  const candidates = context.index.byBaseName.get(exactBaseName) ?? [];

  if (candidates.length === 0) {
    return {
      status: "broken-page",
      message: `Unable to resolve wikilink target \"${parsed.target}\".`,
    };
  }

  if (candidates.length > 1) {
    return {
      status: "ambiguous-page",
      message: `Wikilink target \"${parsed.target}\" is ambiguous; use a path-qualified link instead.`,
    };
  }

  const candidate = candidates[0];
  if (!candidate) {
    return {
      status: "broken-page",
      message: `Unable to resolve wikilink target \"${parsed.target}\".`,
    };
  }

  return resolveAgainstPage(candidate, parsed);
}

function resolveCurrentPageAnchor(page: ContentPage, parsed: ParsedWikiLink): ResolvedWikiLink {
  const anchor = parsed.anchor;
  if (!anchor) {
    return {
      status: "broken-anchor",
      message: "Missing current-page anchor target.",
    };
  }

  const headingSlug = resolveHeadingSlug(page, anchor);
  if (!headingSlug) {
    return {
      status: "broken-anchor",
      message: `Unable to resolve anchor \"${anchor}\" in ${page.relativePath}.`,
    };
  }

  return {
    status: "ok",
    href: `#${headingSlug}`,
    label: parsed.alias ?? anchor,
    targetPage: page,
  };
}

function resolveAgainstPage(page: ContentPage, parsed: ParsedWikiLink): ResolvedWikiLink {
  const label = parsed.alias ?? defaultLabel(parsed, page);

  if (!parsed.anchor) {
    return {
      status: "ok",
      href: page.routePath,
      label,
      targetPage: page,
    };
  }

  const headingSlug = resolveHeadingSlug(page, parsed.anchor);
  if (!headingSlug) {
    return {
      status: "broken-anchor",
      message: `Unable to resolve anchor \"${parsed.anchor}\" in ${page.relativePath}.`,
    };
  }

  return {
    status: "ok",
    href: `${page.routePath}#${headingSlug}`,
    label,
    targetPage: page,
  };
}

function resolveHeadingSlug(page: ContentPage, anchor: string): string | undefined {
  const normalizedAnchor = normalizeLookupValue(anchor);

  for (const heading of page.headings) {
    if (heading.explicitId && normalizeLookupValue(heading.explicitId) === normalizedAnchor) {
      return heading.explicitId;
    }
  }

  const slugifiedAnchor = slugifyHeading(anchor);
  for (const heading of page.headings) {
    if (heading.slug === slugifiedAnchor) {
      return heading.explicitId ?? heading.slug;
    }
  }

  for (const heading of page.headings) {
    if (normalizeLookupValue(heading.rawText) === normalizedAnchor) {
      return heading.explicitId ?? heading.slug;
    }
  }

  return undefined;
}

function defaultLabel(parsed: ParsedWikiLink, page: ContentPage): string {
  if (parsed.anchor) {
    return parsed.anchor;
  }

  if (page.baseName.length > 0) {
    return humanizeBaseName(page.baseName);
  }

  return parsed.target;
}
