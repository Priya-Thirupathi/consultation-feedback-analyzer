// Server-internal shapes. The public contract lives in shared/api.ts.

export interface Comment {
  id: string;
  text: string;
  org?: string | null;
}

/** What the extractor decides about one chunk. */
export interface Verdict {
  substantive: boolean;
  theme: string | null;
  key_point: string;
}

export type Extracted = Comment & Verdict;
