import GithubSlugger from "github-slugger";

export function stripMarkdownFormatting(input: string): string {
	return input
		.replace(/`([^`]+)`/g, "$1")
		.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
		.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
		.replace(/<[^>]+>/g, "")
		.replace(/[*_~]/g, "")
		.trim();
}

/**
 * Slugify a heading for anchor generation.
 *
 * Uses a fresh GithubSlugger instance to produce a deterministic slug
 * without counter suffixes (each call is independent).
 */
export function slugifyHeading(input: string): string {
	sluggerInstance.reset();
	return sluggerInstance.slug(stripMarkdownFormatting(input));
}

/** Shared slugger instance, reset before each use to avoid allocation. */
const sluggerInstance = new GithubSlugger();

export function normalizeLookupValue(input: string): string {
	return input.trim().replace(/\s+/g, " ").toLowerCase();
}

export function humanizeBaseName(input: string): string {
	return input.replace(/[-_]+/g, " ").trim();
}
