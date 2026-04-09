import fs from "node:fs";
import path from "node:path";
import GithubSlugger from "github-slugger";
import type { ContentIndex, ContentPage, HeadingEntry } from "./types.js";
import { stripMarkdownFormatting } from "./slug.js";

const MARKDOWN_EXTENSIONS = new Set([".md", ".mdx"]);
const contentIndexCache = new Map<string, { signature: string; index: ContentIndex }>();

interface MarkdownFileEntry {
  absolutePath: string;
  relativePath: string;
  mtimeMs: number;
  size: number;
}

export function buildContentIndex(rootDir: string): ContentIndex {
  const absoluteRoot = path.resolve(rootDir);
  const files = scanMarkdownFiles(absoluteRoot);
  return buildContentIndexFromFiles(absoluteRoot, files);
}

export function getCachedContentIndex(rootDir: string): ContentIndex {
  const absoluteRoot = path.resolve(rootDir);
  const files = scanMarkdownFiles(absoluteRoot);
  const signature = files
    .map((file) => `${file.relativePath}:${file.mtimeMs}:${file.size}`)
    .join("|");

  const cached = contentIndexCache.get(absoluteRoot);
  if (cached?.signature === signature) {
    return cached.index;
  }

  const index = buildContentIndexFromFiles(absoluteRoot, files);
  contentIndexCache.set(absoluteRoot, { signature, index });
  return index;
}

function buildContentIndexFromFiles(rootDir: string, files: MarkdownFileEntry[]): ContentIndex {
  const pages = files.map((file) => buildContentPage(file));
  const byAbsolutePath = new Map<string, ContentPage>();
  const byPathKey = new Map<string, ContentPage>();
  const byBaseName = new Map<string, ContentPage[]>();

  for (const page of pages) {
    byAbsolutePath.set(page.absolutePath, page);
    byPathKey.set(page.pathKey, page);

    if (page.baseName.length > 0) {
      const existing = byBaseName.get(page.baseName) ?? [];
      existing.push(page);
      byBaseName.set(page.baseName, existing);
    }
  }

  return {
    rootDir,
    pages,
    byAbsolutePath,
    byPathKey,
    byBaseName,
  };
}

function scanMarkdownFiles(rootDir: string): MarkdownFileEntry[] {
  const results: MarkdownFileEntry[] = [];
  const queue = [rootDir];

  while (queue.length > 0) {
    const currentDir = queue.shift();
    if (!currentDir) {
      continue;
    }

    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        if (entry.name === ".git" || entry.name === "node_modules" || entry.name.startsWith(".")) {
          continue;
        }

        queue.push(absolutePath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      if (!MARKDOWN_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        continue;
      }

      const relativePath = normalizeFsPath(path.relative(rootDir, absolutePath));
      if (!isRoutableRelativePath(relativePath)) {
        continue;
      }

      const stats = fs.statSync(absolutePath);
      results.push({
        absolutePath: normalizeFsPath(path.resolve(absolutePath)),
        relativePath,
        mtimeMs: stats.mtimeMs,
        size: stats.size,
      });
    }
  }

  results.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
  return results;
}

function isRoutableRelativePath(relativePath: string): boolean {
  return relativePath.split("/").every((segment) => !/^_[^_]/.test(segment));
}

function buildContentPage(file: MarkdownFileEntry): ContentPage {
  const routePath = deriveRoutePath(file.relativePath);
  const pathKey = normalizePathKey(file.relativePath);
  const baseName = path.basename(pathKey);
  const headings = extractHeadings(fs.readFileSync(file.absolutePath, "utf8"));

  return {
    absolutePath: file.absolutePath,
    relativePath: file.relativePath,
    routePath,
    pathKey,
    baseName,
    headings,
  };
}

function deriveRoutePath(relativePath: string): string {
  const withoutExtension = relativePath.replace(/\.(md|mdx)$/i, "");
  const routeKey = normalizePathKey(withoutExtension);
  return routeKey.length === 0 ? "/" : `/${routeKey}`;
}

export function normalizePathKey(input: string): string {
  const normalized = normalizeFsPath(input)
    .replace(/\.(md|mdx)$/i, "")
    .replace(/^\/+|\/+$/g, "")
    .replace(/\/index$/i, "")
    .trim();

  if (normalized.length === 0 || normalized.toLowerCase() === "index") {
    return "";
  }

  return normalized.replace(/\\/g, "/");
}

function extractHeadings(markdown: string): HeadingEntry[] {
  const slugger = new GithubSlugger();
  const headings: HeadingEntry[] = [];
  const lines = markdown.split(/\r?\n/);
  let inFence = false;
  let inFrontmatter = lines[0]?.trim() === "---";

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";

    if (inFrontmatter) {
      if (index > 0 && line.trim() === "---") {
        inFrontmatter = false;
      }
      continue;
    }

    if (/^(```|~~~)/.test(line.trim())) {
      inFence = !inFence;
      continue;
    }

    if (inFence) {
      continue;
    }

    const atxMatch = /^\s{0,3}(#{1,6})[ \t]+(.+?)[ \t]*#*[ \t]*$/.exec(line);
    if (atxMatch) {
      pushHeading(headings, slugger, atxMatch[2] ?? "");
      continue;
    }

    const nextLine = lines[index + 1] ?? "";
    if (!/^\s{0,3}(=+|-+)\s*$/.test(nextLine)) {
      continue;
    }

    const rawHeading = line.trim();
    if (rawHeading.length === 0) {
      continue;
    }

    pushHeading(headings, slugger, rawHeading);
    index += 1;
  }

  return headings;
}

function pushHeading(headings: HeadingEntry[], slugger: GithubSlugger, rawHeading: string): void {
  const trimmedHeading = rawHeading.trim();
  const explicitIdMatch = trimmedHeading.match(/\s*\{#([A-Za-z0-9_:.\-]+)\}\s*$/);
  const explicitId = explicitIdMatch?.[1];
  const headingText = explicitIdMatch
    ? trimmedHeading.slice(0, trimmedHeading.length - explicitIdMatch[0].length).trim()
    : trimmedHeading;
  const normalizedText = stripMarkdownFormatting(headingText);

  if (normalizedText.length === 0) {
    return;
  }

  headings.push({
    rawText: normalizedText,
    slug: slugger.slug(normalizedText),
    explicitId,
  });
}

export function normalizeFsPath(input: string): string {
  return input.replace(/\\/g, "/");
}
