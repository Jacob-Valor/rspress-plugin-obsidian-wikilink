import { describe, expect, test } from "bun:test";
import path from "node:path";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { unified } from "unified";
import { buildContentIndex, getCachedContentIndex } from "../src/content-index";
import { findWikilinkMatches, parseWikiLink } from "../src/parse-wikilink";
import { remarkWikilink } from "../src/remark-wikilink";
import { resolveWikiLink } from "../src/resolve-wikilink";
import type { NormalizedPluginOptions } from "../src/types";

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
const inlineBlocksFixtureRoot = path.resolve(
	process.cwd(),
	"tests/fixtures/inline-blocks",
);
const tagsFixtureRoot = path.resolve(process.cwd(), "tests/fixtures/tags");
const setextFixtureRoot = path.resolve(process.cwd(), "tests/fixtures/setext");
const cssclassesFixtureRoot = path.resolve(
	process.cwd(),
	"tests/fixtures/cssclasses",
);
const nestedTagsFixtureRoot = path.resolve(
	process.cwd(),
	"tests/fixtures/nested-tags",
);

const DEFAULT_OPTIONS: NormalizedPluginOptions = {
	onBrokenLink: "error",
	onAmbiguousLink: "error",
	enableFuzzyMatching: false,
	enableCaseInsensitiveLookup: false,
	enableTagLinking: false,
	enableCallouts: false,
	enableBacklinks: false,
	enableTransclusion: false,
	enableMediaEmbeds: false,
	enableTagPages: false,
	enableDefaultStyles: false,
};

function makeProcessor(
	docsRoot: string,
	optionOverrides: Partial<NormalizedPluginOptions> = {},
) {
	return unified()
		.use(remarkParse)
		.use(remarkWikilink, {
			getDocsRoot: () => docsRoot,
			options: { ...DEFAULT_OPTIONS, ...optionOverrides },
		})
		.use(remarkStringify);
}

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
		const processor = makeProcessor(fixtureRoot);

		const file = await processor.process({
			value: "Go to [[guide/getting-started#Install|Install guide]].",
			path: path.resolve(fixtureRoot, "index.md"),
		});

		expect(String(file)).toBe(
			"Go to [Install guide](/guide/getting-started#install).\n",
		);
	});

	test("supports current-page anchors", async () => {
		const processor = makeProcessor(fixtureRoot);

		const file = await processor.process({
			value: "Jump to [[#Overview]].",
			path: path.resolve(fixtureRoot, "index.md"),
		});

		expect(String(file)).toBe("Jump to [Overview](#overview).\n");
	});

	test("rewrites block references into markdown links", async () => {
		const processor = makeProcessor(fixtureRoot);

		const file = await processor.process({
			value: "Jump to [[guide/getting-started#^install-block]].",
			path: path.resolve(fixtureRoot, "index.md"),
		});

		expect(String(file)).toBe(
			"Jump to [install-block](/guide/getting-started#^install-block).\n",
		);
	});

	test("rewrites embeds into embed html anchors", async () => {
		const processor = makeProcessor(fixtureRoot);

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
	test("transclubes full page content", async () => {
		const processor = makeProcessor(fixtureRoot, {
			enableTransclusion: true,
		});
		const file = await processor.process({
			value: "![[guide/getting-started]]",
			path: path.resolve(fixtureRoot, "index.md"),
		});
		const output = String(file);
		expect(output).toContain('class="obsidian-transclusion"');
		expect(output).toContain("Getting Started");
	});

	test("transclubes heading section only", async () => {
		const processor = makeProcessor(fixtureRoot, {
			enableTransclusion: true,
		});
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
		const processor = makeProcessor(fixtureRoot, {
			enableTransclusion: true,
		});
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
		const processor = makeProcessor(fixtureRoot, {
			enableTagLinking: true,
		});

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
		const processor = makeProcessor(fixtureRoot, {
			enableCallouts: true,
		});

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
		const processor = makeProcessor(strictFixtureRoot, {
			enableCaseInsensitiveLookup: true,
		});

		const file = await processor.process({
			value: "Go to [[guide/casesensitive]].",
			path: path.resolve(strictFixtureRoot, "index.md"),
		});

		expect(String(file)).toBe("Go to [CaseSensitive](/guide/CaseSensitive).\n");
	});
});

