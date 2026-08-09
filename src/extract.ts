// Theme extraction. Reads comments and returns a short theme label plus a one
// line key point for each. Keep the prompts tight so the output is consistent
// and easy to group later.
//
// Comments go out in batches. On the free tier the binding constraint is
// requests per minute, not tokens, so one request carrying ten comments is ten
// times the throughput of ten requests carrying one. Parallelising instead
// would not help at all: the limit counts requests, so twelve in flight at once
// still only buys twelve per minute, just with more 429s. Set
// GEMINI_BATCH_SIZE=1 to go back to one comment per request.

import { generateJson } from "./gemini.ts";
import type { Comment, Verdict } from "./types.ts";

// Real submissions arrive as PDF text split into chunks, so a good share of any
// chunk list is not argument at all: respondents quote the consultation's own
// questions before answering, and the chunker happily turns footnotes, member
// rosters and "thank you for the opportunity" into standalone rows. Those must
// not become themes. The model is already reading every chunk, so ask it while
// it is there rather than filtering afterwards on phrases that would only ever
// match this one docket.
const SUBSTANCE = `First decide whether the comment states a position at all.
Set "substantive": false, with theme and key_point null, when the text is:
- a restatement or quotation of the consultation's own question
- a citation, footnote, reference list, URL or page header
- a list of member companies or other organisational boilerplate
- a salutation, thanks, or a note that the writer welcomes the chance to comment
Set "substantive": true whenever the text argues for or against something, makes
a recommendation, or describes a concern or benefit. A position that is brief or
broadly worded is still a position, so do not filter it out for being short.`;

const SINGLE = `You read one public consultation comment and identify its main theme.
${SUBSTANCE}
Return ONLY JSON with this shape:
{"substantive": true or false, "theme": "<short 2 to 5 word label>", "key_point": "<one plain sentence>"}
Rules:
- The theme label must be reusable across comments that make the same point.
- Do not add any text outside the JSON.`;

const BATCHED = `You read public consultation comments and identify the main theme of each.
${SUBSTANCE}
Return ONLY a JSON array with one object per comment, in the same order as the input:
[{"id": "<the id you were given>", "substantive": true or false, "theme": "<short 2 to 5 word label>", "key_point": "<one plain sentence>"}]
Rules:
- Judge each comment on its own. Do not let one comment influence another's theme.
- The theme label must be reusable across comments that make the same point.
- Return exactly one object per input comment, no more and no fewer, and reuse
  the id you were given so each result can be matched back.
- Do not add any text outside the JSON.`;

/** What the model is asked to return. Every field is suspect until checked. */
interface RawVerdict {
  id?: unknown;
  substantive?: unknown;
  theme?: unknown;
  key_point?: unknown;
}

// Turn one model verdict into the shape the rest of the pipeline expects.
// A gated out chunk keeps its text so it can still be counted and shown, it
// just carries no theme.
function toResult(verdict: RawVerdict | undefined): Verdict {
  if (verdict?.substantive === false) {
    return { substantive: false, theme: null, key_point: "" };
  }
  return {
    substantive: true,
    theme: typeof verdict?.theme === "string" ? verdict.theme : null,
    key_point: typeof verdict?.key_point === "string" ? verdict.key_point : "",
  };
}

export async function extractTheme(commentText: string): Promise<Verdict> {
  try {
    const parsed = await generateJson<RawVerdict>(`${SINGLE}\n\nComment:\n${commentText}`, {
      label: "extract",
    });
    if (parsed?.substantive !== false && !parsed?.theme) {
      throw new Error("no theme in response");
    }
    return toResult(parsed);
  } catch {
    // Fallback so one bad response does not crash a whole batch. Treated as
    // substantive on purpose: a parse failure is our problem, and silently
    // dropping a real comment is worse than showing it as uncategorized.
    return {
      substantive: true,
      theme: "uncategorized",
      key_point: commentText.slice(0, 120),
    };
  }
}

async function extractOne<T extends Comment>(c: T): Promise<T & Verdict> {
  return { ...c, ...(await extractTheme(c.text)) };
}

async function extractBatch<T extends Comment>(batch: T[]): Promise<(T & Verdict)[]> {
  const payload = batch.map((c) => ({ id: String(c.id), comment: c.text }));

  const byId = new Map<string, RawVerdict>();
  try {
    const parsed = await generateJson<unknown>(
      `${BATCHED}\n\nComments:\n${JSON.stringify(payload)}`,
      { label: "extract" }
    );
    if (!Array.isArray(parsed)) throw new Error("response was not a JSON array");
    for (const r of parsed as RawVerdict[]) if (r?.id != null) byId.set(String(r.id), r);
  } catch (e: unknown) {
    // A malformed batch would silently lose every comment in it, so drop to the
    // one at a time path for this batch instead of returning junk.
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[extract] batch failed (${msg}), falling back to one at a time`);
  }

  const out: (T & Verdict)[] = [];
  for (const c of batch) {
    const hit = byId.get(String(c.id));
    // Test for a verdict, not for a theme. A gated out chunk legitimately has
    // no theme, and asking for it again one at a time would just spend another
    // request to be told the same thing. Only a genuinely missing id, meaning
    // the model skipped that comment, earns the fallback.
    const gated = hit?.substantive === false;
    out.push(gated || hit?.theme ? { ...c, ...toResult(hit) } : await extractOne(c));
  }
  return out;
}

export interface ExtractOptions {
  onProgress?: (done: number, total: number) => void;
}

// Generic over the comment type so callers keep their own extra fields: the
// benchmark passes rows carrying `expected` and gets them back intact.
export async function extractAll<T extends Comment>(
  comments: T[],
  { onProgress }: ExtractOptions = {}
): Promise<(T & Verdict)[]> {
  const size = Math.max(1, Number(process.env.GEMINI_BATCH_SIZE || 10));
  const out: (T & Verdict)[] = [];

  for (let i = 0; i < comments.length; i += size) {
    const batch = comments.slice(i, i + size);
    const first = batch[0];
    if (size === 1 && first) out.push(await extractOne(first));
    else out.push(...(await extractBatch(batch)));
    onProgress?.(out.length, comments.length);
  }
  return out;
}
