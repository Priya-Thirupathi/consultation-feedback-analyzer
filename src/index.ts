// Express server for the consultation feedback analyzer.
// Flow: upload a CSV of comments -> extract a theme per comment with Gemini
// -> group and rank -> return the top themes. Also serves the client.
//
// This is the core MVP path. Keep it simple. Stretch features (stance,
// language support, search) come only after this works end to end.

import fs from "node:fs";
import express, { type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import { parse } from "csv-parse/sync";
import { MongoClient, type Db } from "mongodb";
import { extractAll } from "./extract.ts";
import { consolidateThemes } from "./consolidate.ts";
import { groupAndRank } from "./group.ts";
import type { Comment } from "./types.ts";
import type { AnalysisResult } from "../shared/api.ts";

const app = express();
const PORT = process.env.PORT || 3000;

// The upload box is open to anyone at the table, and every row costs a paced
// Gemini request: 5,000 rows would be ~500 requests and most of the daily quota.
const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_BYTES || 5_000_000);
const MAX_COMMENTS = Number(process.env.MAX_COMMENTS || 300);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
});

// Unhandled, multer's size error surfaces as a 500 with a stack trace.
function uploadCsv(req: Request, res: Response, next: NextFunction): void {
  upload.single("file")(req, res, (err: unknown) => {
    if (!err) return next();
    const tooBig = typeof err === "object" && err !== null && "code" in err
      && (err as { code?: unknown }).code === "LIMIT_FILE_SIZE";
    res.status(tooBig ? 413 : 400).json({
      error: tooBig
        ? `That file is larger than the ${Math.round(MAX_UPLOAD_BYTES / 1e6)} MB limit.`
        : err instanceof Error ? err.message : "Upload failed.",
    });
  });
}

// Falls back to the plain page in public/ when the client has not been built,
// so a broken build still leaves a working demo rather than a blank screen.
const CLIENT_DIR = fs.existsSync("dist/index.html") ? "dist" : "public";
console.log(`Serving the client from ${CLIENT_DIR}/`);
app.use(express.static(CLIENT_DIR));

// Optional Mongo connection. The app still works without it; storage is a
// nice to have for the MVP, not a blocker.
let db: Db | null = null;
async function connectDb(): Promise<void> {
  if (!process.env.MONGODB_URI) return;
  try {
    // Short timeout so a missing Mongo fails fast instead of blocking startup.
    const client = new MongoClient(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 2000,
    });
    await client.connect();
    db = client.db(process.env.MONGODB_DB || "consultation");
    console.log("Connected to MongoDB");
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log("MongoDB not available, running without storage:", msg);
  }
}

// Turn a CSV buffer into a list of comments. Expects a column named "comment"
// or "text". Falls back to the first column if neither is present.
//
// The org column rides along because one submission is split into many chunks,
// so counting rows lets a single verbose organisation outrank a theme that many
// organisations each raised once.
function parseComments(buffer: Buffer): Comment[] {
  const rows: Record<string, string>[] = parse(buffer, {
    columns: true,
    skip_empty_lines: true,
  });
  return rows
    .map((r, i) => {
      const text = r.comment || r.text || Object.values(r)[0] || "";
      const org = r.org || r.organisation || r.organization || r.stakeholder || "";
      return {
        id: r.id || String(i + 1),
        text: String(text).trim(),
        org: String(org).trim() || null,
      };
    })
    .filter((c) => c.text.length > 0);
}

app.post("/api/analyze", uploadCsv, async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const uploaded = parseComments(req.file.buffer);
    if (uploaded.length === 0) {
      return res.status(400).json({ error: "No comments found in the CSV" });
    }

    // Truncate rather than reject, so an oversized file still demos. `capped`
    // goes back so the page can say so instead of the counts implying the whole
    // file was read.
    const capped = uploaded.length > MAX_COMMENTS;
    const comments = capped ? uploaded.slice(0, MAX_COMMENTS) : uploaded;

    // Requests are paced to stay under the free tier limit, so a large upload
    // takes minutes. Log progress rather than leaving the terminal silent.
    console.log(`Analyzing ${comments.length} comments...`);
    const extracted = await extractAll(comments, {
      onProgress: (done, total) => console.log(`  extracted ${done}/${total}`),
    });
    const consolidated = await consolidateThemes(extracted);
    const themes = groupAndRank(consolidated);

    // Report what was set aside. Without this the total would claim every row
    // fed a theme, when question restatements and boilerplate were dropped.
    const skipped = consolidated.filter((c) => c.substantive === false).length;

    const organisations = new Set(comments.map((c) => c.org).filter(Boolean)).size;

    if (db) {
      await db.collection("runs").insertOne({
        at: new Date(),
        total: comments.length,
        themes,
      });
    }

    const result: AnalysisResult = {
      total: comments.length,
      analyzed: comments.length - skipped,
      skipped,
      organisations: organisations || null,
      capped,
      uploadedRows: uploaded.length,
      themeCount: themes.length,
      themes,
    };
    res.json(result);
  } catch (e: unknown) {
    console.error(e);
    res.status(500).json({ error: e instanceof Error ? e.message : "Analysis failed." });
  }
});

app.get("/api/health", (_req: Request, res: Response) => res.json({ ok: true }));

// Start the server immediately. Mongo connects in the background and is
// optional, so a missing database never blocks the app from starting.
app.listen(PORT, () => console.log(`Analyzer running on http://localhost:${PORT}`));
void connectDb();
