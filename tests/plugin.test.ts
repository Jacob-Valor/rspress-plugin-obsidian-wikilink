import { describe, expect, test } from "bun:test";
import path from "node:path";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { unified } from "unified";
import { buildContentIndex, getCachedContentIndex } from "../src/content-index";
import { findWikilinkMatches, parseWikiLink } from "../src/parse-wikilink";
import { remarkWikilink } from "../src/remark-wikilink";
import { resolveWikiLink } from "../src/resolve-wikilink";

const fixtureRoot = path.resolve(process.cwd(), "tests/fixtures/basic");
const strictFixtureRoot = path.resolve(process.cwd(), "tests/fixtures/strict");
const headingFixtureRoot = path.resolve(
	process.cwd(),
	"tests/fixtures/headings",
);
const aliasFixtureRoot = path.resolve(process.cwd(), "tests/fixtures/aliases");
const aliasAmbiguousFixtureRoot = path.resolve(
	process.cwd(),
	"tests/fixtures/alias-ambiguous",
);

describe("parseWikiLink", () => {
	test("parses alias and anchor", () => {
		const parsed = parseWikiLink(
			"guide/getting-started#Install|Install guide",
			"[[guide/getting-started#Install|Install guide]]",
		);

		expect(parsed).toEqual({
			raw: "[[guide/getting-started#Install|Install guide]]",
			target: "guide/getting-started",
			alias: "Install guide",
			isEmbed: false,
			subpath: {
				kind: "heading",
				value: "Install",
			},
			isCurrentPageReference: false,
		});
	});

	test("parses embeds and block references", () => {
		const parsed = parseWikiLink(
			"guide/getting-started#^install-block|Install block",
			"![[guide/getting-started#^install-block|Install block]]",
		);

		expect(parsed).toEqual({
			raw: "![[guide/getting-started#^install-block|Install block]]",
			target: "guide/getting-started",
			alias: "Install block",
			isEmbed: true,
			subpath: {
				kind: "block",
				value: "install-block",
			},
			isCurrentPageReference: false,
		});
	});

	test("finds standard and embed wikilinks", () => {
		const matches = findWikilinkMatches("See [[Page]] and ![[Embed]]");

		expect(matches).toHaveLength(2);
		expect(matches[0]?.fullMatch).toBe("[[Page]]");
		expect(matches[1]?.fullMatch).toBe("![[Embed]]");
	});
});

describe("buildContentIndex", () => {
	test("indexes pages and headings", async () => {
		const index = await buildContentIndex(fixtureRoot);
		const page = index.byPathKey.get("guide/getting-started");

		expect(page?.routePath).toBe("/guide/getting-started");
		expect(page?.headings.map((heading) => heading.slug)).toContain("install");
		expect(page?.blocks).toEqual([{ id: "install-block" }]);
	});

	test("caches repeated content-index reads when files are unchanged", async () => {
		const first = await getCachedContentIndex(fixtureRoot);
		const second = await getCachedContentIndex(fixtureRoot);

		expect(second).toBe(first);
	});

	test("extracts setext, spaced atx, and explicit heading ids", async () => {
		const index = await buildContentIndex(headingFixtureRoot);
		const page = index.byPathKey.get("guide/variants");

		expect(page?.headings).toEqual([
			{ rawText: "Variants", slug: "variants" },
			{
				rawText: "Named Setext",
				slug: "named-setext",
				explicitId: "custom-setext",
			},
			{ rawText: "Spaced ATX Heading", slug: "spaced-atx-heading" },
			{
				rawText: "Custom Anchor",
				slug: "custom-anchor",
				explicitId: "custom-anchor",
			},
		]);
	});

	test("extracts frontmatter titles and aliases", async () => {
		const index = await buildContentIndex(aliasFixtureRoot);
		const page = index.byPathKey.get("guide/getting-started");

		expect(page?.title).toBe("Onboarding Guide");
		expect(page?.aliases).toEqual(["Start Here", "Kickoff"]);
		expect(index.byTitle.get("onboarding guide")?.[0]?.pathKey).toBe(
			"guide/getting-started",
		);
		expect(index.byAlias.get("start here")?.[0]?.pathKey).toBe(
			"guide/getting-started",
		);
	});
});

