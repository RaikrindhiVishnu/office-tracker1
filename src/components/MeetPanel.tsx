"use client";

import { useState } from "react";

import { addDoc, collection, serverTimestamp } from "firebase/firestore";

import { db } from "@/lib/firebase";

import { useAuth } from "@/context/AuthContext";

type User = {
  uid: string;

  name?: string;

  email: string;
};

type Props = {
  users: User[];
};

export default function MeetPanel({ users }: Props) {
  const { user } = useAuth();

  const [open, setOpen] = useState(false);

  const [mode, setMode] = useState<"individual" | "group">("individual");

  const [selected, setSelected] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);

  if (!user) return null;

  const toggleUser = (uid: string) => {
    setSelected((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid],
    );
  };

  const startMeet = async () => {
    if (selected.length === 0) {
      alert("Select at least one member");

      return;
    }

    try {
      setLoading(true);

      const meetUrl = "https://meet.google.com/new";

      // 🔔 Create call doc (this is what makes incoming call visible)

      await addDoc(collection(db, "calls"), {
        type: mode,

        fromUid: user.uid,

        fromName: user.email?.split("@")[0] || "User",

        toUids: selected,

        status: "ringing",

        meetUrl,

        createdAt: serverTimestamp(),
      });

      // Open meet for caller

      window.open(meetUrl, "_blank");

      setSelected([]);

      setOpen(false);
    } catch (err) {
      console.error("Meet error:", err);

      alert("Failed to start meet");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* 🔹 PREMIUM SMALL SIDEBAR BUTTON */}

      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-3 py-1.5

                   rounded-md bg-indigo-600 text-white text-sm font-semibold

                   hover:bg-indigo-700 transition shadow-sm"
      >
        📞 Meet
      </button>

      {/* 🔳 MEET MODAL */}

      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white w-[380px] rounded-2xl shadow-2xl p-6">
            <h2 className="text-xl font-bold mb-4">Start a Meet</h2>

            {/* MODE SELECT */}

            <div className="flex gap-2 mb-4">
              <button
                onClick={() => {
                  setMode("individual");

                  setSelected([]);
                }}
                className={`flex-1 py-2 rounded-lg font-medium transition ${
                  mode === "individual"
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-100 hover:bg-slate-200"
                }`}
              >
                👤 Individual
              </button>

              <button
                onClick={() => {
                  setMode("group");

                  setSelected([]);
                }}
                className={`flex-1 py-2 rounded-lg font-medium transition ${
                  mode === "group"
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-100 hover:bg-slate-200"
                }`}
              >
                👥 Group
              </button>
            </div>

            {/* USER LIST */}

            <div className="max-h-60 overflow-y-auto space-y-2 mb-4">
              {users

                .filter((u) => u.uid !== user.uid)

                .map((u) => (
                  <label
                    key={u.uid}
                    className="flex items-center gap-3 p-2 border rounded-lg

                               cursor-pointer hover:bg-slate-50"
                  >
                    <input
                      type={mode === "individual" ? "radio" : "checkbox"}
                      checked={selected.includes(u.uid)}
                      onChange={() =>
                        mode === "individual"
                          ? setSelected([u.uid])
                          : toggleUser(u.uid)
                      }
                    />

                    <span className="text-sm font-medium">
                      {u.name || u.email}
                    </span>
                  </label>
                ))}
            </div>

            {/* ACTIONS */}

            <div className="flex gap-3">
              <button
                onClick={() => setOpen(false)}
                className="flex-1 py-2 border rounded-lg font-medium"
              >
                Cancel
              </button>

              <button
                disabled={loading}
                onClick={startMeet}
                className="flex-1 py-2 bg-green-600 hover:bg-green-700

                           text-white rounded-lg font-semibold disabled:opacity-50"
              >
                {loading ? "Starting..." : "Start Meet"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
