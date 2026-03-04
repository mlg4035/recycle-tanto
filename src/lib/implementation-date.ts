type DateExtraction = {
  timestamp: number | null;
  displayDate: string | null;
};

function parseJapaneseDate(dateText: string) {
  const normalized = dateText.replace(/\s+/g, " ").trim();
  const match = normalized.match(/(\d{1,4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (!match) return null;

  const rawYear = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(rawYear) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }

  // Many slips use Japanese era shorthand like "7年" (Reiwa 7 -> 2025).
  const year = rawYear >= 1900 ? rawYear : 2018 + rawYear;
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return {
    timestamp: date.getTime(),
    displayDate: `${year}年${month}月${day}日`,
  };
}

function fromKeyValues(parsed: unknown) {
  if (!parsed || typeof parsed !== "object") return null;
  const root = parsed as Record<string, unknown>;
  const documents = root.documents;
  if (!Array.isArray(documents) || documents.length === 0) return null;

  const firstDoc = documents[0] as Record<string, unknown>;
  const data = firstDoc.data;
  if (!Array.isArray(data) || data.length === 0) return null;

  const firstPage = data[0] as Record<string, unknown>;
  const keyValues = firstPage.key_values;
  if (!Array.isArray(keyValues)) return null;

  const hit = keyValues.find((entry) => {
    if (!entry || typeof entry !== "object") return false;
    const key = String((entry as Record<string, unknown>).key ?? "");
    return key.includes("実施日");
  }) as Record<string, unknown> | undefined;

  if (!hit) return null;
  return parseJapaneseDate(String(hit.value ?? ""));
}

function fromTranscript(parsed: unknown) {
  if (!parsed || typeof parsed !== "object") return null;
  const root = parsed as Record<string, unknown>;
  const results = root.results;
  if (!Array.isArray(results)) return null;

  for (const entry of results) {
    if (!entry || typeof entry !== "object") continue;
    const transcript = String((entry as Record<string, unknown>).transcript ?? "");
    if (!transcript) continue;
    const normalized = transcript.replace(/\r/g, "");
    const line = normalized
      .split("\n")
      .find((candidate) => candidate.includes("実施日"));
    if (!line) continue;
    const parsedDate = parseJapaneseDate(line);
    if (parsedDate) return parsedDate;
  }

  return null;
}

export function extractImplementationDate(rawResultJson: string): DateExtraction {
  try {
    const parsed = JSON.parse(rawResultJson) as unknown;
    return fromKeyValues(parsed) ?? fromTranscript(parsed) ?? { timestamp: null, displayDate: null };
  } catch {
    return { timestamp: null, displayDate: null };
  }
}

export function formatYearMonth(timestamp: number) {
  const date = new Date(timestamp);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${date.getFullYear()}-${month}`;
}
