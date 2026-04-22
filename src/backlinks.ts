import fs from "node:fs";
import path from "node:path";
import type { ContentIndex, ContentPage } from "./types.ts";
import { normalizePathKey } from "./utils.ts";

const WIKILINK_RE = /!?\[\[([^\]]+?)\]\]/g;

// Keyed by the ContentIndex object itself — automatically invalidated when
// getCachedContentIndex returns a new index after file changes.
const backlinksCache = new WeakMap<ContentIndex, Map<string, BacklinkRef[]>>();

export interface BacklinkRef {
  routePath: string;
  title: string;
}

/**
 * Return the backlinks index for the given content index, reusing the cached
 * result when the index object hasn't changed (same reference = same files).
 */
export async function getCachedBacklinksIndex(
  index: ContentIndex,
): Promise<Map<string, BacklinkRef[]>> {
  const cached = backlinksCache.get(index);
  if (cached) return cached;

  const result = await buildBacklinksIndex(index);
  backlinksCache.set(index, result);
  return result;
}

/**
 * Build a map from each page's routePath to the list of pages that link to it.
 *
 * Uses the content index lookup maps instead of brute-force iteration over all
 * pages, reducing resolution from O(links × pages) to O(links × 1) amortized.
 */
export async function buildBacklinksIndex(
  index: ContentIndex,
): Promise<Map<string, BacklinkRef[]>> {
  const backlinks = new Map<string, BacklinkRef[]>();

  for (const page of index.pages) {
    let content: string;
    try {
      content = await fs.promises.readFile(page.absolutePath, "utf-8");
    } catch (error) {
      console.warn(
        `[rspress-plugin-obsidian-wikilink:backlinks] Skipped ${page.relativePath}: ${error instanceof Error ? error.message : String(error)}`,
      );
      continue;
    }

    // Deduplicate targets within a single source page
    const seenTargets = new Set<string>();

    for (const match of content.matchAll(WIKILINK_RE)) {
      const inner = match[1] ?? "";
      const target = inner.split("|")[0]?.split("#")[0]?.trim() ?? "";
      if (!target) continue;

      const normalizedTarget = target.replace(/\\/g, "/").toLowerCase();
      if (seenTargets.has(normalizedTarget)) continue;
      seenTargets.add(normalizedTarget);

      const resolved = resolveBacklinkTarget(index, normalizedTarget);
      for (const candidate of resolved) {
        if (candidate.absolutePath === page.absolutePath) continue;
        addBacklink(backlinks, candidate.routePath, page);
      }
    }
  }

  return backlinks;
}

/**
 * Resolve a wikilink target to candidate pages using the index maps.
 * Returns a deduplicated array of matching pages.
 */
function resolveBacklinkTarget(
  index: ContentIndex,
  normalizedTarget: string,
): ContentPage[] {
  const seen = new Set<string>();
  const results: ContentPage[] = [];

  const addPage = (page: ContentPage) => {
    if (!seen.has(page.absolutePath)) {
      seen.add(page.absolutePath);
      results.push(page);
    }
  };

  // Try exact pathKey lookup
  const pathKey = normalizePathKey(normalizedTarget);
  const exactPage = index.byPathKey.get(pathKey);
  if (exactPage) {
    addPage(exactPage);
    return results;
  }

  // Try basename lookup
  const baseName = path.basename(pathKey) || pathKey;
  const baseNameCandidates = index.byBaseName.get(baseName);
  if (baseNameCandidates) {
    for (const page of baseNameCandidates) {
      addPage(page);
    }
  }

  // Also try case-insensitive basename as fallback
  if (results.length === 0) {
    for (const [key, pages] of index.byBaseName) {
      if (key.toLowerCase() === baseName) {
        for (const page of pages) {
          addPage(page);
        }
      }
    }
  }

  return results;
}

function addBacklink(
  backlinks: Map<string, BacklinkRef[]>,
  targetRoutePath: string,
  sourcePage: ContentPage,
): void {
  const existing = backlinks.get(targetRoutePath) ?? [];
  const already = existing.some((e) => e.routePath === sourcePage.routePath);
  if (!already) {
    existing.push({
      routePath: sourcePage.routePath,
      title: sourcePage.title ?? sourcePage.baseName,
    });
    backlinks.set(targetRoutePath, existing);
  }
}

/**
 * Render a backlinks panel as raw HTML. Returns the empty string when
 * there are no refs so the caller can unconditionally append the result.
 * The output is wrapped in `<div class="obsidian-backlinks">` and uses the
 * `.obsidian-backlinks` selectors in the bundled stylesheet.
 */
export function renderBacklinksHtml(refs: BacklinkRef[]): string {
  if (refs.length === 0) return "";
  const items = refs
    .map(
      (r) =>
        `<li><a href="${escapeHtmlAttribute(r.routePath)}">${escapeHtmlText(r.title)}</a></li>`,
    )
    .join("\n");
  return `<div class="obsidian-backlinks">\n<h2>Backlinks</h2>\n<ul>\n${items}\n</ul>\n</div>`;
}

function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeHtmlAttribute(value: string): string {
  return escapeHtmlText(value).replace(/"/g, "&quot;");
}