describe("inline block ID indexing", () => {
	test("indexes standalone block IDs", async () => {
		const index = await buildContentIndex(inlineBlocksFixtureRoot);
		const page = index.byPathKey.get("guide/inline-target");

		expect(page?.blocks.map((b) => b.id)).toContain("standalone-block");
	});

	test("indexes inline block IDs appended to paragraph text", async () => {
		const index = await buildContentIndex(inlineBlocksFixtureRoot);
		const page = index.byPathKey.get("guide/inline-target");

		expect(page?.blocks.map((b) => b.id)).toContain("inline-block");
	});

	test("resolves wikilink to an inline block ID", async () => {
		const index = await buildContentIndex(inlineBlocksFixtureRoot);
		const currentPage = index.byPathKey.get("")!;

		const result = resolveWikiLink(
			parseWikiLink(
				"guide/inline-target#^inline-block",
				"[[guide/inline-target#^inline-block]]",
			),
			{ currentPage, index },
		);

		expect(result).toMatchObject({
			status: "ok",
			href: "/guide/inline-target#^inline-block",
		});
	});
});

describe("frontmatter tags", () => {
	test("indexes tags from frontmatter", async () => {
		const index = await buildContentIndex(tagsFixtureRoot);
		const page = index.byPathKey.get("guide/tagged-page");

		expect(page?.tags).toEqual(["tutorial", "obsidian"]);
	});

	test("builds byTag lookup map", async () => {
		const index = await buildContentIndex(tagsFixtureRoot);

		expect(index.byTag.get("tutorial")?.[0]?.pathKey).toBe("guide/tagged-page");
		expect(index.byTag.get("obsidian")?.[0]?.pathKey).toBe("guide/tagged-page");
	});
});

describe("backlinks caching", () => {
	test("returns the same map object on repeated calls with same index", async () => {
		const { getCachedBacklinksIndex } = await import("../src/backlinks");
		const index = await buildContentIndex(fixtureRoot);

		const first = await getCachedBacklinksIndex(index);
		const second = await getCachedBacklinksIndex(index);

		expect(second).toBe(first);
	});
});

describe("tag regex", () => {
	test("rewrites word tags", async () => {
		const processor = makeProcessor(fixtureRoot, { enableTagLinking: true });
		const file = await processor.process({
			value: "See #tutorial and #my-tag.",
			path: path.resolve(fixtureRoot, "index.md"),
		});
		expect(String(file)).toContain("[#tutorial](/tags/tutorial)");
		expect(String(file)).toContain("[#my-tag](/tags/my-tag)");
	});

	test("does not rewrite purely numeric tags (e.g. issue numbers)", async () => {
		const processor = makeProcessor(fixtureRoot, { enableTagLinking: true });
		const file = await processor.process({
			value: "See issue #123 and PR #456.",
			path: path.resolve(fixtureRoot, "index.md"),
		});
		const output = String(file);
		// Pure-numeric strings after # are not valid Obsidian tags
		expect(output).not.toContain("/tags/123");
		expect(output).not.toContain("/tags/456");
	});

	test("does not rewrite tags inside URL fragments", async () => {
		const processor = makeProcessor(fixtureRoot, { enableTagLinking: true });
		const file = await processor.process({
			value: "See https://example.com/page#section for details.",
			path: path.resolve(fixtureRoot, "index.md"),
		});
		const output = String(file);
		// URL fragment preceded by a word char — should not be rewritten
		expect(output).not.toContain("/tags/section");
	});
});

