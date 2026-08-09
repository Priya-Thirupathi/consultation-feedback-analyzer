// Pull real public comments from Regulations.gov into a CSV the app can read.
//
// Usage:
//   node --env-file=.env scripts/fetch-regulations.ts <docketId> [maxComments]
// Examples:
//   node --env-file=.env scripts/fetch-regulations.ts DOT-OST-2022-0144 300
//
// You need a free API key. Get one in a minute at https://api.data.gov/signup
// (the same key works for Regulations.gov). Put it in .env as:
//   REG_GOV_API_KEY=your_key_here
//
// Output: data/regulations_comments.csv with columns id,comment
// The app already accepts this shape, so you can upload it straight away.
//
// Notes:
// - The API allows 1000 requests per hour. Each comment needs one detail call,
//   so keep maxComments to a few hundred for a demo. That is plenty.
// - Some comments are just "See attached" with the real text in a PDF. We skip
//   those so the theme extraction gets real text, not placeholders.

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const API = "https://api.regulations.gov/v4";
const KEY = process.env.REG_GOV_API_KEY;

const docketId = process.argv[2];
const maxComments = Number(process.argv[3] || 300);

if (!KEY) {
  console.error("Missing REG_GOV_API_KEY. Get one at https://api.data.gov/signup and add it to .env");
  process.exit(1);
}
if (!docketId) {
  console.error("Usage: node --env-file=.env scripts/fetch-regulations.ts <docketId> [maxComments]");
  process.exit(1);
}

// The API's JSON, described only as far as this script actually reads it.
interface ApiDocument {
  id: string;
  attributes: { documentType?: string; objectId?: string };
}
interface ApiListResponse<T> {
  data?: T[];
  meta?: { totalElements?: number; hasNextPage?: boolean };
}
interface ApiCommentDetail {
  data?: { attributes?: { comment?: string } };
}

interface Row {
  id: number;
  comment: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function api<T>(path: string): Promise<T> {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`${API}${path}${sep}api_key=${KEY}`);
  if (res.status === 429) {
    throw new Error("Rate limit hit (1000/hour). Wait and try a smaller maxComments.");
  }
  if (!res.ok) {
    throw new Error(`API ${res.status} on ${path}: ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

// Find the objectId that comments are attached to. Comments hang off a specific
// document (usually the proposed rule), identified by its objectId.
async function findObjectId(docket: string): Promise<string> {
  const data = await api<ApiListResponse<ApiDocument>>(
    `/documents?filter[docketId]=${docket}&page[size]=50&sort=documentType`
  );
  if (!data.data?.length) throw new Error(`No documents found for docket ${docket}`);

  // Prefer a Proposed Rule, then a Rule, else the first document.
  const preferred =
    data.data.find((d) => d.attributes.documentType === "Proposed Rule") ??
    data.data.find((d) => d.attributes.documentType === "Rule") ??
    data.data[0];

  const objectId = preferred?.attributes.objectId;
  if (!objectId) throw new Error(`No objectId on any document for docket ${docket}`);

  console.log(`Using document ${preferred.id} (${preferred.attributes.documentType}), objectId ${objectId}`);
  return objectId;
}

// Page through the comment list and collect comment ids.
async function listCommentIds(objectId: string, limit: number): Promise<string[]> {
  const ids: string[] = [];
  let page = 1;
  while (ids.length < limit && page <= 20) {
    const data = await api<ApiListResponse<{ id: string }>>(
      `/comments?filter[commentOnId]=${objectId}&page[size]=250&page[number]=${page}&sort=lastModifiedDate`
    );
    if (!data.data?.length) break;
    for (const c of data.data) {
      ids.push(c.id);
      if (ids.length >= limit) break;
    }
    const total = data.meta?.totalElements ?? ids.length;
    console.log(`Collected ${ids.length} comment ids (docket has ~${total})`);
    if (!data.meta?.hasNextPage) break;
    page += 1;
    await sleep(300);
  }
  return ids;
}

// Fetch the full text for one comment.
async function fetchCommentText(id: string): Promise<string> {
  const data = await api<ApiCommentDetail>(`/comments/${id}`);
  return (data.data?.attributes?.comment ?? "").trim();
}

function toCsv(rows: Row[]): string {
  const esc = (s: string): string => `"${s.replace(/"/g, '""').replace(/\s+/g, " ").trim()}"`;
  const lines = ["id,comment"];
  for (const r of rows) lines.push(`${r.id},${esc(r.comment)}`);
  return lines.join("\n") + "\n";
}

async function main(): Promise<void> {
  const objectId = await findObjectId(docketId!);
  const ids = await listCommentIds(objectId, maxComments);
  console.log(`Fetching full text for ${ids.length} comments...`);

  const rows: Row[] = [];
  let skipped = 0;
  for (const [i, id] of ids.entries()) {
    try {
      const text = await fetchCommentText(id);
      // Skip empty or attachment only comments so extraction gets real text.
      if (!text || /^see attached/i.test(text) || text.length < 15) {
        skipped++;
      } else {
        rows.push({ id: rows.length + 1, comment: text });
      }
    } catch (e: unknown) {
      console.log(`  skip ${id}: ${e instanceof Error ? e.message : String(e)}`);
      skipped++;
    }
    if ((i + 1) % 25 === 0) console.log(`  ${i + 1}/${ids.length} done`);
    await sleep(200); // stay well under the rate limit
  }

  const __dirname = dirname(fileURLToPath(import.meta.url));
  const outPath = resolve(__dirname, "../data/regulations_comments.csv");
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, toCsv(rows));

  console.log(`\nDone. Wrote ${rows.length} comments to ${outPath} (skipped ${skipped}).`);
  console.log("Upload that CSV in the app to run the analyzer on real data.");
}

main().catch((e: unknown) => {
  console.error("\nFailed:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
