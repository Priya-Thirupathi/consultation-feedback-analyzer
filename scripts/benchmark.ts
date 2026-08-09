// Accuracy benchmark. Runs the real pipeline (extract + consolidate) on a hand
// labeled CSV and reports how often the predicted theme matches the human label.
// This produces the credibility number for the demo, for example "92% accuracy".
//
// Usage:
//   node --env-file=.env scripts/benchmark.ts [path-to-labeled-csv]
// Default input: data/labeled_sample.csv
// The CSV needs columns: id, comment, expected_theme
//
// Add a `substantive` column (y/n) when the file contains real boilerplate, as
// any set drawn from actual PDF chunks does. Without it every row is assumed to
// be a real argument, which is true of the toy set and false of anything real:
// roughly two rows in five of a genuine submission are footnotes, quoted
// consultation questions or section headers. Scoring those as themes the gate
// missed marks it wrong for doing its job, so with the column present the gate
// is measured on its own and the theme score is reported beside it, never
// blended into one figure.
//
// Why an LLM judge instead of exact string match:
// Our themes are free text, so the model may say "worker safety" where the human
// wrote "Support for worker insurance". Those mean the same thing. A plain string
// compare would wrongly mark that wrong and understate accuracy. So we ask the
// model to judge whether the predicted theme means the same concern as the label.
// This is standard practice and is honest as long as the judge is strict.

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse/sync";
import { generateJson } from "../src/gemini.ts";
import { extractAll } from "../src/extract.ts";
import { consolidateThemes } from "../src/consolidate.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const inputPath = process.argv[2]
  ? resolve(process.argv[2])
  : resolve(__dirname, "../data/labeled_sample.csv");

/** A labeled row. `expected` rides through extractAll untouched. */
interface LabeledComment {
  id: string;
  text: string;
  expected: string;
  /** What the human says the gate should do with this row. */
  expectSubstantive: boolean;
}

interface Miss {
  text: string;
  expected: string;
  got: string;
}

const yes = (v: string | undefined): boolean => /^\s*(y|yes|true|1)\s*$/i.test(v ?? "");

const preview = (s: string, n = 70): string => `${s.slice(0, n)}...`;

function report(title: string, rows: Miss[]): void {
  if (!rows.length) return;
  console.log(`\n${title}:`);
  for (const m of rows) {
    console.log(`  - "${preview(m.text)}"`);
    console.log(`      expected: ${m.expected}`);
    console.log(`      got:      ${m.got}`);
  }
}

