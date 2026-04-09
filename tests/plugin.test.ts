import path from "node:path";
import { describe, expect, test } from "bun:test";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { buildContentIndex, getCachedContentIndex } from "../src/content-index";
import { findWikilinkMatches, parseWikiLink } from "../src/parse-wikilink";
import { remarkWikilink } from "../src/remark-wikilink";
import { resolveWikiLink } from "../src/resolve-wikilink";

const fixtureRoot = path.resolve(process.cwd(), "tests/fixtures/basic");
const strictFixtureRoot = path.resolve(process.cwd(), "tests/fixtures/strict");
const headingFixtureRoot = path.resolve(process.cwd(), "tests/fixtures/headings");

describe("parseWikiLink", () => {
  test("parses alias and anchor", () => {
    const parsed = parseWikiLink("guide/getting-started#Install|Install guide", "[[guide/getting-started#Install|Install guide]]");

    expect(parsed).toEqual({
      raw: "[[guide/getting-started#Install|Install guide]]",
      target: "guide/getting-started",
      anchor: "Install",
      alias: "Install guide",
      isCurrentPageAnchor: false,
    });
  });

  test("finds non-embed wikilinks only", () => {
    const matches = findWikilinkMatches("See [[Page]] but ignore ![[Embed]]");

    expect(matches).toHaveLength(1);
    expect(matches[0]?.fullMatch).toBe("[[Page]]");
  });
});

describe("buildContentIndex", () => {
  test("indexes pages and headings", () => {
    const index = buildContentIndex(fixtureRoot);
    const page = index.byPathKey.get("guide/getting-started");

    expect(page?.routePath).toBe("/guide/getting-started");
    expect(page?.headings.map((heading) => heading.slug)).toContain("install");
  });

  test("caches repeated content-index reads when files are unchanged", () => {
    const first = getCachedContentIndex(fixtureRoot);
    const second = getCachedContentIndex(fixtureRoot);

    expect(second).toBe(first);
  });

  test("extracts setext, spaced atx, and explicit heading ids", () => {
    const index = buildContentIndex(headingFixtureRoot);
    const page = index.byPathKey.get("guide/variants");

    expect(page?.headings).toEqual([
      { rawText: "Variants", slug: "variants" },
      { rawText: "Named Setext", slug: "named-setext", explicitId: "custom-setext" },
      { rawText: "Spaced ATX Heading", slug: "spaced-atx-heading" },
      { rawText: "Custom Anchor", slug: "custom-anchor", explicitId: "custom-anchor" },
    ]);
  });
});

describe("resolveWikiLink", () => {
  test("resolves exact path links", () => {
    const index = buildContentIndex(fixtureRoot);
    const currentPage = index.byPathKey.get("")!;

    const result = resolveWikiLink(parseWikiLink("guide/getting-started", "[[guide/getting-started]]"), {
      currentPage,
      index,
    });

    expect(result).toMatchObject({
      status: "ok",
      href: "/guide/getting-started",
      label: "getting started",
    });
  });

  test("resolves basename links when unique", () => {
    const index = buildContentIndex(fixtureRoot);
    const currentPage = index.byPathKey.get("")!;

    const result = resolveWikiLink(parseWikiLink("advanced#Advanced Usage", "[[advanced#Advanced Usage]]"), {
      currentPage,
      index,
    });

    expect(result).toMatchObject({
      status: "ok",
      href: "/guide/advanced#advanced-usage",
      label: "Advanced Usage",
    });
  });

  test("reports ambiguous basename links", () => {
    const index = buildContentIndex(path.resolve(process.cwd(), "tests/fixtures/ambiguous"));
    const currentPage = index.byPathKey.get("")!;

    const result = resolveWikiLink(parseWikiLink("getting-started", "[[getting-started]]"), {
      currentPage,
      index,
    });

    expect(result.status).toBe("ambiguous-page");
  });

  test("reports broken anchors", () => {
    const index = buildContentIndex(fixtureRoot);
    const currentPage = index.byPathKey.get("")!;

    const result = resolveWikiLink(parseWikiLink("guide/getting-started#Missing", "[[guide/getting-started#Missing]]"), {
      currentPage,
      index,
    });

    expect(result.status).toBe("broken-anchor");
  });

  test("keeps exact path matching strict by case", () => {
    const index = buildContentIndex(strictFixtureRoot);
    const currentPage = index.byPathKey.get("")!;

    const result = resolveWikiLink(parseWikiLink("guide/casesensitive", "[[guide/casesensitive]]"), {
      currentPage,
      index,
    });

    expect(result.status).toBe("broken-page");
  });

  test("rejects malformed empty targets", () => {
    const index = buildContentIndex(fixtureRoot);
    const currentPage = index.byPathKey.get("")!;

    const result = resolveWikiLink(parseWikiLink(" |Alias", "[[ |Alias]]"), {
      currentPage,
      index,
    });

    expect(result.status).toBe("broken-page");
  });

  test("resolves richer heading syntax", () => {
    const index = buildContentIndex(headingFixtureRoot);
    const currentPage = index.byPathKey.get("")!;

    const setextResult = resolveWikiLink(parseWikiLink("guide/variants#Named Setext", "[[guide/variants#Named Setext]]"), {
      currentPage,
      index,
    });
    const spacedAtxResult = resolveWikiLink(parseWikiLink("guide/variants#Spaced ATX Heading", "[[guide/variants#Spaced ATX Heading]]"), {
      currentPage,
      index,
    });
    const explicitIdResult = resolveWikiLink(parseWikiLink("guide/variants#custom-anchor", "[[guide/variants#custom-anchor]]"), {
      currentPage,
      index,
    });

    expect(setextResult).toMatchObject({ status: "ok", href: "/guide/variants#custom-setext" });
    expect(spacedAtxResult).toMatchObject({ status: "ok", href: "/guide/variants#spaced-atx-heading" });
    expect(explicitIdResult).toMatchObject({ status: "ok", href: "/guide/variants#custom-anchor" });
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
        },
      })
      .use(remarkStringify);

    const file = await processor.process({
      value: "Go to [[guide/getting-started#Install|Install guide]].",
      path: path.resolve(fixtureRoot, "index.md"),
    });

    expect(String(file)).toBe("Go to [Install guide](/guide/getting-started#install).\n");
  });

  test("supports current-page anchors", async () => {
    const processor = unified()
      .use(remarkParse)
      .use(remarkWikilink, {
        getDocsRoot: () => fixtureRoot,
        options: {
          onBrokenLink: "error",
          onAmbiguousLink: "error",
        },
      })
      .use(remarkStringify);

    const file = await processor.process({
      value: "Jump to [[#Overview]].",
      path: path.resolve(fixtureRoot, "index.md"),
    });

    expect(String(file)).toBe("Jump to [Overview](#overview).\n");
  });
});
