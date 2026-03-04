import Dexie, { type Table } from "dexie";
import type { TableModel } from "@/lib/types";

export type SavedScan = {
  localId?: number;
  createdAt: number;
  photoBlob: Blob;
  tableModel: TableModel;
  rawResultJson: string;
  sourceJobId: string;
};

export type QueuedUpload = {
  queueId?: number;
  createdAt: number;
  submissionId: string;
  filename: string;
  imageBlob: Blob;
};

class ScanDatabase extends Dexie {
  scans!: Table<SavedScan, number>;
  uploads!: Table<QueuedUpload, number>;

  constructor() {
    super("recycletanto-scans");
    this.version(1).stores({
      scans: "++localId, createdAt, sourceJobId",
    });
    this.version(2).stores({
      scans: "++localId, createdAt, sourceJobId",
      uploads: "++queueId, createdAt, submissionId",
    });
  }
}

export const scanDb = new ScanDatabase();

export async function saveScan(scan: SavedScan) {
  return scanDb.scans.add(scan);
}

export async function listScans() {
  return scanDb.scans.orderBy("createdAt").reverse().toArray();
}

export async function getScan(localId: number) {
  return scanDb.scans.get(localId);
}

export async function updateScanTable(localId: number, tableModel: TableModel) {
  await scanDb.scans.update(localId, { tableModel });
}

export async function deleteScan(localId: number) {
  await scanDb.scans.delete(localId);
}

export async function deleteScans(localIds: number[]) {
  await scanDb.scans.bulkDelete(localIds);
}

export async function enqueueUpload(upload: QueuedUpload) {
  return scanDb.uploads.add(upload);
}

export async function listQueuedUploads() {
  return scanDb.uploads.orderBy("createdAt").toArray();
}

export async function removeQueuedUpload(queueId: number) {
  await scanDb.uploads.delete(queueId);
}

export async function getQueuedUploadCount() {
  return scanDb.uploads.count();
}

export async function clearQueuedUploads() {
  await scanDb.uploads.clear();
}
