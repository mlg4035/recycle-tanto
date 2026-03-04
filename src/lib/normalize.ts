import type { TableModel } from "@/lib/types";

function asString(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function letterColumnName(index: number) {
  let n = index;
  let name = "";
  while (n >= 0) {
    name = String.fromCharCode((n % 26) + 65) + name;
    n = Math.floor(n / 26) - 1;
  }
  return name;
}

function normalizeCellContent(value: unknown) {
  const text = asString(value);
  if (text === ":unselected:") return "";
  return text;
}

type TableShape = {
  rows: string[][];
  hasHeader: boolean;
};

function parseMarkdownRow(line: string) {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return null;
  const inner = trimmed.slice(1, -1);
  const cells = inner.split("|").map((cell) => cell.trim());
  return cells;
}

function isMarkdownDividerRow(cells: string[]) {
  if (cells.length === 0) return false;
  return cells.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s+/g, "")));
}

function getTranscriptMarkdownTable(result: unknown): TableShape | null {
  if (!result || typeof result !== "object") return null;
  const root = result as Record<string, unknown>;
  const results = root.results;
  if (!Array.isArray(results) || results.length === 0) return null;

  for (const entry of results) {
    if (!entry || typeof entry !== "object") continue;
    const transcript = (entry as Record<string, unknown>).transcript;
    if (typeof transcript !== "string" || transcript.length === 0) continue;

    const lines = transcript.split(/\r?\n/);
    const parsedRows: string[][] = [];
    for (const line of lines) {
      const row = parseMarkdownRow(line);
      if (!row) continue;
      if (isMarkdownDividerRow(row)) continue;
      parsedRows.push(row);
    }

    if (parsedRows.length > 1) {
      return {
        rows: parsedRows,
        hasHeader: true,
      };
    }
  }

  return null;
}

function getNestedTableFromDocumentPayload(result: unknown): TableShape | null {
  if (!result || typeof result !== "object") return null;
  const root = result as Record<string, unknown>;

  const documents = root.documents;
  if (!Array.isArray(documents) || documents.length === 0) return null;
  const firstDocument = documents[0] as Record<string, unknown>;
  const data = firstDocument.data;
  if (!Array.isArray(data) || data.length === 0) return null;
  const firstPage = data[0] as Record<string, unknown>;
  const tables = firstPage.tables;
  if (!Array.isArray(tables) || tables.length === 0) return null;
  const firstTable = tables[0] as Record<string, unknown>;
  const rows = firstTable.rows;
  if (!Array.isArray(rows) || rows.length === 0) return null;

  const tableRowCount =
    typeof firstTable.row_count === "number" ? firstTable.row_count : rows.length;
  const inferredColCount = rows.reduce((max, rowEntry) => {
    if (!rowEntry || typeof rowEntry !== "object") return max;
    const rowObj = rowEntry as Record<string, unknown>;
    const cells = rowObj.cells;
    if (!Array.isArray(cells)) return max;
    for (const cellEntry of cells) {
      if (!cellEntry || typeof cellEntry !== "object") continue;
      const cell = cellEntry as Record<string, unknown>;
      const ci = typeof cell.column_index === "number" ? cell.column_index : -1;
      const cs = typeof cell.column_span === "number" ? cell.column_span : 1;
      max = Math.max(max, ci + cs);
    }
    return max;
  }, 0);
  const tableColCount =
    typeof firstTable.column_count === "number"
      ? firstTable.column_count
      : inferredColCount;
  const hasHeaderRow = Boolean(firstTable.has_header_row);
  const matrix: string[][] = Array.from({ length: tableRowCount }, () =>
    Array.from({ length: tableColCount }, () => ""),
  );

  for (const rowEntry of rows) {
    if (!rowEntry || typeof rowEntry !== "object") continue;
    const rowObj = rowEntry as Record<string, unknown>;
    const rowIndex =
      typeof rowObj.row_index === "number" ? rowObj.row_index : undefined;
    const cells = rowObj.cells;
    if (rowIndex === undefined || !Array.isArray(cells)) continue;

    for (const cellEntry of cells) {
      if (!cellEntry || typeof cellEntry !== "object") continue;
      const cell = cellEntry as Record<string, unknown>;
      const columnIndex =
        typeof cell.column_index === "number" ? cell.column_index : undefined;
      if (columnIndex === undefined) continue;
      const rowSpan = typeof cell.row_span === "number" ? cell.row_span : 1;
      const columnSpan =
        typeof cell.column_span === "number" ? cell.column_span : 1;
      const content = normalizeCellContent(cell.content);

      for (let r = rowIndex; r < rowIndex + rowSpan; r += 1) {
        if (!matrix[r]) continue;
        for (let c = columnIndex; c < columnIndex + columnSpan; c += 1) {
          if (matrix[r][c] === undefined) continue;
          matrix[r][c] = content;
        }
      }
    }
  }

  const compactRows = matrix.map((row) => row.map(normalizeCellContent));
  return {
    rows: compactRows,
    hasHeader: hasHeaderRow,
  };
}

function getSimpleRows(result: unknown): TableShape | null {
  if (!result || typeof result !== "object") return null;
  const root = result as Record<string, unknown>;

  const directRows = root.rows;
  if (Array.isArray(directRows)) {
    return {
      rows: directRows.map((row) =>
        Array.isArray(row) ? row.map(asString) : [asString(row)],
      ),
      hasHeader: true,
    };
  }

  const tables = root.tables;
  if (Array.isArray(tables) && tables.length > 0) {
    const first = tables[0] as Record<string, unknown>;
    const tableRows = first.rows;
    if (Array.isArray(tableRows)) {
      return {
        rows: tableRows.map((row) =>
          Array.isArray(row) ? row.map(asString) : [asString(row)],
        ),
        hasHeader: true,
      };
    }
  }

  return null;
}

export function normalizeOcrResult(result: unknown): TableModel {
  const extracted =
    getNestedTableFromDocumentPayload(result) ??
    getTranscriptMarkdownTable(result) ??
    getSimpleRows(result);
  const rows = extracted?.rows ?? [];
  if (rows.length === 0) {
    return {
      columns: ["A"],
      rows: [],
    };
  }

  const maxCols = rows.reduce((max, row) => Math.max(max, row.length), 0);
  const paddedRows = rows.map((row) => {
    if (row.length >= maxCols) return row;
    return [...row, ...Array.from({ length: maxCols - row.length }, () => "")];
  });

  const firstRow = paddedRows[0];
  const hasHeader = extracted?.hasHeader ?? firstRow.some((cell) => cell.trim().length > 0);
  const columns = hasHeader
    ? firstRow.map((cell, idx) => cell.trim() || letterColumnName(idx))
    : Array.from({ length: maxCols }, (_, idx) => letterColumnName(idx));

  const dataRows = hasHeader ? paddedRows.slice(1) : paddedRows;
  return {
    columns,
    rows: dataRows,
  };
}