describe("callout foldable state", () => {
	test("renders static callout as div", async () => {
		const processor = makeProcessor(fixtureRoot, { enableCallouts: true });
		const file = await processor.process({
			value: "> [!note] Title\n> Body",
			path: path.resolve(fixtureRoot, "index.md"),
		});
		const output = String(file);
		expect(output).toContain('<div class="callout callout-note">');
		expect(output).not.toContain("<details");
	});

	test("renders collapsed callout (-) as closed details element", async () => {
		const processor = makeProcessor(fixtureRoot, { enableCallouts: true });
		const file = await processor.process({
			value: "> [!note]- Collapsed\n> Body",
			path: path.resolve(fixtureRoot, "index.md"),
		});
		const output = String(file);
		expect(output).toContain('<details class="callout callout-note">');
		expect(output).toContain("<summary");
		expect(output).not.toContain("open");
	});

	test("renders expanded callout (+) as open details element", async () => {
		const processor = makeProcessor(fixtureRoot, { enableCallouts: true });
		const file = await processor.process({
			value: "> [!tip]+ Expanded\n> Body",
			path: path.resolve(fixtureRoot, "index.md"),
		});
		const output = String(file);
		expect(output).toContain('<details class="callout callout-tip" open>');
		expect(output).toContain("<summary");
	});
});

describe("Obsidian comment stripping", () => {
	test("strips inline %% comments %% from text", async () => {
		const processor = makeProcessor(fixtureRoot);
		const file = await processor.process({
			value: "Before %% hidden comment %% after.",
			path: path.resolve(fixtureRoot, "index.md"),
		});
		const output = String(file);
		expect(output).not.toContain("hidden comment");
		expect(output).toContain("Before");
		expect(output).toContain("after.");
	});

	test("strips multi-line block %% comments %%", async () => {
		const processor = makeProcessor(fixtureRoot);
		const file = await processor.process({
			value: "%%\nprivate draft content\n%%",
			path: path.resolve(fixtureRoot, "index.md"),
		});
		const output = String(file);
		expect(output).not.toContain("private draft content");
	});

	test("leaves non-comment text untouched", async () => {
		const processor = makeProcessor(fixtureRoot);
		const file = await processor.process({
			value: "Normal text with no comments.",
			path: path.resolve(fixtureRoot, "index.md"),
		});
		expect(String(file)).toContain("Normal text with no comments.");
	});
});

describe("callout type aliases", () => {
	test("maps 'summary' alias to abstract icon", async () => {
		const processor = makeProcessor(fixtureRoot, { enableCallouts: true });
		const file = await processor.process({
			value: "> [!summary] Title\n> Body",
			path: path.resolve(fixtureRoot, "index.md"),
		});
		const output = String(file);
		expect(output).toContain("callout-abstract");
	});

	test("maps 'done' alias to success icon", async () => {
		const processor = makeProcessor(fixtureRoot, { enableCallouts: true });
		const file = await processor.process({
			value: "> [!done] Title\n> Body",
			path: path.resolve(fixtureRoot, "index.md"),
		});
		expect(String(file)).toContain("callout-success");
	});

	test("maps 'fail' alias to failure type", async () => {
		const processor = makeProcessor(fixtureRoot, { enableCallouts: true });
		const file = await processor.process({
			value: "> [!fail] Title\n> Body",
			path: path.resolve(fixtureRoot, "index.md"),
		});
		expect(String(file)).toContain("callout-failure");
	});

	test("maps 'attention' alias to caution type", async () => {
		const processor = makeProcessor(fixtureRoot, { enableCallouts: true });
		const file = await processor.process({
			value: "> [!attention] Title\n> Body",
			path: path.resolve(fixtureRoot, "index.md"),
		});
		expect(String(file)).toContain("callout-caution");
	});
});

describe("setext heading transclusion", () => {
	test("transclubes a setext H1 section", async () => {
		const processor = makeProcessor(setextFixtureRoot, {
			enableTransclusion: true,
		});
		const file = await processor.process({
			value: "![[guide/setext-page#Install]]",
			path: path.resolve(setextFixtureRoot, "index.md"),
		});
		const output = String(file);
		expect(output).toContain('class="obsidian-transclusion"');
		expect(output).toContain("Install steps here");
		expect(output).not.toContain("Introduction content");
	});

	test("transclubes a setext H2 section", async () => {
		const processor = makeProcessor(setextFixtureRoot, {
			enableTransclusion: true,
		});
		const file = await processor.process({
			value: "![[guide/setext-page#Advanced]]",
			path: path.resolve(setextFixtureRoot, "index.md"),
		});
		const output = String(file);
		expect(output).toContain("Advanced content here");
		expect(output).not.toContain("Install steps here");
	});
});

