import GithubSlugger from "github-slugger";

export function stripMarkdownFormatting(input: string): string {
  return input
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/[\*_~]/g, "")
    .trim();
}

export function slugifyHeading(input: string): string {
  const slugger = new GithubSlugger();
  return slugger.slug(stripMarkdownFormatting(input));
}

export function normalizeLookupValue(input: string): string {
  return input.trim().replace(/\s+/g, " ").toLowerCase();
}

export function humanizeBaseName(input: string): string {
  return input.replace(/[-_]+/g, " ").trim();
}
