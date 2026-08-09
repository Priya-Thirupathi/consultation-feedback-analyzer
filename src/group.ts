// Grouping and ranking. Takes comments that already have a theme label and
// groups them by that label, counts how many comments fall under each, and
// returns the top themes ranked by count with one sample comment each.

import type { Extracted } from "./types.ts";
import type { Theme } from "../shared/api.ts";

// Words that carry no signal when matching a chunk against a theme label.
const STOP = new Set(["and", "the", "for", "with", "are", "its", "that", "this", "from"]);

const tokens = (s: unknown): string[] =>
  (String(s ?? "").toLowerCase().match(/[a-z]+/g) ?? []).filter(
    (t) => t.length > 2 && !STOP.has(t)
  );

// Page furniture the chunker leaves on the front of a chunk: running headers,
// list numbering, roman numeral footnote markers.
const FURNITURE = /^\s*(?:page\s+\d+\s+of\s+\d+|\d+\s*[.)]|[ivxlcdm]+\s*[.)])/i;

// Opening on a lowercase word means the chunk was cut mid sentence.
const MID_SENTENCE = /^\s*[a-z]/;

function trimToSentence(text: string, max = 320): string {
  const clean = String(text ?? "").replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;

  const cut = clean.slice(0, max);
  const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "), cut.lastIndexOf("! "));
  // Only honour a sentence break in the back half, otherwise a single early
  // full stop would leave a uselessly short quote.
  const trimmed = stop > max * 0.5 ? cut.slice(0, stop + 1) : `${cut.trimEnd()}…`;

  // Cutting inside an enumerated list strands its next marker on the end, as in
  // "...positive customer experience. ii." Drop a trailing orphan marker.
  return trimmed.replace(/\s+(?:[ivxlcdm]{1,4}|\d{1,2})[.)]\s*$/i, "");
}

// Choose the comment shown as a theme's example. Taking the first one in the
// bucket means whatever happened to sit earliest in the file wins, which is how
// a page of citations ended up representing "Regulatory framework". Prefer the
// chunk that actually restates the theme, and that a judge will read.
function pickSample(comments: Extracted[], theme: string): string {
  const want = new Set(tokens(theme));

  let best = comments[0];
  let bestScore = -Infinity;

  for (const c of comments) {
    const text = String(c.text ?? "");
    const have = new Set(tokens(`${c.key_point || ""} ${text}`));
    let overlap = 0;
    for (const w of want) if (have.has(w)) overlap++;

    // Divide by the theme length, not the comment length, so a long chunk
    // cannot win simply by containing more words. Caps keyword score at 1.0.
    let score = want.size ? overlap / want.size : 0;

    // Both exceed the maximum keyword score on purpose, so a broken chunk can
    // only win when every chunk in the bucket is broken.
    if (FURNITURE.test(text)) score -= 1.5;
    if (MID_SENTENCE.test(text)) score -= 1.2;

    // Ramp the length penalty rather than stepping it, so a theme whose chunks
    // are all long still gets its least bad one.
    if (text.length < 120) score -= 0.4;
    if (text.length > 400) score -= Math.min(1.0, (text.length - 400) / 900);

    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return trimToSentence(best?.text ?? "");
}

interface Bucket {
  theme: string;
  comments: Extracted[];
}

export function groupAndRank(extracted: Extracted[], topN = 10): Theme[] {
  const buckets = new Map<string, Bucket>();

  // Chunks the extractor judged non substantive never become a theme. They are
  // still counted by the caller so the totals stay honest.
  for (const c of extracted) {
    if (c.substantive === false || !c.theme) continue;

    const key = c.theme.toLowerCase().trim();
    const bucket = buckets.get(key) ?? { theme: c.theme, comments: [] };
    if (!buckets.has(key)) buckets.set(key, bucket);
    bucket.comments.push(c);
  }

  // Rank by breadth of support, not volume of text: chunk counts reward whoever
  // wrote the longest submission. Falls back to chunks with no org column.
  const hasOrgs = extracted.some((c) => c.org);

  return [...buckets.values()]
    .map((b) => ({
      ...b,
      orgs: [...new Set(b.comments.map((c) => c.org).filter((o): o is string => Boolean(o)))].sort(),
    }))
    .sort((a, b) =>
      hasOrgs && b.orgs.length !== a.orgs.length
        ? b.orgs.length - a.orgs.length
        : b.comments.length - a.comments.length
    )
    .slice(0, topN)
    .map((b, i) => ({
      rank: i + 1,
      theme: b.theme,
      chunks: b.comments.length,
      organisations: hasOrgs ? b.orgs.length : null,
      orgNames: hasOrgs ? b.orgs : [],
      sample: pickSample(b.comments, b.theme),
      // Every row behind the count, so the analyst can check the grouping
      // against her own file instead of taking the ranking on faith. Text is
      // sent as uploaded: the sample is trimmed for reading, evidence is not.
      evidence: b.comments.map((c) => ({
        id: c.id,
        org: c.org ?? null,
        text: String(c.text ?? ""),
      })),
    }));
}