// Ask the model to judge semantic equivalence, returning strict JSON.
// Deliberately one comment per request even though extraction batches: this is
// the number the demo is judged on, and judging each row in isolation is the
// defensible version. A batched judge sees the other rows and drifts toward
// grading on the curve.
async function judge(comment: string, expected: string, predicted: string | null): Promise<boolean> {
  const prompt = `A public comment was assigned a theme by a human and by a system.
Decide if the system theme captures the SAME underlying concern as the human theme
for this comment.
Answer true if they mean the same concern, even when the wording differs or one is
slightly broader or narrower (for example "Enforcement concerns" and "Regulatory
enforcement" are the same, and "Support for worker insurance" and "Worker welfare
and safety" are the same).
Answer false only if the system theme points at a genuinely different concern, or is
so vague it no longer reflects what this specific comment is about.
Return ONLY JSON: {"match": true or false}

Comment: ${comment}
Human theme: ${expected}
System theme: ${predicted ?? "(none)"}`;

  try {
    const parsed = await generateJson<{ match?: unknown }>(prompt, { label: "judge" });
    return parsed.match === true;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const rows: Record<string, string>[] = parse(readFileSync(inputPath), {
    columns: true,
    skip_empty_lines: true,
  });
  // A file with no `substantive` column is the toy set: everything in it is a
  // real argument. A file that has the column carries its own gate answer key.
  const hasGateLabels = rows.some((r) => "substantive" in r);

  const comments: LabeledComment[] = rows.map((r, i) => ({
    id: r.id || String(i + 1),
    text: (r.comment || "").trim(),
    expected: (r.expected_theme || "").trim(),
    expectSubstantive: hasGateLabels ? yes(r.substantive) : true,
  }));

  // An empty cell in `substantive` is an unfilled worksheet, not a claim that
  // the row is boilerplate. Without this the whole file reads as boilerplate,
  // every check below passes vacuously, and the run scores a blank answer key.
  const unlabeled = hasGateLabels ? rows.filter((r) => !(r.substantive ?? "").trim()) : [];
  if (unlabeled.length) {
    console.error(
      `${unlabeled.length} of ${rows.length} rows have an empty 'substantive' cell.\n` +
        `Mark every row y or n in ${inputPath} before scoring. Nothing was run.`
    );
    process.exit(1);
  }

  // Refuse to score an unlabeled file. Running the pipeline against blank
  // expectations costs a few minutes of quota and returns a number built from
  // the judge comparing each theme against nothing, which reads like a result
  // and means nothing at all.
  const missingTheme = comments.filter((c) => c.expectSubstantive && !c.expected);
  if (missingTheme.length) {
    const total = comments.filter((c) => c.expectSubstantive).length;
    console.error(
      `${missingTheme.length} of ${total} rows marked substantive have no expected_theme.\n` +
        `Fill the answer key in ${inputPath} before scoring. Nothing was run.\n` +
        (hasGateLabels
          ? `First unlabeled row: id ${missingTheme[0]?.id}`
          : `This file has no 'substantive' column, so every row is treated as a real\n` +
            `argument. Real PDF chunks are not: add the column and mark boilerplate n.`)
    );
    process.exit(1);
  }

  console.log(`Running pipeline on ${comments.length} labeled comments...`);
  const extracted = await extractAll(comments, {
    onProgress: (done, total) => console.log(`  extracted ${done}/${total}`),
  });
  const predicted = await consolidateThemes(extracted);

  let correct = 0;
  const misses: Miss[] = [];
  const discarded: Miss[] = []; // real argument the gate threw away
  const kept: Miss[] = []; // boilerplate the gate let through as a theme
  let setAside = 0;

  console.log(`Judging ${predicted.length} results one at a time...`);
  for (const c of predicted) {
    const gated = c.substantive === false;

    if (!c.expectSubstantive) {
      // Boilerplate by the human's reckoning. Correct behaviour is to drop it,
      // and there is no theme to judge either way, so this never reaches the
      // judge and never spends a request.
      if (gated) setAside++;
      else kept.push({ text: c.text, expected: "(boilerplate)", got: c.theme ?? "(none)" });
      continue;
    }

    // A real argument the gate discarded cannot have a theme, so it scores as a
    // miss. Counting it any other way would let the gate raise theme accuracy
    // by quietly dropping the rows it found hard.
    if (gated) {
      discarded.push({ text: c.text, expected: c.expected, got: "(filtered as boilerplate)" });
      misses.push({ text: c.text, expected: c.expected, got: "(filtered as boilerplate)" });
      continue;
    }

    const ok = await judge(c.text, c.expected, c.theme);
    if (ok) correct++;
    else misses.push({ text: c.text, expected: c.expected, got: c.theme ?? "(none)" });
  }

  const pct = (n: number, d: number): string => (d ? `${((n / d) * 100).toFixed(1)}%` : "n/a");

  const real = predicted.filter((c) => c.expectSubstantive).length;
  const boilerplate = predicted.length - real;
  const judged = real - discarded.length;

  if (hasGateLabels) {
    console.log(`\nGate, on ${predicted.length} rows:`);
    console.log(`  boilerplate correctly set aside: ${setAside}/${boilerplate}`);
    console.log(`  real arguments wrongly discarded: ${discarded.length}/${real}   <- the costly error`);
    console.log(`  boilerplate wrongly given a theme: ${kept.length}/${boilerplate}`);
  }

  // Two denominators, both stated. The first is what the analyst actually gets
  // and is the number for the demo; the second isolates extraction from the
  // gate and is only a diagnostic, because on its own it flatters a gate that
  // discards anything difficult.
  console.log(`\nTheme accuracy, end to end: ${correct}/${real} = ${pct(correct, real)}`);
  console.log(`  of the ${judged} the gate kept: ${correct}/${judged} = ${pct(correct, judged)}`);
  console.log(`Distinct themes produced: ${new Set(predicted.map((c) => c.theme)).size}`);

  report("Real arguments the gate discarded", discarded);
  report("Boilerplate the gate let through", kept);
  report("Theme mismatches to review", misses.filter((m) => !m.got.startsWith("(filtered")));

  console.log(
    `\nQuote both numbers with their row counts. The judge is the same model family` +
      `\nas the extractor, so it is a sanity check rather than an independent benchmark.`
  );
}

main().catch((e: unknown) => {
  console.error("Failed:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
