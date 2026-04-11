export type DiagnosticMode = "error" | "warn";

export interface RspressPluginObsidianWikiLinkOptions {
	onBrokenLink?: DiagnosticMode;
	onAmbiguousLink?: DiagnosticMode;
	enableFuzzyMatching?: boolean;
	enableCaseInsensitiveLookup?: boolean;
	enableTagLinking?: boolean;
	enableCallouts?: boolean;
	enableBacklinks?: boolean;
	enableTransclusion?: boolean;
	enableMediaEmbeds?: boolean;
	/** Auto-generate /tags/{name} index pages for every frontmatter tag. Requires enableTagLinking: true. */
	enableTagPages?: boolean;
	/** Inject the bundled .obsidian-* and .callout-* stylesheet automatically. */
	enableDefaultStyles?: boolean;
}

export interface NormalizedPluginOptions {
	onBrokenLink: DiagnosticMode;
	onAmbiguousLink: DiagnosticMode;
	enableFuzzyMatching: boolean;
	enableCaseInsensitiveLookup: boolean;
	enableTagLinking: boolean;
	enableCallouts: boolean;
	enableBacklinks: boolean;
	enableTransclusion: boolean;
	enableMediaEmbeds: boolean;
	enableTagPages: boolean;
	enableDefaultStyles: boolean;
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
	tags: string[];
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
	byTag: Map<string, ContentPage[]>;
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
	options?: Partial<
		Pick<
			NormalizedPluginOptions,
			"enableFuzzyMatching" | "enableCaseInsensitiveLookup"
		>
	>;
}

export interface RemarkWikiLinkPluginOptions {
	getDocsRoot: () => string;
	options: NormalizedPluginOptions;
}
