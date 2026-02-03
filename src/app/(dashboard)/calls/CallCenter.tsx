"use client";

import { useEffect, useRef, useState } from "react";
import {
  collection,
  onSnapshot,
  serverTimestamp,
  query,
  where,
  updateDoc,
  doc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

type Call = {
  id: string;
  createdBy: string;
  createdByName: string;
  meetUrl: string;
  allowedUsers: string[];
  status: "ringing" | "active" | "ended";
};

export default function CallCenter() {
  const { user, loading } = useAuth();
  const [incomingCall, setIncomingCall] = useState<Call | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  /* 🔊 init ringtone */
  useEffect(() => {
    const audio = new Audio("/sounds/ringtone.mp3");
    audio.loop = true;
    audioRef.current = audio;

    return () => {
      audio.pause();
      audio.currentTime = 0;
    };
  }, []);

  /* 🔔 listen for calls */
  useEffect(() => {
    if (loading || !user?.uid) return;

    const q = query(
      collection(db, "calls"),
      where("allowedUsers", "array-contains", user.uid),
      where("status", "==", "ringing")
    );

    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const d = snap.docs[0];
        setIncomingCall({ id: d.id, ...(d.data() as any) });
      } else {
        setIncomingCall(null);
      }
    });

    return () => unsub();
  }, [user, loading]);

  /* 🔊 play / stop ringtone */
  useEffect(() => {
    if (!audioRef.current) return;

    if (incomingCall) {
      audioRef.current
        .play()
        .catch(() => {
          // autoplay blocked — user interaction will unlock
        });
    } else {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, [incomingCall]);

  if (!incomingCall) return null;

  const stopRingtone = () => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
  };

  const setBusy = async (busy: boolean) => {
    if (!user?.uid) return;
    await updateDoc(doc(db, "users", user.uid), {
      busy,
      lastActive: serverTimestamp(),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl p-6 w-[320px] shadow-xl text-center">
        <h3 className="text-lg font-bold mb-2">📞 Incoming Call</h3>

        <p className="text-sm text-slate-600 mb-4">
          {incomingCall.createdByName} is calling you
        </p>

        <div className="flex gap-3">
          {/* JOIN */}
          <button
            onClick={async () => {
              stopRingtone();

              await updateDoc(doc(db, "calls", incomingCall.id), {
                status: "active",
              });

              await setBusy(true);
              window.open(incomingCall.meetUrl, "_blank");
            }}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-semibold"
          >
            Join
          </button>

          {/* REJECT */}
          <button
            onClick={async () => {
              stopRingtone();

              await updateDoc(doc(db, "calls", incomingCall.id), {
                status: "ended",
                endedAt: serverTimestamp(),
              });

              await setBusy(false);
              setIncomingCall(null);
            }}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-semibold"
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}
