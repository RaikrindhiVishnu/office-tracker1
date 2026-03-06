// lib/companies.ts
// Phase 1: Multi-Company Foundation
// No Firebase rule changes — pure Firestore reads/writes using existing auth

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  serverTimestamp,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface Company {
  id: string;
  name: string;
  domain?: string;         // e.g. "acmecorp.com" (optional, for future auto-assign)
  createdAt?: any;
  active: boolean;
}

/**
 * Create a new company (called by Super Admin)
 */
export async function createCompany(
  companyId: string,
  data: Omit<Company, "id" | "createdAt">
): Promise<void> {
  const ref = doc(db, "companies", companyId);
  await setDoc(ref, {
    ...data,
    createdAt: serverTimestamp(),
  });
}

/**
 * Get a single company by ID
 */
export async function getCompany(companyId: string): Promise<Company | null> {
  const ref = doc(db, "companies", companyId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Company;
}

/**
 * Get all companies (Super Admin only — no rule change needed,
 * Super Admin is authenticated and we rely on app-level checks)
 */
export async function getAllCompanies(): Promise<Company[]> {
  const snap = await getDocs(collection(db, "companies"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Company));
}

/**
 * Update a company's details
 */
export async function updateCompany(
  companyId: string,
  data: Partial<Omit<Company, "id" | "createdAt">>
): Promise<void> {
  const ref = doc(db, "companies", companyId);
  await updateDoc(ref, data);
}

/**
 * Assign a companyId to an existing user doc
 */
export async function assignUserToCompany(
  uid: string,
  companyId: string
): Promise<void> {
  const ref = doc(db, "users", uid);
  await updateDoc(ref, { companyId });
}

/**
 * Get all users belonging to a company
 */
export async function getUsersByCompany(companyId: string) {
  const q = query(
    collection(db, "users"),
    where("companyId", "==", companyId)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
}