// lib/breakTracking.ts
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export type BreakType = "MORNING" | "LUNCH" | "EVENING";

export type Break = {
  type: BreakType;
  startTime: Timestamp | null;
  endTime: Timestamp | null;
};

export type AttendanceDoc = {
  sessions: any[];
  breaks?: Break[];
  updatedAt?: any;
};

/**
 * Get today's date string in YYYY-MM-DD format
 */
export const getTodayDateStr = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

/**
 * Start a break for a given employee
 */
export const startBreak = async (uid: string, type: BreakType): Promise<void> => {
  const dateStr = getTodayDateStr();
  const ref = doc(db, "attendance", `${uid}_${dateStr}`);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    throw new Error("No attendance record found. Please check in first.");
  }

  const data = snap.data() as AttendanceDoc;
  const breaks: Break[] = data.breaks || [];

  // Check if there's already an active break
  const activeBreak = breaks.find((b) => b.startTime && !b.endTime);
  if (activeBreak) {
    throw new Error(`You already have an active ${activeBreak.type} break. End it first.`);
  }

  // Check if break of this type already exists and ended today
  const existingBreak = breaks.find((b) => b.type === type && b.startTime && b.endTime);
  if (existingBreak) {
    throw new Error(`You have already taken a ${type} break today.`);
  }

  const newBreak: Break = {
    type,
    startTime: Timestamp.now(),
    endTime: null,
  };

  await updateDoc(ref, {
    breaks: [...breaks, newBreak],
    updatedAt: serverTimestamp(),
  });
};

/**
 * End the currently active break for a given employee
 */
export const endBreak = async (uid: string): Promise<void> => {
  const dateStr = getTodayDateStr();
  const ref = doc(db, "attendance", `${uid}_${dateStr}`);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    throw new Error("No attendance record found.");
  }

  const data = snap.data() as AttendanceDoc;
  const breaks: Break[] = data.breaks || [];

  const activeIdx = breaks.findIndex((b) => b.startTime && !b.endTime);
  if (activeIdx === -1) {
    throw new Error("No active break found.");
  }

  const updatedBreaks = breaks.map((b, i) =>
    i === activeIdx ? { ...b, endTime: Timestamp.now() } : b
  );

  await updateDoc(ref, {
    breaks: updatedBreaks,
    updatedAt: serverTimestamp(),
  });
};

/**
 * Get today's attendance data for a given employee (includes breaks)
 */
export const getTodayAttendanceWithBreaks = async (uid: string): Promise<AttendanceDoc | null> => {
  const dateStr = getTodayDateStr();
  const ref = doc(db, "attendance", `${uid}_${dateStr}`);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data() as AttendanceDoc;
};

/**
 * Calculate total break minutes from a list of breaks
 */
export const calcTotalBreakMinutes = (breaks: Break[]): number => {
  let total = 0;
  for (const b of breaks) {
    if (!b.startTime) continue;
    const start = b.startTime.toDate().getTime();
    const end = b.endTime ? b.endTime.toDate().getTime() : Date.now();
    const diff = end - start;
    if (diff > 0) total += Math.floor(diff / 60000);
  }
  return total;
};

/**
 * Get the currently active break (if any)
 */
export const getActiveBreak = (breaks: Break[]): Break | null => {
  return breaks.find((b) => b.startTime && !b.endTime) || null;
};

/**
 * Format minutes to readable string (e.g. "1h 20m")
 */
export const formatBreakDuration = (minutes: number): string => {
  if (minutes <= 0) return "0m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};

/**
 * Format a Timestamp to HH:MM
 */
export const formatBreakTime = (ts: Timestamp | null): string => {
  if (!ts) return "--";
  return ts.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

export const BREAK_LIMIT_MINUTES = 60; // 1 hour total break limit