describe("resolveWikiLink", () => {
	test("resolves exact path links", async () => {
		const index = await buildContentIndex(fixtureRoot);
		const currentPage = index.byPathKey.get("")!;

		const result = resolveWikiLink(
			parseWikiLink("guide/getting-started", "[[guide/getting-started]]"),
			{
				currentPage,
				index,
			},
		);

		expect(result).toMatchObject({
			status: "ok",
			href: "/guide/getting-started",
			label: "getting started",
		});
	});

	test("resolves basename links when unique", async () => {
		const index = await buildContentIndex(fixtureRoot);
		const currentPage = index.byPathKey.get("")!;

		const result = resolveWikiLink(
			parseWikiLink("advanced#Advanced Usage", "[[advanced#Advanced Usage]]"),
			{
				currentPage,
				index,
			},
		);

		expect(result).toMatchObject({
			status: "ok",
			href: "/guide/advanced#advanced-usage",
			label: "Advanced Usage",
		});
	});

	test("resolves title and alias lookups when unique", async () => {
		const index = await buildContentIndex(aliasFixtureRoot);
		const currentPage = index.byPathKey.get("")!;

		const aliasResult = resolveWikiLink(
			parseWikiLink("Start Here", "[[Start Here]]"),
			{
				currentPage,
				index,
			},
		);
		const titleResult = resolveWikiLink(
			parseWikiLink("Onboarding Guide", "[[Onboarding Guide]]"),
			{
				currentPage,
				index,
			},
		);

		expect(aliasResult).toMatchObject({
			status: "ok",
			href: "/guide/getting-started",
		});
		expect(titleResult).toMatchObject({
			status: "ok",
			href: "/guide/getting-started",
		});
	});

	test("reports ambiguous basename links", async () => {
		const index = await buildContentIndex(
			path.resolve(process.cwd(), "tests/fixtures/ambiguous"),
		);
		const currentPage = index.byPathKey.get("")!;

		const result = resolveWikiLink(
			parseWikiLink("getting-started", "[[getting-started]]"),
			{
				currentPage,
				index,
			},
		);

		expect(result.status).toBe("ambiguous-page");
	});

	test("reports ambiguous alias links", async () => {
		const index = await buildContentIndex(aliasAmbiguousFixtureRoot);
		const currentPage = index.byPathKey.get("")!;

		const result = resolveWikiLink(
			parseWikiLink("Shared Alias", "[[Shared Alias]]"),
			{
				currentPage,
				index,
			},
		);

		expect(result.status).toBe("ambiguous-page");
	});

	test("reports broken anchors", async () => {
		const index = await buildContentIndex(fixtureRoot);
		const currentPage = index.byPathKey.get("")!;

		const result = resolveWikiLink(
			parseWikiLink(
				"guide/getting-started#Missing",
				"[[guide/getting-started#Missing]]",
			),
			{
				currentPage,
				index,
			},
		);

		expect(result.status).toBe("broken-anchor");
	});

	test("resolves block references", async () => {
		const index = await buildContentIndex(fixtureRoot);
		const currentPage = index.byPathKey.get("")!;

		const result = resolveWikiLink(
			parseWikiLink(
				"guide/getting-started#^install-block",
				"[[guide/getting-started#^install-block]]",
			),
			{
				currentPage,
				index,
			},
		);

		expect(result).toMatchObject({
			status: "ok",
			href: "/guide/getting-started#^install-block",
			label: "install-block",
		});
	});

	test("keeps exact path matching strict by case", async () => {
		const index = await buildContentIndex(strictFixtureRoot);
		const currentPage = index.byPathKey.get("")!;

		const result = resolveWikiLink(
			parseWikiLink("guide/casesensitive", "[[guide/casesensitive]]"),
			{
				currentPage,
				index,
			},
		);

		expect(result.status).toBe("broken-page");
	});

	test("supports optional fuzzy path matching", async () => {
		const index = await buildContentIndex(strictFixtureRoot);
		const currentPage = index.byPathKey.get("")!;

		const result = resolveWikiLink(
			parseWikiLink("guide/casesensitive", "[[guide/casesensitive]]"),
			{
				currentPage,
				index,
				options: {
					enableFuzzyMatching: true,
				},
			},
		);

		expect(result).toMatchObject({
			status: "ok",
			href: "/guide/CaseSensitive",
		});
	});

	test("rejects malformed empty targets", async () => {
		const index = await buildContentIndex(fixtureRoot);
		const currentPage = index.byPathKey.get("")!;

		const result = resolveWikiLink(parseWikiLink(" |Alias", "[[ |Alias]]"), {
			currentPage,
			index,
		});

		expect(result.status).toBe("broken-page");
	});

	test("resolves richer heading syntax", async () => {
		const index = await buildContentIndex(headingFixtureRoot);
		const currentPage = index.byPathKey.get("")!;

		const setextResult = resolveWikiLink(
			parseWikiLink(
				"guide/variants#Named Setext",
				"[[guide/variants#Named Setext]]",
			),
			{
				currentPage,
				index,
			},
		);
		const spacedAtxResult = resolveWikiLink(
			parseWikiLink(
				"guide/variants#Spaced ATX Heading",
				"[[guide/variants#Spaced ATX Heading]]",
			),
			{
				currentPage,
				index,
			},
		);
		const explicitIdResult = resolveWikiLink(
			parseWikiLink(
				"guide/variants#custom-anchor",
				"[[guide/variants#custom-anchor]]",
			),
			{
				currentPage,
				index,
			},
		);

		expect(setextResult).toMatchObject({
			status: "ok",
			href: "/guide/variants#custom-setext",
		});
		expect(spacedAtxResult).toMatchObject({
			status: "ok",
			href: "/guide/variants#spaced-atx-heading",
		});
		expect(explicitIdResult).toMatchObject({
			status: "ok",
			href: "/guide/variants#custom-anchor",
		});
	});
});