describe("tag page generation", () => {
	test("generateTagPages produces one page per unique tag", async () => {
		const { generateTagPages } = await import("../src/tag-pages");
		const index = await buildContentIndex(tagsFixtureRoot);
		const pages = generateTagPages(index);

		const routes = pages.map((p) => p.routePath);
		expect(routes).toContain("/tags/tutorial");
		expect(routes).toContain("/tags/obsidian");
	});

	test("generated tag page lists pages with that tag", async () => {
		const { generateTagPages } = await import("../src/tag-pages");
		const index = await buildContentIndex(tagsFixtureRoot);
		const pages = generateTagPages(index);

		const tutorialPage = pages.find((p) => p.routePath === "/tags/tutorial");
		expect(tutorialPage?.content).toContain("Tagged Guide");
		expect(tutorialPage?.content).toContain("/guide/tagged-page");
	});
});

describe("footnote fixes", () => {
	test("definition lines are stripped from rendered output", async () => {
		const processor = makeProcessor(fixtureRoot);
		const file = await processor.process({
			value: "Reference[^1] here.\n\n[^1]: The definition text.",
			path: path.resolve(fixtureRoot, "index.md"),
		});
		const output = String(file);
		// Raw definition syntax must not appear as literal text
		expect(output).not.toContain("[^1]:");
		// The footnote reference superscript must be present
		expect(output).toContain('id="fnref-1"');
		// The definition must be rendered in the footnotes list
		expect(output).toContain("The definition text.");
		expect(output).toContain('<ol class="footnotes">');
	});

	test("superscript title is populated even when definition appears after reference", async () => {
		const processor = makeProcessor(fixtureRoot);
		const file = await processor.process({
			value: "Reference[^note] here.\n\n[^note]: Def text.",
			path: path.resolve(fixtureRoot, "index.md"),
		});
		const output = String(file);
		expect(output).toContain('title="Def text."');
	});

	test("multiple definitions all stripped and all rendered in list", async () => {
		// Use multi-word definitions — single-word definitions (e.g. "[^a]: Alpha.")
		// are indistinguishable from link definitions in remark-parse and stay as
		// linkReference nodes our text visitor won't see. That is a remark-parse
		// limitation, not a plugin bug; real Obsidian notes always use prose.
		const processor = makeProcessor(fixtureRoot);
		const file = await processor.process({
			value:
				"A[^a] and B[^b].\n\n[^a]: Alpha definition text.\n\n[^b]: Beta definition text.",
			path: path.resolve(fixtureRoot, "index.md"),
		});
		const output = String(file);
		expect(output).not.toContain("[^a]:");
		expect(output).not.toContain("[^b]:");
		expect(output).toContain('id="fn-a"');
		expect(output).toContain('id="fn-b"');
		expect(output).toContain("Alpha definition text.");
		expect(output).toContain("Beta definition text.");
	});

	test("inline footnote ^[text] renders as numbered superscript", async () => {
		const processor = makeProcessor(fixtureRoot);
		const file = await processor.process({
			value: "Inline footnote^[This is inline content] here.",
			path: path.resolve(fixtureRoot, "index.md"),
		});
		const output = String(file);
		expect(output).toContain('id="fnref-inline-1"');
		expect(output).toContain('title="This is inline content"');
		expect(output).toContain('id="fn-inline-1"');
		expect(output).toContain('<ol class="footnotes">');
		expect(output).toContain("This is inline content");
	});

	test("inline and label footnotes coexist in same document", async () => {
		const processor = makeProcessor(fixtureRoot);
		const file = await processor.process({
			value:
				"Label[^lbl] and inline^[Inline text] together.\n\n[^lbl]: Label def.",
			path: path.resolve(fixtureRoot, "index.md"),
		});
		const output = String(file);
		expect(output).toContain('id="fnref-lbl"');
		expect(output).toContain('id="fnref-inline-1"');
		expect(output).toContain('id="fn-lbl"');
		expect(output).toContain('id="fn-inline-1"');
	});
});

