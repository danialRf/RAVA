export interface VerifiedContentFacts {
  readonly title: string;
  readonly sourceName: string | null;
}

export interface ContentRenderer {
  render(facts: VerifiedContentFacts): string;
}
