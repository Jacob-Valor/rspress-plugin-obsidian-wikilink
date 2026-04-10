import { describe, test } from "bun:test";
import path from "node:path";
import { buildContentIndex, getCachedContentIndex } from "../src/content-index";
import { findWikilinkMatches, parseWikiLink } from "../src/parse-wikilink";
import { resolveWikiLink } from "../src/resolve-wikilink";

const fixtureRoot = path.resolve(process.cwd(), "tests/fixtures/basic");

const SAMPLE_CONTENT = `
# Welcome

This is a test document with various wikilinks:

- Basic link: [[getting-started]]
- With alias: [[getting-started|Installation]]
- Heading link: [[advanced#Configuration]]
- Block ref: [[guide/getting-started#^install-step]]
- Embed: ![[getting-started]]

And some more links:
- [[api]]
- [[guide/advanced]]
- [[#FAQ]]

Keep linking: [[another-page]] [[third-page]] [[fourth]] [[fifth]]
`.repeat(10);

describe("parse-wikilink benchmarks", () => {
	test("findWikilinkMatches - 100 wikilinks", () => {
		const start = performance.now();
		for (let i = 0; i < 1000; i++) {
			findWikilinkMatches(SAMPLE_CONTENT);
		}
		const duration = performance.now() - start;
		console.log(
			`  findWikilinkMatches: ${duration.toFixed(2)}ms for 1000 iterations`,
		);
	});

	test("parseWikiLink - single link", () => {
		const start = performance.now();
		for (let i = 0; i < 10000; i++) {
			parseWikiLink(
				"guide/getting-started#Install|Install guide",
				"[[guide/getting-started#Install|Install guide]]",
			);
		}
		const duration = performance.now() - start;
		console.log(
			`  parseWikiLink: ${duration.toFixed(2)}ms for 10000 iterations`,
		);
	});

	test("parseWikiLink - 100 links", () => {
		const matches = findWikilinkMatches(SAMPLE_CONTENT);
		const start = performance.now();
		for (let i = 0; i < 1000; i++) {
			for (const match of matches) {
				parseWikiLink(match.inner, match.fullMatch);
			}
		}
		const duration = performance.now() - start;
		console.log(
			`  parseWikiLink 100 links: ${duration.toFixed(2)}ms for 1000 iterations`,
		);
	});
});

describe("content-index benchmarks", () => {
	test("buildContentIndex - basic fixture", async () => {
		const start = performance.now();
		await buildContentIndex(fixtureRoot);
		const duration = performance.now() - start;
		console.log(`  buildContentIndex: ${duration.toFixed(2)}ms`);
	});

	test("getCachedContentIndex - cached", async () => {
		await buildContentIndex(fixtureRoot);
		const start = performance.now();
		for (let i = 0; i < 1000; i++) {
			await getCachedContentIndex(fixtureRoot);
		}
		const duration = performance.now() - start;
		console.log(
			`  getCachedContentIndex (cached): ${duration.toFixed(2)}ms for 1000 iterations`,
		);
	});

	test("resolveWikiLink - exact path", async () => {
		const index = await buildContentIndex(fixtureRoot);
		const page = index.byPathKey.get("")!;
		const start = performance.now();
		for (let i = 0; i < 10000; i++) {
			resolveWikiLink(
				parseWikiLink("guide/getting-started", "[[guide/getting-started]]"),
				{ currentPage: page, index },
			);
		}
		const duration = performance.now() - start;
		console.log(
			`  resolveWikiLink exact path: ${duration.toFixed(2)}ms for 10000 iterations`,
		);
	});

	test("resolveWikiLink - basename match", async () => {
		const index = await buildContentIndex(fixtureRoot);
		const page = index.byPathKey.get("")!;
		const start = performance.now();
		for (let i = 0; i < 10000; i++) {
			resolveWikiLink(parseWikiLink("getting-started", "[[getting-started]]"), {
				currentPage: page,
				index,
			});
		}
		const duration = performance.now() - start;
		console.log(
			`  resolveWikiLink basename: ${duration.toFixed(2)}ms for 10000 iterations`,
		);
	});

	test("resolveWikiLink - with heading", async () => {
		const index = await buildContentIndex(fixtureRoot);
		const page = index.byPathKey.get("")!;
		const start = performance.now();
		for (let i = 0; i < 10000; i++) {
			resolveWikiLink(
				parseWikiLink(
					"guide/getting-started#Install",
					"[[guide/getting-started#Install]]",
				),
				{ currentPage: page, index },
			);
		}
		const duration = performance.now() - start;
		console.log(
			`  resolveWikiLink with heading: ${duration.toFixed(2)}ms for 10000 iterations`,
		);
	});
});

describe("full pipeline benchmarks", () => {
	test("full pipeline - 100 wikilinks", async () => {
		const index = await buildContentIndex(fixtureRoot);
		const page = index.byPathKey.get("")!;
		const matches = findWikilinkMatches(SAMPLE_CONTENT);

		const start = performance.now();
		for (let i = 0; i < 1000; i++) {
			for (const match of matches) {
				const parsed = parseWikiLink(match.inner, match.fullMatch);
				resolveWikiLink(parsed, {
					currentPage: page,
					index,
				});
			}
		}
		const duration = performance.now() - start;
		console.log(
			`  full pipeline 100 wikilinks: ${duration.toFixed(2)}ms for 1000 iterations`,
		);
	});
});
