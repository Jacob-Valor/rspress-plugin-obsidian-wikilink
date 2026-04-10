export function normalizeFsPath(input: string): string {
	return input.replace(/\\/g, "/");
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
