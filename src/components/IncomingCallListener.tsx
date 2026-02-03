"use client";

import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot, updateDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

export default function IncomingCallListener() {
  const { user } = useAuth();
  const [call, setCall] = useState<any>(null);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "calls"),
      where("toUids", "array-contains", user.uid),
      where("status", "==", "ringing")
    );

    return onSnapshot(q, (snap) => {
      if (!snap.empty) {
        setCall({ id: snap.docs[0].id, ...snap.docs[0].data() });
      } else {
        setCall(null);
      }
    });
  }, [user]);

  if (!call) return null;

  return (
    <div className="fixed bottom-6 right-6 bg-white shadow-2xl rounded-xl p-4 w-72 z-50 border border-slate-200 animate-slide-in">
      <p className="font-semibold text-slate-900 mb-1">
        📞 Incoming call
      </p>
      <p className="text-sm text-slate-600">
        {call.fromName} is calling you
      </p>

      <div className="flex gap-2 mt-4">
        <button
          onClick={async () => {
            await updateDoc(doc(db, "calls", call.id), { status: "active" });
            window.open(call.meetUrl, "_blank");
          }}
          className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg text-sm font-medium"
        >
          Join
        </button>

        <button
          onClick={async () => {
            await updateDoc(doc(db, "calls", call.id), { status: "ended" });
            setCall(null);
          }}
          className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg text-sm font-medium"
        >
          Reject
        </button>
      </div>
    </div>
  );
}
