// Consolidation pass. The per comment extraction gives each comment its own
// theme label, so synonyms like "worker safety" and "worker welfare support"
// stay separate. Here we collect all the distinct labels, ask Gemini once to
// merge them into a small canonical set, and rewrite each comment to its
// canonical theme so grouping actually merges them.
//
// This scales: a thousand comments might only produce a couple hundred distinct
// labels, so this is one cheap call regardless of comment count.

import { generateJson } from "./gemini.ts";
import type { Verdict } from "./types.ts";

const SYSTEM = `You are given theme labels extracted from public comments. Each label
comes with one or two example points taken from the comments it was drawn from.
Many labels mean the same thing in different words. Merge them into a small set
of canonical themes.
Judge by the example points, not by the wording of the label. Labels whose points
argue the same thing are one theme even when the labels read quite differently.
For instance "Risk-based regulation" and "Regulatory proportionality" look like
two labels but are one argument if both points say obligations should scale with
the level of harm.
Return ONLY JSON of this shape, mapping every input label to its canonical theme:
{"<input label>": "<canonical theme>", ...}
Rules:
- Labels that express the same concern must map to the exact same canonical theme.
- Aim for a tight set of themes, usually 3 to 8 for a focused consultation.
- Canonical themes should be short and neutral, 2 to 5 words.
- Keep genuinely different concerns separate. Do not collapse them into a vague
  umbrella like "Economic impact" or "General concerns". For example cost to
  customers and cost to businesses are different concerns and must stay separate.
- Prefer specific, actionable theme names over broad abstract ones.
- Every input label must appear as a key. No text outside the JSON.`;

export async function consolidateThemes<T extends Verdict>(extracted: T[]): Promise<T[]> {
  // Carry each label's example points into the merge. On their own, "Risk-based
  // regulation" and "Context-specific regulation" read as two different things,
  // so they survived as separate themes even when they came from one paragraph
  // making one argument. The extractor already wrote a one line point for every
  // comment, so attaching them costs nothing and gives the merge the evidence it
  // needs. Two points per label is enough to show what a label means without
  // bloating the prompt on a large run.
  const examples = new Map<string, string[]>();
  for (const c of extracted) {
    if (!c.theme) continue;
    const points = examples.get(c.theme) ?? [];
    if (!examples.has(c.theme)) examples.set(c.theme, points);
    if (c.key_point && points.length < 2) points.push(c.key_point);
  }

  const labels = [...examples.keys()];

  // Nothing to merge.
  if (labels.length <= 1) return extracted;

  const payload = labels.map((label) => ({ label, points: examples.get(label) }));

  let mapping: Record<string, unknown> = {};
  try {
    mapping = await generateJson<Record<string, unknown>>(
      `${SYSTEM}\n\nLabels:\n${JSON.stringify(payload)}`,
      { label: "consolidate" }
    );
  } catch {
    // If consolidation fails, fall back to the raw labels rather than crashing.
    return extracted;
  }

  // Rewrite each comment to its canonical theme, keeping the original if the
  // model dropped a label from the mapping.
  return extracted.map((c) => {
    const canonical = c.theme ? mapping[c.theme] : null;
    return typeof canonical === "string" ? { ...c, theme: canonical } : c;
  });
}
