import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";

const DOC_BUILD = path.resolve(import.meta.dir, "../doc_build");
const GUIDE_DIR = path.join(DOC_BUILD, "guide");
const TAGS_DIR = path.join(DOC_BUILD, "tags");

// Skip by default — run manually with `bun test --run` or remove `.skip`
// to verify the full Rspress build pipeline end-to-end.
describe.skip("rspress build integration", () => {
	test("build output directory exists with expected pages", () => {
		expect(fs.existsSync(DOC_BUILD)).toBe(true);
		expect(fs.existsSync(GUIDE_DIR)).toBe(true);
		expect(fs.existsSync(TAGS_DIR)).toBe(true);
	});

	test("index page has resolved wikilinks", () => {
		const html = fs.readFileSync(path.join(DOC_BUILD, "index.html"), "utf-8");
		expect(html).toContain("/guide/getting-started");
		expect(html).toContain("/guide/examples");
	});

	test("guide pages have resolved heading anchors", () => {
		const html = fs.readFileSync(
			path.join(GUIDE_DIR, "getting-started.html"),
			"utf-8",
		);
		expect(html).toContain('href="#install"');
	});

	test("backlinks panel is rendered", () => {
		const html = fs.readFileSync(
			path.join(GUIDE_DIR, "advanced.html"),
			"utf-8",
		);
		expect(html).toContain('class="obsidian-backlinks"');
	});

	test("callouts are transformed to styled divs", () => {
		const html = fs.readFileSync(
			path.join(GUIDE_DIR, "getting-started.html"),
			"utf-8",
		);
		expect(html).toContain('class="callout callout-tip"');
	});

	test("transclusion is rendered", () => {
		const html = fs.readFileSync(
			path.join(GUIDE_DIR, "examples.html"),
			"utf-8",
		);
		expect(html).toContain('class="obsidian-transclusion"');
	});

	test("tag pages are generated", () => {
		expect(fs.existsSync(path.join(TAGS_DIR, "demo.html"))).toBe(true);
		expect(fs.existsSync(path.join(TAGS_DIR, "examples.html"))).toBe(true);
	});

	test("generated tag page lists linked pages", () => {
		const html = fs.readFileSync(path.join(TAGS_DIR, "demo.html"), "utf-8");
		expect(html).toContain("/guide/examples");
	});

	test("highlights are transformed to mark tags", () => {
		const html = fs.readFileSync(
			path.join(GUIDE_DIR, "examples.html"),
			"utf-8",
		);
		expect(html).toContain("<mark>");
	});

	test("footnotes are rendered", () => {
		const html = fs.readFileSync(
			path.join(GUIDE_DIR, "getting-started.html"),
			"utf-8",
		);
		expect(html).toContain('class="footnote-ref"');
	});
});
