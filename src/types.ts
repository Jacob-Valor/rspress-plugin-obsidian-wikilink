export type DiagnosticMode = "error" | "warn";

export interface RspressPluginObsidianWikiLinkOptions {
  onBrokenLink?: DiagnosticMode;
  onAmbiguousLink?: DiagnosticMode;
}

export interface NormalizedPluginOptions {
  onBrokenLink: DiagnosticMode;
  onAmbiguousLink: DiagnosticMode;
}

export interface ParsedWikiLink {
  raw: string;
  target: string;
  anchor?: string;
  alias?: string;
  isCurrentPageAnchor: boolean;
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

export interface ContentPage {
  absolutePath: string;
  relativePath: string;
  routePath: string;
  pathKey: string;
  baseName: string;
  headings: HeadingEntry[];
}

export interface ContentIndex {
  rootDir: string;
  pages: ContentPage[];
  byAbsolutePath: Map<string, ContentPage>;
  byPathKey: Map<string, ContentPage>;
  byBaseName: Map<string, ContentPage[]>;
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
}

export function normalizePluginOptions(
  options: RspressPluginObsidianWikiLinkOptions = {},
): NormalizedPluginOptions {
  return {
    onBrokenLink: options.onBrokenLink ?? "error",
    onAmbiguousLink: options.onAmbiguousLink ?? "error",
  };
}
