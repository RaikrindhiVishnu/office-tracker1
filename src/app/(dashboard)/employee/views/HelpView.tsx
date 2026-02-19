"use client";

import { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  serverTimestamp,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
  doc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

export default function HelpView() {
  const { user } = useAuth();

  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [queries, setQueries] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  /* ================= LOAD EMPLOYEE QUERIES ================= */
  useEffect(() => {
    if (!user?.uid) return;

    const q = query(
      collection(db, "employeeQueries"),
      where("employeeId", "==", user.uid),
      orderBy("createdAt", "desc") // 🔥 requires index
    );

    const unsub = onSnapshot(q, async (snapshot) => {
      const docs = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      setQueries(docs);
      setLoading(false);

      // Mark replies as read
      snapshot.docs.forEach(async (docSnap) => {
        if (docSnap.data().employeeUnread) {
          await updateDoc(doc(db, "employeeQueries", docSnap.id), {
            employeeUnread: false,
          });
        }
      });
    });

    return () => unsub();
  }, [user]);

  /* ================= SUBMIT QUERY ================= */
  const handleSubmit = async () => {
    if (!user?.uid) return;
    if (!subject.trim() || !message.trim()) return;

    try {
      setSubmitting(true);

      await addDoc(collection(db, "employeeQueries"), {
        subject,
        message,
        employeeId: user.uid,
        employeeName: user.email?.split("@")[0] || "Employee",
        status: "pending",
        adminReply: "",
        repliedAt: null,
        employeeUnread: false,
        adminUnread: true, // 🔔 notify admin
        createdAt: serverTimestamp(),
      });

      setSubject("");
      setMessage("");
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return <div className="p-6">Loading user...</div>;
  }

  return (
    <div className="p-6 space-y-6">

      <h2 className="text-2xl font-bold">🆘 Help & Support</h2>

      {/* Submit Form */}
      <div className="bg-white p-6 rounded-xl shadow space-y-4">
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject"
          className="w-full border rounded-lg px-4 py-3"
        />

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Describe your issue..."
          rows={4}
          className="w-full border rounded-lg px-4 py-3"
        />

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="px-6 py-3 bg-[#0b3a5a] text-white rounded-xl"
        >
          {submitting ? "Submitting..." : "Submit Query"}
        </button>
      </div>

      {/* Query History */}
      <div className="space-y-4">
        <h3 className="font-semibold text-lg">📋 My Queries</h3>

        {loading && <p>Loading...</p>}

        {queries.map((q) => (
          <div key={q.id} className="bg-white p-5 rounded-xl shadow space-y-2">
            <div className="flex justify-between">
              <h4 className="font-semibold">{q.subject}</h4>
              <span className={`px-2 py-1 rounded text-xs ${
                q.status === "resolved"
                  ? "bg-green-100 text-green-700"
                  : "bg-yellow-100 text-yellow-700"
              }`}>
                {q.status}
              </span>
            </div>

            <p>{q.message}</p>

            {q.adminReply && (
              <div className="bg-green-50 p-3 rounded">
                <p className="font-semibold text-green-700">Admin Reply:</p>
                <p>{q.adminReply}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
