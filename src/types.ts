export type DiagnosticMode = "error" | "warn";

export interface RspressPluginObsidianWikiLinkOptions {
	onBrokenLink?: DiagnosticMode;
	onAmbiguousLink?: DiagnosticMode;
	enableFuzzyMatching?: boolean;
}

export interface NormalizedPluginOptions {
	onBrokenLink: DiagnosticMode;
	onAmbiguousLink: DiagnosticMode;
	enableFuzzyMatching: boolean;
}

export interface WikiSubpath {
	kind: "heading" | "block";
	value: string;
}

export interface ParsedWikiLink {
	raw: string;
	target: string;
	alias?: string;
	isEmbed: boolean;
	subpath?: WikiSubpath;
	isCurrentPageReference: boolean;
}

export interface WikilinkMatch {
	fullMatch: string;
	inner: string;
	start: number;
	end: number;
}

export interface HeadingEntry {
	rawText: string;
	slug: string;
	explicitId?: string;
}

export interface BlockEntry {
	id: string;
}

export interface ContentPage {
	absolutePath: string;
	relativePath: string;
	routePath: string;
	pathKey: string;
	baseName: string;
	title?: string;
	aliases: string[];
	headings: HeadingEntry[];
	blocks: BlockEntry[];
}

export interface ContentIndex {
	rootDir: string;
	pages: ContentPage[];
	byAbsolutePath: Map<string, ContentPage>;
	byPathKey: Map<string, ContentPage>;
	byBaseName: Map<string, ContentPage[]>;
	byTitle: Map<string, ContentPage[]>;
	byAlias: Map<string, ContentPage[]>;
}

export type ResolveStatus =
	| "ok"
	| "broken-page"
	| "broken-anchor"
	| "ambiguous-page";

export interface ResolvedWikiLink {
	status: ResolveStatus;
	href?: string;
	label?: string;
	targetPage?: ContentPage;
	message?: string;
}

export interface ResolveContext {
	currentPage: ContentPage;
	index: ContentIndex;
	options?: Pick<NormalizedPluginOptions, "enableFuzzyMatching">;
}

export interface RemarkWikiLinkPluginOptions {
	getDocsRoot: () => string;
	options: NormalizedPluginOptions;
}