describe("remarkWikilink", () => {
	test("rewrites wikilinks into markdown links", async () => {
		const processor = unified()
			.use(remarkParse)
			.use(remarkWikilink, {
				getDocsRoot: () => fixtureRoot,
				options: {
					onBrokenLink: "error",
					onAmbiguousLink: "error",
					enableFuzzyMatching: false,
					enableCaseInsensitiveLookup: false,
					enableTagLinking: false,
					enableCallouts: false,
					enableBacklinks: false,
					enableTransclusion: false,
					enableMediaEmbeds: false,
				},
			})
			.use(remarkStringify);

		const file = await processor.process({
			value: "Go to [[guide/getting-started#Install|Install guide]].",
			path: path.resolve(fixtureRoot, "index.md"),
		});

		expect(String(file)).toBe(
			"Go to [Install guide](/guide/getting-started#install).\n",
		);
	});

	test("supports current-page anchors", async () => {
		const processor = unified()
			.use(remarkParse)
			.use(remarkWikilink, {
				getDocsRoot: () => fixtureRoot,
				options: {
					onBrokenLink: "error",
					onAmbiguousLink: "error",
					enableFuzzyMatching: false,
					enableCaseInsensitiveLookup: false,
					enableTagLinking: false,
					enableCallouts: false,
					enableBacklinks: false,
					enableTransclusion: false,
					enableMediaEmbeds: false,
				},
			})
			.use(remarkStringify);

		const file = await processor.process({
			value: "Jump to [[#Overview]].",
			path: path.resolve(fixtureRoot, "index.md"),
		});

		expect(String(file)).toBe("Jump to [Overview](#overview).\n");
	});

	test("rewrites block references into markdown links", async () => {
		const processor = unified()
			.use(remarkParse)
			.use(remarkWikilink, {
				getDocsRoot: () => fixtureRoot,
				options: {
					onBrokenLink: "error",
					onAmbiguousLink: "error",
					enableFuzzyMatching: false,
					enableCaseInsensitiveLookup: false,
					enableTagLinking: false,
					enableCallouts: false,
					enableBacklinks: false,
					enableTransclusion: false,
					enableMediaEmbeds: false,
				},
			})
			.use(remarkStringify);

		const file = await processor.process({
			value: "Jump to [[guide/getting-started#^install-block]].",
			path: path.resolve(fixtureRoot, "index.md"),
		});

		expect(String(file)).toBe(
			"Jump to [install-block](/guide/getting-started#^install-block).\n",
		);
	});

	test("rewrites embeds into embed html anchors", async () => {
		const processor = unified()
			.use(remarkParse)
			.use(remarkWikilink, {
				getDocsRoot: () => fixtureRoot,
				options: {
					onBrokenLink: "error",
					onAmbiguousLink: "error",
					enableFuzzyMatching: false,
					enableCaseInsensitiveLookup: false,
					enableTagLinking: false,
					enableCallouts: false,
					enableBacklinks: false,
					enableTransclusion: false,
					enableMediaEmbeds: false,
				},
			})
			.use(remarkStringify);

		const file = await processor.process({
			value: "![[guide/getting-started#Install|Install guide]]",
			path: path.resolve(fixtureRoot, "index.md"),
		});

		expect(String(file)).toBe(
			'<a class="obsidian-embed" data-obsidian-embed="true" href="/guide/getting-started#install">Install guide</a>\n',
		);
	});
});

