"use client";

// src/hooks/useLeaveRequests.ts

import { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  QueryConstraint,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { LeaveRequest, LeaveStatus } from "@/types/leave";

interface UseLeaveRequestsOptions {
  uid     ?: string;        // filter by employee — omit for HR (all requests)
  status  ?: LeaveStatus;
}

interface UseLeaveRequestsReturn {
  requests : LeaveRequest[];
  loading  : boolean;
  error    : string | null;
}

export function useLeaveRequests(
  options: UseLeaveRequestsOptions = {}
): UseLeaveRequestsReturn {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading,  setLoading]  = useState<boolean>(true);
  const [error,    setError]    = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const constraints: QueryConstraint[] = [
      where("type", "==", "leave"),
    ];

    if (options.uid)    constraints.push(where("uid",    "==", options.uid));
    if (options.status) constraints.push(where("status", "==", options.status));

    constraints.push(orderBy("createdAt", "desc"));

    const q = query(collection(db, "requests"), ...constraints);

    const unsub = onSnapshot(
      q,
      (snap) => {
        setRequests(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<LeaveRequest, "id">) }))
        );
        setLoading(false);
      },
      (err) => {
        console.error("useLeaveRequests:", err);
        setError(err.message ?? "Failed to load leave requests.");
        setLoading(false);
      }
    );

    return () => unsub();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.uid, options.status]);

  return { requests, loading, error };
}