describe("nested tag linking", () => {
	test("rewrites nested #parent/child tag into a link", async () => {
		const processor = makeProcessor(fixtureRoot, { enableTagLinking: true });
		const file = await processor.process({
			value: "See #parent/child here.",
			path: path.resolve(fixtureRoot, "index.md"),
		});
		expect(String(file)).toContain("[#parent/child](/tags/parent/child)");
	});

	test("rewrites deeply nested #a/b/c tag", async () => {
		const processor = makeProcessor(fixtureRoot, { enableTagLinking: true });
		const file = await processor.process({
			value: "Topic #a/b/c nested.",
			path: path.resolve(fixtureRoot, "index.md"),
		});
		expect(String(file)).toContain("[#a/b/c](/tags/a/b/c)");
	});

	test("does not match URL fragments as nested tags", async () => {
		const processor = makeProcessor(fixtureRoot, { enableTagLinking: true });
		const file = await processor.process({
			value: "See https://example.com/page#section/sub for details.",
			path: path.resolve(fixtureRoot, "index.md"),
		});
		expect(String(file)).not.toContain("/tags/section");
	});
});

describe("unicode tag linking", () => {
	test("rewrites Latin extended tags (accented chars)", async () => {
		const processor = makeProcessor(fixtureRoot, { enableTagLinking: true });
		const file = await processor.process({
			value: "Tag #résumé here.",
			path: path.resolve(fixtureRoot, "index.md"),
		});
		expect(String(file)).toContain("/tags/r");
		expect(String(file)).toContain("sum");
	});

	test("rewrites CJK unicode tags", async () => {
		const processor = makeProcessor(fixtureRoot, { enableTagLinking: true });
		const file = await processor.process({
			value: "Tag #中文 here.",
			path: path.resolve(fixtureRoot, "index.md"),
		});
		expect(String(file)).toContain("/tags/中文");
	});
});

describe("cssclasses wrapper", () => {
	test("wraps page content in classed div when cssclasses are set", async () => {
		const processor = makeProcessor(cssclassesFixtureRoot);
		const file = await processor.process({
			value: "Content here.",
			path: path.resolve(cssclassesFixtureRoot, "guide/styled.md"),
		});
		const output = String(file);
		expect(output).toContain('<div class="custom-layout dark-theme">');
		expect(output).toContain("Content here.");
		expect(output).toContain("</div>");
	});

	test("does not inject wrapper when cssclasses is empty", async () => {
		const processor = makeProcessor(cssclassesFixtureRoot);
		const file = await processor.process({
			value: "Plain content.",
			path: path.resolve(cssclassesFixtureRoot, "index.md"),
		});
		const output = String(file);
		expect(output).not.toContain('<div class="');
		expect(output).toContain("Plain content.");
	});
});

describe("callout type coverage", () => {
	test("renders todo callout type", async () => {
		const processor = makeProcessor(fixtureRoot, { enableCallouts: true });
		const file = await processor.process({
			value: "> [!todo] My Task\n> Do the thing",
			path: path.resolve(fixtureRoot, "index.md"),
		});
		expect(String(file)).toContain("callout-todo");
	});

	test("maps hint alias to tip", async () => {
		const processor = makeProcessor(fixtureRoot, { enableCallouts: true });
		const file = await processor.process({
			value: "> [!hint] A Hint\n> Body",
			path: path.resolve(fixtureRoot, "index.md"),
		});
		expect(String(file)).toContain("callout-tip");
	});

	test("maps important alias to tip", async () => {
		const processor = makeProcessor(fixtureRoot, { enableCallouts: true });
		const file = await processor.process({
			value: "> [!important] Important\n> Body",
			path: path.resolve(fixtureRoot, "index.md"),
		});
		expect(String(file)).toContain("callout-tip");
	});

	test("maps error alias to danger", async () => {
		const processor = makeProcessor(fixtureRoot, { enableCallouts: true });
		const file = await processor.process({
			value: "> [!error] An Error\n> Body",
			path: path.resolve(fixtureRoot, "index.md"),
		});
		expect(String(file)).toContain("callout-danger");
	});

	test("maps cite alias to quote", async () => {
		const processor = makeProcessor(fixtureRoot, { enableCallouts: true });
		const file = await processor.process({
			value: "> [!cite] Citation\n> Body",
			path: path.resolve(fixtureRoot, "index.md"),
		});
		expect(String(file)).toContain("callout-quote");
	});
});

