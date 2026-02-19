// lib/dailySnapshot.ts
// Saves and retrieves day-wise employee attendance/work snapshots in Firestore

import {
  collection,
  doc,
  setDoc,
  getDocs,
  getDoc,
  query,
  orderBy,
  Timestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { EmployeeRow } from "@/types/EmployeeRow";

export interface DailyEmployeeRecord {
  uid: string;
  name: string;
  email: string;
  profilePhoto?: string;
  status: "ONLINE" | "OFFLINE";
  morningCheckIn: number;       // minutes from midnight
  totalMinutes: number;
  task: string;
  snapshotAt: Timestamp;        // when this record was saved
}

export interface DailySnapshot {
  date: string;                 // "YYYY-MM-DD"
  savedAt: Timestamp;
  totalEmployees: number;
  onlineCount: number;
  offlineCount: number;
  avgWorkTime: number;          // minutes
  employees: DailyEmployeeRecord[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Returns today's date string in "YYYY-MM-DD" */
export function todayKey(): string {
  return new Date().toISOString().split("T")[0];
}

/** Returns a human-readable label for a date key */
export function formatDateLabel(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ─── Save Snapshot ───────────────────────────────────────────────────────────

/**
 * Saves a complete snapshot of all employees for the given date.
 * Overwrites any existing snapshot for that date.
 * Call this once per day (e.g., at end-of-day or on a scheduled trigger).
 */
export async function saveDailySnapshot(
  rows: EmployeeRow[],
  avgWorkTime: number,
  dateKey: string = todayKey()
): Promise<void> {
  const onlineCount = rows.filter((r) => r.status === "ONLINE").length;
  const offlineCount = rows.filter((r) => r.status === "OFFLINE").length;

const employees: DailyEmployeeRecord[] = rows.map((r) => ({
  uid: r.uid ?? "",
  name: r.name ?? "",
  email: r.email ?? "",
  profilePhoto: r.profilePhoto ?? "",
  status: r.status ?? "OFFLINE",
  morningCheckIn: r.morningCheckIn ?? 0,
  totalMinutes: r.totalMinutes ?? 0,
  task: r.task ?? "",
  snapshotAt: Timestamp.now(),
}));


  const snapshot: DailySnapshot = {
    date: dateKey,
    savedAt: Timestamp.now(),
    totalEmployees: rows.length,
    onlineCount,
    offlineCount,
    avgWorkTime: avgWorkTime ?? 0,
    employees,
  };

  // Path: dailySnapshots/{dateKey}
  await setDoc(doc(db, "dailySnapshots", dateKey), snapshot);
}

/**
 * Auto-saves snapshot for today — safe to call multiple times, just overwrites.
 * Ideal to call when admin opens Dashboard or on a periodic interval.
 */
export async function autoSaveTodaySnapshot(
  rows: EmployeeRow[],
  avgWorkTime: number
): Promise<void> {
  if (rows.length === 0) return;
  await saveDailySnapshot(rows, avgWorkTime, todayKey());
}

// ─── Fetch Snapshots ─────────────────────────────────────────────────────────

/** Fetch all available snapshot date keys, sorted newest first */
export async function fetchSnapshotDates(): Promise<string[]> {
  const colRef = collection(db, "dailySnapshots");
  const q = query(colRef, orderBy("date", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.id);
}

/** Fetch the full snapshot for a specific date key */
export async function fetchSnapshotByDate(
  dateKey: string
): Promise<DailySnapshot | null> {
  const ref = doc(db, "dailySnapshots", dateKey);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data() as DailySnapshot;
}

/** Fetch the last N snapshots (summaries without employee array for quick listing) */
export async function fetchRecentSnapshotSummaries(
  limit = 30
): Promise<Omit<DailySnapshot, "employees">[]> {
  const colRef = collection(db, "dailySnapshots");
  const q = query(colRef, orderBy("date", "desc"));
  const snap = await getDocs(q);

  return snap.docs.slice(0, limit).map((d) => {
    const data = d.data() as DailySnapshot;
    return {
      date: data.date,
      savedAt: data.savedAt,
      totalEmployees: data.totalEmployees,
      onlineCount: data.onlineCount,
      offlineCount: data.offlineCount,
      avgWorkTime: data.avgWorkTime,
    };
  });
}