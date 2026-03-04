import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const DEFAULT_SAMPLE_FILES = [
  "c:/Users/pc/Downloads/20250803-134916-2ce387efda33.json",
  "c:/Users/pc/Downloads/20250803-134848-be395852de4b.json",
  "c:/Users/pc/Downloads/20250806-182211-d905a7fa1bda.json",
];

function getSampleFiles() {
  const custom = process.env.DEV_SAMPLE_PAYLOAD_FILES?.trim();
  if (!custom) return DEFAULT_SAMPLE_FILES;
  return custom
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const url = new URL(request.url);
    const indexRaw = url.searchParams.get("index");
    const index = Number(indexRaw ?? "0");
    const files = getSampleFiles();

    if (!Number.isInteger(index) || index < 0 || index >= files.length) {
      return NextResponse.json({ error: "Invalid sample index" }, { status: 400 });
    }

    const sourcePath = files[index];
    const payloadText = await fs.readFile(sourcePath, "utf8");

    return NextResponse.json({
      payloadText,
      sourcePath,
      sourceName: path.basename(sourcePath),
      index,
      total: files.length,
    });
  } catch {
    return NextResponse.json(
      { error: "Could not load sample payload file" },
      { status: 500 },
    );
  }
}