describe("transclusion", () => {
	function makeProcessor(
		opts: Partial<Parameters<typeof remarkWikilink>[0]["options"]> = {},
	) {
		return unified()
			.use(remarkParse)
			.use(remarkWikilink, {
				getDocsRoot: () => fixtureRoot,
				options: {
					onBrokenLink: "error",
					onAmbiguousLink: "error",
					enableFuzzyMatching: false,
					enableCaseInsensitiveLookup: false,
					enableTagLinking: false,
					enableCallouts: false,
					enableBacklinks: false,
					enableTransclusion: true,
					enableMediaEmbeds: false,
					...opts,
				},
			})
			.use(remarkStringify);
	}

	test("transclubes full page content", async () => {
		const processor = makeProcessor();
		const file = await processor.process({
			value: "![[guide/getting-started]]",
			path: path.resolve(fixtureRoot, "index.md"),
		});
		const output = String(file);
		expect(output).toContain('class="obsidian-transclusion"');
		expect(output).toContain("Getting Started");
	});

	test("transclubes heading section only", async () => {
		const processor = makeProcessor();
		const file = await processor.process({
			value: "![[guide/getting-started#Install]]",
			path: path.resolve(fixtureRoot, "index.md"),
		});
		const output = String(file);
		expect(output).toContain('class="obsidian-transclusion"');
		expect(output).toContain("Install");
		expect(output).not.toContain("Getting Started\n");
	});

	test("transclubes block reference only", async () => {
		const processor = makeProcessor();
		const file = await processor.process({
			value: "![[guide/getting-started#^install-block]]",
			path: path.resolve(fixtureRoot, "index.md"),
		});
		const output = String(file);
		expect(output).toContain('class="obsidian-transclusion"');
		expect(output).toContain("Install steps");
	});
});

describe("tag linking", () => {
	test("rewrites tags into markdown links", async () => {
		const processor = unified()
			.use(remarkParse)
			.use(remarkWikilink, {
				getDocsRoot: () => fixtureRoot,
				options: {
					onBrokenLink: "error",
					onAmbiguousLink: "error",
					enableFuzzyMatching: false,
					enableCaseInsensitiveLookup: false,
					enableTagLinking: true,
					enableCallouts: false,
					enableBacklinks: false,
					enableTransclusion: false,
					enableMediaEmbeds: false,
				},
			})
			.use(remarkStringify);

		const file = await processor.process({
			value: "See #tag and #other_tag.",
			path: path.resolve(fixtureRoot, "index.md"),
		});

		expect(String(file)).toBe(
			"See [#tag](/tags/tag) and [#other\\_tag](/tags/other_tag).\n",
		);
	});
});

describe("callouts", () => {
	test("rewrites obsidian callouts into callout html", async () => {
		const processor = unified()
			.use(remarkParse)
			.use(remarkWikilink, {
				getDocsRoot: () => fixtureRoot,
				options: {
					onBrokenLink: "error",
					onAmbiguousLink: "error",
					enableFuzzyMatching: false,
					enableCaseInsensitiveLookup: false,
					enableTagLinking: false,
					enableCallouts: true,
					enableBacklinks: false,
					enableTransclusion: false,
					enableMediaEmbeds: false,
				},
			})
			.use(remarkStringify);

		const file = await processor.process({
			value: "> [!tip] Pro Tip\n> Body text",
			path: path.resolve(fixtureRoot, "index.md"),
		});

		const output = String(file);
		expect(output).toContain('<div class="callout callout-tip">');
		expect(output).toContain('<div class="callout-title">💡 Pro Tip</div>');
		expect(output).toContain('<div class="callout-content">');
		expect(output).toContain("Body text");
		expect(output).toContain("</div></div>");
	});
});

describe("case-insensitive lookup", () => {
	test("forwards case-insensitive lookup option through remark resolution", async () => {
		const processor = unified()
			.use(remarkParse)
			.use(remarkWikilink, {
				getDocsRoot: () => strictFixtureRoot,
				options: {
					onBrokenLink: "error",
					onAmbiguousLink: "error",
					enableFuzzyMatching: false,
					enableCaseInsensitiveLookup: true,
					enableTagLinking: false,
					enableCallouts: false,
					enableBacklinks: false,
					enableTransclusion: false,
					enableMediaEmbeds: false,
				},
			})
			.use(remarkStringify);

		const file = await processor.process({
			value: "Go to [[guide/casesensitive]].",
			path: path.resolve(strictFixtureRoot, "index.md"),
		});

		expect(String(file)).toBe("Go to [CaseSensitive](/guide/CaseSensitive).\n");
	});
});
