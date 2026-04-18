#!/usr/bin/env bun
// Cross-platform build: replaces the non-portable `cp` shell command used
// before. Runs via `bun run build` or directly with `bun scripts/build.ts`.
import fs from "node:fs";
import path from "node:path";
import { $ } from "bun";

const ROOT = path.resolve(import.meta.dir, "..");
const DIST = path.join(ROOT, "dist");
const STATIC_ASSETS: ReadonlyArray<string> = ["styles.css"];

async function clean(): Promise<void> {
	fs.rmSync(DIST, { recursive: true, force: true });
	console.log("  cleaned  dist/");
}

async function compile(): Promise<void> {
	await $`bunx tsc -p tsconfig.build.json`.cwd(ROOT);
	console.log("  compiled TypeScript → dist/");
}

async function copyAssets(): Promise<void> {
	for (const asset of STATIC_ASSETS) {
		const src = path.join(ROOT, "src", asset);
		const dest = path.join(DIST, asset);

		if (!fs.existsSync(src)) {
			throw new Error(`Expected asset not found: src/${asset}`);
		}

		await Bun.write(dest, Bun.file(src));
		console.log(`  copied   src/${asset} → dist/${asset}`);
	}
}

async function main(): Promise<void> {
	const started = Date.now();
	console.log("Building rspress-plugin-obsidian-wikilink…");

	await clean();
	await compile();
	await copyAssets();

	const elapsed = ((Date.now() - started) / 1000).toFixed(2);
	console.log(`✓ Build complete in ${elapsed}s`);
}

try {
	await main();
} catch (error) {
	console.error("✗ Build failed:", error);
	process.exit(1);
}