describe("nested tag indexing", () => {
	test("indexes the full nested tag path in page.tags", async () => {
		const index = await buildContentIndex(nestedTagsFixtureRoot);
		const page = index.byPathKey.get("guide/nested");
		expect(page?.tags).toContain("frontend/react");
		expect(page?.tags).toContain("tools/bun");
	});

	test("aggregates pages into parent tag segment in byTag", async () => {
		const index = await buildContentIndex(nestedTagsFixtureRoot);
		const frontendPages = index.byTag.get("frontend");
		expect(frontendPages?.some((p) => p.pathKey === "guide/nested")).toBe(true);
	});

	test("aggregates pages into tools parent segment", async () => {
		const index = await buildContentIndex(nestedTagsFixtureRoot);
		const toolsPages = index.byTag.get("tools");
		expect(toolsPages?.some((p) => p.pathKey === "guide/nested")).toBe(true);
	});
});

describe("nested tag pages", () => {
	test("generates page for full nested tag path", async () => {
		const { generateTagPages } = await import("../src/tag-pages");
		const index = await buildContentIndex(nestedTagsFixtureRoot);
		const pages = generateTagPages(index);
		const routes = pages.map((p) => p.routePath);
		expect(routes).toContain("/tags/frontend/react");
		expect(routes).toContain("/tags/tools/bun");
	});

	test("generates parent tag page that aggregates child-tagged pages", async () => {
		const { generateTagPages } = await import("../src/tag-pages");
		const index = await buildContentIndex(nestedTagsFixtureRoot);
		const pages = generateTagPages(index);
		const frontendPage = pages.find((p) => p.routePath === "/tags/frontend");
		expect(frontendPage).toBeDefined();
		expect(frontendPage?.content).toContain("Nested Tags");
	});
});

describe("tag path URL encoding", () => {
	test("encodes whitespace in tag names", async () => {
		const { encodeTagPathSegment } = await import("../src/tag-pages");
		expect(encodeTagPathSegment("hello world")).toBe("hello%20world");
	});

	test("encodes HTML-reserved characters", async () => {
		const { encodeTagPathSegment } = await import("../src/tag-pages");
		expect(encodeTagPathSegment("a&b")).toBe("a%26b");
		expect(encodeTagPathSegment('a"b')).toBe("a%22b");
		expect(encodeTagPathSegment("a<b>c")).toBe("a%3Cb%3Ec");
	});

	test("encodes URL-reserved characters", async () => {
		const { encodeTagPathSegment } = await import("../src/tag-pages");
		expect(encodeTagPathSegment("a#b")).toBe("a%23b");
		expect(encodeTagPathSegment("a?b")).toBe("a%3Fb");
		expect(encodeTagPathSegment("a%b")).toBe("a%25b");
	});

	test("preserves Unicode letters unencoded", async () => {
		const { encodeTagPathSegment } = await import("../src/tag-pages");
		expect(encodeTagPathSegment("中文")).toBe("中文");
		expect(encodeTagPathSegment("café")).toBe("café");
		expect(encodeTagPathSegment("日本語")).toBe("日本語");
	});

	test("preserves nested tag separators", async () => {
		const { encodeTagPathSegment } = await import("../src/tag-pages");
		expect(encodeTagPathSegment("parent/child")).toBe("parent/child");
		expect(encodeTagPathSegment("a/b/c")).toBe("a/b/c");
	});

	test("preserves hyphens, underscores, and digits", async () => {
		const { encodeTagPathSegment } = await import("../src/tag-pages");
		expect(encodeTagPathSegment("my-tag_v2")).toBe("my-tag_v2");
	});
});
