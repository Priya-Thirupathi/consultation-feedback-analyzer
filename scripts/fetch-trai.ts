// Download real stakeholder comments from the TRAI consultation on
// "Leveraging AI and Big Data in the Telecom Sector", extract the text, split
// each submission into paragraph sized chunks, and write a CSV the app reads.
//
// Why chunk: each submission is a long multi page PDF covering many points. To
// theme them properly we split into paragraphs so one dense PDF becomes many
// substantive text units, matching the "many comments, few themes" model.
//
// Usage:
//   node scripts/fetch-trai.ts
// Output: data/trai_comments.csv with columns id,comment,org
//
// Needs the pdftotext tool (from poppler-utils). Install on Linux with:
//   sudo apt-get install -y poppler-utils

import { execSync } from "node:child_process";
import { writeFileSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = "https://www.trai.gov.in";
const FILES: readonly (readonly [org: string, path: string])[] = [
  ["BSA", "/sites/default/files/2024-11/BSA_07112022.pdf"],
  ["NASSCOM-DSCI", "/sites/default/files/2024-11/NASSCOM_DSCI_07112022.pdf"],
  ["Broadband India Forum", "/sites/default/files/2024-11/BIF_07112022.pdf"],
  ["COAI", "/sites/default/files/2024-11/COAI_09112022.pdf"],
  ["GSMA", "/sites/default/files/2024-11/GSMA_07112022.pdf"],
  ["Qualcomm", "/sites/default/files/2024-11/Qualcomm_07112022.pdf"],
  ["IEEE 802 LMSC", "/sites/default/files/2024-11/IEEE_802_LMSC_21112022.pdf"],
  ["Intel", "/sites/default/files/2024-11/Intel_Corporation_07112022.pdf"],
  ["IEEE SA", "/sites/default/files/2024-11/IEEE_Standards_Association_21112022.pdf"],
  ["Pratharva Partners", "/sites/default/files/2024-11/Pratharva_Partners_LLP_07112022.pdf"],
  ["AIIDE IITK Pinnacle", "/sites/default/files/2024-11/AIIDE_Pinnacle_07112022.pdf"],
  ["Paytm", "/sites/default/files/2024-11/Paytm_07112022.pdf"],
  ["Bharti Airtel", "/sites/default/files/2024-11/Airtel_07112022.pdf"],
  ["MTNL", "/sites/default/files/2024-11/MTNL_07112022.pdf"],
  ["Tata Teleservices", "/sites/default/files/2024-11/TTL_07112022.pdf"],
  ["Tata Communications", "/sites/default/files/2024-11/Tata_Communications_07112022.pdf"],
  ["Vodafone Idea", "/sites/default/files/2024-11/VIL_07112022.pdf"],
  ["Reliance Jio", "/sites/default/files/2024-11/RJIL_07112022.pdf"],
  ["Abhijit Rohi", "/sites/default/files/2024-11/Abhijit_Rohi_07112022.pdf"],
  ["Priyank Chandra", "/sites/default/files/2024-11/Priyank_Chandra_07112022.pdf"],
  ["CPA Himmatnagar", "/sites/default/files/2024-11/CPA_Himmatnagar_07112022.pdf"],
  ["Ministry of Defence", "/sites/default/files/2024-11/Ministry_of_Defence_18112022.pdf"],
];

// Keep chunks that look like real substantive points, drop boilerplate.
const MIN_CHARS = 250;
const MAX_CHARS = 1200;
const MAX_PER_ORG = 12; // stop one large submission from dominating

const __dirname = dirname(fileURLToPath(import.meta.url));
const tmpDir = resolve(__dirname, "../.trai_tmp");

interface Row {
  id: number;
  comment: string;
  org: string;
}

const cleanChunk = (s: string): string => s.replace(/\s+/g, " ").trim();

// A paragraph is worth keeping if it is long enough and mostly prose, not a
// page number, heading, or table fragment.
function looksSubstantive(s: string): boolean {
  if (s.length < MIN_CHARS) return false;
  const letters = (s.match(/[a-zA-Z]/g) ?? []).length;
  if (letters / s.length < 0.6) return false;
  if (/^page \d+ of \d+$/i.test(s)) return false;
  return true;
}

async function download(url: string, out: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  writeFileSync(out, Buffer.from(await res.arrayBuffer()));
}

async function main(): Promise<void> {
  mkdirSync(tmpDir, { recursive: true });
  const rows: Row[] = [];

  for (const [org, path] of FILES) {
    const pdf = resolve(tmpDir, "doc.pdf");
    const txt = resolve(tmpDir, "doc.txt");
    try {
      await download(BASE + path, pdf);
      execSync(`pdftotext -layout "${pdf}" "${txt}"`, { stdio: "ignore" });
      const text = readFileSync(txt, "utf8");

      // Split on blank lines into paragraphs.
      const paras = text.split(/\n\s*\n/).map(cleanChunk).filter(looksSubstantive);

      let kept = 0;
      for (const p of paras) {
        if (kept >= MAX_PER_ORG) break;
        rows.push({ id: rows.length + 1, comment: p.slice(0, MAX_CHARS), org });
        kept++;
      }
      console.log(`${org}: kept ${kept} chunks`);
    } catch (e: unknown) {
      console.log(`${org}: skipped (${e instanceof Error ? e.message : String(e)})`);
    }
  }

  const esc = (s: string | number): string => `"${String(s).replace(/"/g, '""')}"`;
  const lines = ["id,comment,org"];
  for (const r of rows) lines.push(`${r.id},${esc(r.comment)},${esc(r.org)}`);

  const outPath = resolve(__dirname, "../data/trai_comments.csv");
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, lines.join("\n") + "\n");
  rmSync(tmpDir, { recursive: true, force: true });

  console.log(`\nDone. Wrote ${rows.length} chunks from ${FILES.length} submissions to ${outPath}.`);
}

main().catch((e: unknown) => {
  console.error("Failed:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
