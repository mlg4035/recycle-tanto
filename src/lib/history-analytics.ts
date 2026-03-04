import type { SavedScan } from "@/lib/indexeddb";

export const ITEM_TYPE_ORDER = [
  "新聞",
  "雑誌・雑紙",
  "ダンボール",
  "紙パック",
  "古着・古布",
  "スチール缶",
  "アルミ缶",
  "金属くず",
] as const;

export function findQuantityColumn(columns: string[]) {
  const patterns = [/数量/, /^qty$/i, /quantity/i, /amount/i];
  return columns.findIndex((column) =>
    patterns.some((pattern) => pattern.test(column.trim())),
  );
}

export function parseNumericValue(cell: string) {
  const normalized = cell.replace(/,/g, "");
  const match = normalized.match(/-?\d+(?:\.\d+)?/);
  if (!match) return 0;
  const value = Number(match[0]);
  return Number.isFinite(value) ? value : 0;
}

export function sumScanQuantity(scan: SavedScan) {
  const quantityColumn = findQuantityColumn(scan.tableModel.columns);
  if (quantityColumn < 0) return 0;
  return scan.tableModel.rows.reduce((sum, row) => {
    const cell = row[quantityColumn] ?? "";
    return sum + parseNumericValue(cell);
  }, 0);
}

function findCategoryColumn(columns: string[], quantityColumn: number) {
  const patterns = [/品目/, /item/i, /category/i, /分類/];
  const explicit = columns.findIndex((column) =>
    patterns.some((pattern) => pattern.test(column.trim())),
  );
  if (explicit >= 0) return explicit;
  return columns.findIndex((_, index) => index !== quantityColumn);
}

function extractCategoryLabel(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "Other";
  const classMatch = trimmed.match(/^([^\s　]+類)/);
  if (classMatch) return classMatch[1];
  const token = trimmed.split(/[\s　]+/)[0];
  return token || "Other";
}

function normalizeTypeText(value: string) {
  return value
    .replace(/·/g, "・")
    .replace(/\s+/g, "")
    .trim();
}

function detectItemTypeLabel(rawValue: string) {
  const text = normalizeTypeText(rawValue);
  if (!text) return null;

  if (text.includes("新聞")) return "新聞";
  if (text.includes("雑誌") || text.includes("雑紙")) return "雑誌・雑紙";
  if (text.includes("ダンボール")) return "ダンボール";
  if (text.includes("紙パック")) return "紙パック";
  if (text.includes("古着") || text.includes("古布")) return "古着・古布";
  if (text.includes("スチール缶")) return "スチール缶";
  if (text.includes("アルミ缶")) return "アルミ缶";
  if (text.includes("金属くず")) return "金属くず";
  return null;
}

export function sumScanCategoryQuantities(scan: SavedScan) {
  const quantityColumn = findQuantityColumn(scan.tableModel.columns);
  if (quantityColumn < 0) return new Map<string, number>();
  const categoryColumn = findCategoryColumn(scan.tableModel.columns, quantityColumn);
  if (categoryColumn < 0) return new Map<string, number>();

  const totals = new Map<string, number>();
  for (const row of scan.tableModel.rows) {
    const quantity = parseNumericValue(row[quantityColumn] ?? "");
    if (quantity === 0) continue;
    const category = extractCategoryLabel(row[categoryColumn] ?? "");
    totals.set(category, (totals.get(category) ?? 0) + quantity);
  }
  return totals;
}

export function sumScanTypeQuantities(scan: SavedScan) {
  const quantityColumn = findQuantityColumn(scan.tableModel.columns);
  if (quantityColumn < 0) return new Map<string, number>();
  const itemColumn = findCategoryColumn(scan.tableModel.columns, quantityColumn);
  if (itemColumn < 0) return new Map<string, number>();

  const totals = new Map<string, number>();
  for (const type of ITEM_TYPE_ORDER) {
    totals.set(type, 0);
  }

  for (const row of scan.tableModel.rows) {
    const quantity = parseNumericValue(row[quantityColumn] ?? "");
    if (quantity === 0) continue;
    const detectedType = detectItemTypeLabel(row[itemColumn] ?? "");
    if (!detectedType) continue;
    totals.set(detectedType, (totals.get(detectedType) ?? 0) + quantity);
  }
  return totals;
}
