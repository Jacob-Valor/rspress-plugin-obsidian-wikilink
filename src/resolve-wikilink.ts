import path from "node:path";
import {
	humanizeBaseName,
	normalizeLookupValue,
	slugifyHeading,
} from "./slug.ts";
import type {
	ContentPage,
	ParsedWikiLink,
	ResolveContext,
	ResolvedWikiLink,
	WikiSubpath,
} from "./types.ts";
import {
	formatAvailableBlocks,
	formatAvailableHeadings,
	normalizePathKey,
} from "./utils.ts";

/**
 * Resolve a parsed wikilink against the content index, returning a
 * {@link ResolvedWikiLink} with either an `href` + `label` on success or
 * a diagnostic status + `message` on failure.
 *
 * Resolution order for non-current-page links:
 * 1. Exact path match
 * 2. Unique basename match
 * 3. Unique frontmatter title or alias match
 * 4. Case-insensitive path fallback (opt-in via
 *    {@link NormalizedPluginOptions.enableCaseInsensitiveLookup})
 * 5. Shortest-suffix fuzzy match (opt-in via
 *    {@link NormalizedPluginOptions.enableFuzzyMatching})
 */
export function resolveWikiLink(
	parsed: ParsedWikiLink,
	context: ResolveContext,
): ResolvedWikiLink {
	if (parsed.isCurrentPageReference) {
		return resolveCurrentPageReference(context.currentPage, parsed);
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
	const exactBaseNameCandidates =
		context.index.byBaseName.get(exactBaseName) ?? [];
	const exactBaseNameResolution = resolveCandidateSet(
		exactBaseNameCandidates,
		parsed.target,
		"path-qualified link",
	);
	if (exactBaseNameResolution) {
		return exactBaseNameResolution.kind === "resolved"
			? resolveAgainstPage(exactBaseNameResolution.page, parsed)
			: exactBaseNameResolution.result;
	}

	const metadataCandidates = getMetadataCandidates(context, parsed.target);
	const metadataResolution = resolveCandidateSet(
		metadataCandidates,
		parsed.target,
		"a more specific filename",
	);
	if (metadataResolution) {
		return metadataResolution.kind === "resolved"
			? resolveAgainstPage(metadataResolution.page, parsed)
			: metadataResolution.result;
	}

	if (context.options?.enableCaseInsensitiveLookup) {
		const caseInsensitiveResolution = resolveCaseInsensitivePage(
			context,
			parsed.target,
		);
		if (caseInsensitiveResolution) {
			return caseInsensitiveResolution.kind === "resolved"
				? resolveAgainstPage(caseInsensitiveResolution.page, parsed)
				: caseInsensitiveResolution.result;
		}
	}

	if (context.options?.enableFuzzyMatching) {
		const fuzzyResolution = resolveFuzzyPage(context, parsed.target);
		if (fuzzyResolution) {
			return fuzzyResolution.kind === "resolved"
				? resolveAgainstPage(fuzzyResolution.page, parsed)
				: fuzzyResolution.result;
		}
	}

	return {
		status: "broken-page",
		message: `Unable to resolve wikilink target "${parsed.target}".`,
	};
}

function resolveCurrentPageReference(
	page: ContentPage,
	parsed: ParsedWikiLink,
): ResolvedWikiLink {
	const subpath = parsed.subpath;
	if (!subpath?.value) {
		return {
			status: "broken-anchor",
			message: "Missing current-page anchor target.",
		};
	}

	const resolvedSubpath = resolveSubpath(page, subpath);
	if (!resolvedSubpath) {
		const suffix =
			subpath.kind === "heading"
				? formatAvailableHeadings(page)
				: formatAvailableBlocks(page);
		return {
			status: "broken-anchor",
			message: `Unable to resolve ${describeSubpath(subpath)} in ${page.relativePath}.${suffix}`,
		};
	}

	return {
		status: "ok",
		href: `#${resolvedSubpath}`,
		label: parsed.alias ?? subpath.value,
		targetPage: page,
	};
}

function resolveAgainstPage(
	page: ContentPage,
	parsed: ParsedWikiLink,
): ResolvedWikiLink {
	const label = parsed.alias ?? defaultLabel(parsed, page);

	if (!parsed.subpath) {
		return {
			status: "ok",
			href: page.routePath,
			label,
			targetPage: page,
		};
	}

	const resolvedSubpath = resolveSubpath(page, parsed.subpath);
	if (!resolvedSubpath) {
		const suffix =
			parsed.subpath.kind === "heading"
				? formatAvailableHeadings(page)
				: formatAvailableBlocks(page);
		return {
			status: "broken-anchor",
			message: `Unable to resolve ${describeSubpath(parsed.subpath)} in ${page.relativePath}.${suffix}`,
		};
	}

	return {
		status: "ok",
		href: `${page.routePath}#${resolvedSubpath}`,
		label,
		targetPage: page,
	};
}

function resolveSubpath(
	page: ContentPage,
	subpath: WikiSubpath,
): string | undefined {
	if (subpath.kind === "block") {
		return resolveBlockId(page, subpath.value);
	}

	return resolveHeadingSlug(page, subpath.value);
}

function resolveHeadingSlug(
	page: ContentPage,
	anchor: string,
): string | undefined {
	const normalizedAnchor = normalizeLookupValue(anchor);

	// Attempt 1: explicit heading ID match — O(1) via pre-computed map.
	const explicitEntry = page.headingBySlug.get(normalizedAnchor);
	if (explicitEntry?.explicitId) {
		return explicitEntry.explicitId;
	}

	const slugifiedAnchor = slugifyHeading(anchor);

	// Attempt 2: slug match — O(1) via pre-computed map.
	const slugEntry = page.headingBySlug.get(slugifiedAnchor);
	if (slugEntry) {
		return slugEntry.explicitId ?? slugEntry.slug;
	}

	// Attempt 3: raw text match — O(1) via pre-computed map.
	const textEntry = page.headingByText.get(normalizedAnchor);
	if (textEntry) {
		return textEntry.explicitId ?? textEntry.slug;
	}

	// Attempt 4: emoji-preserving slug prefix fallback.
	// Obsidian may preserve emoji in heading IDs, but github-slugger strips
	// them, so the slugged anchor may be a prefix of the stored slug.
	for (const heading of page.headings) {
		if (heading.slug.startsWith(`${slugifiedAnchor}-`)) {
			return heading.explicitId ?? heading.slug;
		}
	}

	// Attempt 5: case-insensitive substring match (for Unicode headings).
	for (const heading of page.headings) {
		if (heading.rawText.toLowerCase().includes(anchor.toLowerCase())) {
			return heading.explicitId ?? heading.slug;
		}
	}

	return undefined;
}

function resolveBlockId(
	page: ContentPage,
	blockId: string,
): string | undefined {
	const normalizedBlockId = normalizeLookupValue(blockId);

	for (const block of page.blocks) {
		if (normalizeLookupValue(block.id) === normalizedBlockId) {
			return `^${block.id}`;
		}
	}

	return undefined;
}

function defaultLabel(parsed: ParsedWikiLink, page: ContentPage): string {
	if (parsed.subpath) {
		return parsed.subpath.value;
	}

	if (page.baseName.length > 0) {
		return humanizeBaseName(page.baseName);
	}

	return parsed.target;
}

function getMetadataCandidates(
	context: ResolveContext,
	target: string,
): ContentPage[] {
	const normalizedTarget = normalizeLookupValue(target);
	if (!normalizedTarget) {
		return [];
	}

	const deduped = new Map<string, ContentPage>();
	for (const page of context.index.byTitle.get(normalizedTarget) ?? []) {
		deduped.set(page.absolutePath, page);
	}
	for (const page of context.index.byAlias.get(normalizedTarget) ?? []) {
		deduped.set(page.absolutePath, page);
	}

	return [...deduped.values()];
}

function resolveCandidateSet(
	candidates: ContentPage[],
	target: string,
	instruction: string,
):
	| { kind: "resolved"; page: ContentPage }
	| { kind: "result"; result: ResolvedWikiLink }
	| undefined {
	if (candidates.length === 0) {
		return undefined;
	}

	if (candidates.length > 1) {
		return {
			kind: "result",
			result: {
				status: "ambiguous-page",
				message: `Wikilink target "${target}" is ambiguous; use ${instruction} instead.`,
			},
		};
	}

	const [candidate] = candidates;
	if (!candidate) {
		return undefined;
	}

	return {
		kind: "resolved",
		page: candidate,
	};
}

function resolveFuzzyPage(
	context: ResolveContext,
	target: string,
):
	| { kind: "resolved"; page: ContentPage }
	| { kind: "result"; result: ResolvedWikiLink }
	| undefined {
	const normalizedTarget = normalizeFuzzyLookup(target);
	if (!normalizedTarget) {
		return undefined;
	}

	// Find all pages matching by case-insensitive path or path suffix
	const suffixMatches = context.index.pages.filter((page) => {
		const normalizedPagePath = normalizeFuzzyLookup(page.pathKey);
		return (
			normalizedPagePath === normalizedTarget ||
			normalizedPagePath.endsWith(`/${normalizedTarget}`)
		);
	});

	if (suffixMatches.length === 0) {
		return undefined;
	}

	const sortedMatches = [...suffixMatches].sort(
		(left, right) => left.pathKey.length - right.pathKey.length,
	);
	const bestMatch = sortedMatches[0];
	const secondMatch = sortedMatches[1];

	if (!bestMatch) {
		return undefined;
	}

	if (secondMatch && secondMatch.pathKey.length === bestMatch.pathKey.length) {
		return {
			kind: "result",
			result: {
				status: "ambiguous-page",
				message: `Fuzzy wikilink target "${target}" matched multiple pages; use a more specific path instead.`,
			},
		};
	}

	return {
		kind: "resolved",
		page: bestMatch,
	};
}

function resolveCaseInsensitivePage(
	context: ResolveContext,
	target: string,
):
	| { kind: "resolved"; page: ContentPage }
	| { kind: "result"; result: ResolvedWikiLink }
	| undefined {
	const normalizedTarget = normalizePathKey(target).toLowerCase();
	if (!normalizedTarget) {
		return undefined;
	}

	const pathCandidates = context.index.byPathKeyCI.get(normalizedTarget);
	if (pathCandidates) {
		return resolveCandidateSet(pathCandidates, target, "a more specific path");
	}

	const baseName = path.basename(normalizedTarget);
	const baseCandidates = context.index.byBaseNameCI.get(baseName);
	return resolveCandidateSet(
		baseCandidates ?? [],
		target,
		"a path-qualified link",
	);
}

function normalizeFuzzyLookup(input: string): string {
	return normalizePathKey(input).toLowerCase();
}

function describeSubpath(subpath: WikiSubpath): string {
	if (subpath.kind === "block") {
		return `block reference "^${subpath.value}"`;
	}

	return `anchor "${subpath.value}"`;
}
