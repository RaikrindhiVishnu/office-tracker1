"use client";

import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

type Call = {
  id: string;
  fromUid: string;
  fromName: string;
  toUids: string[];
  status: "ringing" | "active" | "ended";
  createdAt: any;
};

export default function CallHistory() {
  const { user } = useAuth();
  const [callHistory, setCallHistory] = useState<Call[]>([]);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "calls"),
      where("toUids", "array-contains", user.uid),
      where("status", "==", "ended"),
      orderBy("createdAt", "desc")
    );

    return onSnapshot(q, (snap) => {
      setCallHistory(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))
      );
    });
  }, [user]);

  if (callHistory.length === 0) {
    return (
      <p className="text-sm text-gray-500 text-center py-6">
        No call history yet
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {callHistory.map((c) => (
        <div
          key={c.id}
          className="p-3 border border-gray-200 rounded-lg bg-white hover:shadow-sm transition"
        >
          <p className="font-semibold text-slate-900">
            Call with{" "}
            <span className="text-indigo-600">{c.fromName}</span>
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {c.createdAt?.toDate().toLocaleString()}
          </p>
        </div>
      ))}
    </div>
  );
}
