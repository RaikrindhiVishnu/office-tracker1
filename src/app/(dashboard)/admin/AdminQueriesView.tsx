"use client";

import { useEffect, useState } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

const ITEMS_PER_PAGE = 5;

export default function AdminQueriesView() {
  const [queries, setQueries] = useState<any[]>([]);
  const [replyText, setReplyText] = useState<{ [key: string]: string }>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  /* ================= LOAD ALL QUERIES ================= */
  useEffect(() => {
    const q = query(
      collection(db, "employeeQueries"),
      orderBy("createdAt", "desc") // 🔥 requires index
    );

    const unsub = onSnapshot(q, (snapshot) => {
      setQueries(snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })));
    });

    return () => unsub();
  }, []);

  const handleReply = async (id: string) => {
    if (!replyText[id]?.trim()) return;

    await updateDoc(doc(db, "employeeQueries", id), {
      adminReply: replyText[id],
      status: "resolved",
      employeeUnread: true, // 🔔 notify employee
      adminUnread: false,
      repliedAt: serverTimestamp(),
    });

    setReplyText((prev) => ({ ...prev, [id]: "" }));
    setExpandedId(null);
  };

  const markAsRead = async (id: string) => {
    await updateDoc(doc(db, "employeeQueries", id), {
      adminUnread: false,
    });
  };

  const totalPages = Math.ceil(queries.length / ITEMS_PER_PAGE);
  const paginated = queries.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <div className="p-6">
      {/* Page Header */}
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-gray-800">Employee Queries</h2>
        <p className="text-sm text-gray-400 mt-1">
          {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* Table Container */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

        {/* Table Header */}
        <div className="grid grid-cols-[2fr_2fr_1fr_1fr] bg-[#1e3a5f] text-white text-xs font-semibold uppercase tracking-widest">
          <div className="px-6 py-4">Employee</div>
          <div className="px-6 py-4">Subject & Message</div>
          <div className="px-6 py-4">Status</div>
          <div className="px-6 py-4">Actions</div>
        </div>

        {/* Empty State */}
        {queries.length === 0 && (
          <div className="text-center py-20 text-gray-400">
            <div className="text-5xl mb-4">📭</div>
            <p className="text-sm font-medium">No queries yet</p>
          </div>
        )}

        {/* Rows */}
        {paginated.map((q, idx) => (
          <div key={q.id}>
            {/* Main Row */}
            <div
              className={`grid grid-cols-[2fr_2fr_1fr_1fr] items-center border-b border-gray-100 transition-colors hover:bg-gray-50 cursor-pointer ${
                idx % 2 === 0 ? "bg-white" : "bg-gray-50/40"
              } ${q.adminUnread ? "border-l-4 border-l-blue-400" : ""}`}
              onClick={() => setExpandedId(expandedId === q.id ? null : q.id)}
            >
              {/* Employee */}
              <div className="px-6 py-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#1e3a5f] text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {q.employeeName?.charAt(0)?.toUpperCase() || "?"}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{q.employeeName}</p>
                  <p className="text-xs text-gray-400">{q.employeeEmail || ""}</p>
                </div>
                {q.adminUnread && (
                  <span className="ml-1 text-[10px] font-bold bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full uppercase tracking-wide">
                    New
                  </span>
                )}
              </div>

              {/* Subject & Message */}
              <div className="px-6 py-4">
                <p className="text-sm font-semibold text-gray-800 truncate">{q.subject}</p>
                <p className="text-xs text-gray-400 truncate mt-0.5">{q.message}</p>
              </div>

              {/* Status */}
              <div className="px-6 py-4">
                <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border ${
                  q.status === "resolved"
                    ? "bg-green-50 text-green-700 border-green-200"
                    : "bg-amber-50 text-amber-700 border-amber-200"
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${q.status === "resolved" ? "bg-green-500" : "bg-amber-500"}`} />
                  {q.status === "resolved" ? "Resolved" : "Pending"}
                </span>
              </div>

              {/* Actions */}
              <div className="px-6 py-4 flex items-center gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); setExpandedId(expandedId === q.id ? null : q.id); }}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#1e3a5f] text-white hover:bg-[#16304f] transition-colors"
                >
                  {expandedId === q.id ? "Close" : "View"}
                </button>
                {q.adminUnread && (
                  <button
                    onClick={(e) => { e.stopPropagation(); markAsRead(q.id); }}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-blue-300 text-blue-600 hover:bg-blue-50 transition-colors"
                  >
                    Read
                  </button>
                )}
              </div>
            </div>

            {/* Expanded Panel */}
            {expandedId === q.id && (
              <div className="bg-blue-50/40 border-b border-gray-200 px-6 py-5">
                <div className="max-w-2xl space-y-4">
                  {/* Full Message */}
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Message</p>
                    <p className="text-sm text-gray-700 leading-relaxed">{q.message}</p>
                  </div>

                  {/* Admin Reply (if exists) */}
                  {q.adminReply && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                      <p className="text-xs font-bold text-green-600 uppercase tracking-wider mb-1">Reply Sent</p>
                      <p className="text-sm text-gray-700">{q.adminReply}</p>
                    </div>
                  )}

                  {/* Reply Form */}
                  {q.status === "pending" && (
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Write Reply</p>
                      <textarea
                        placeholder="Type your reply here..."
                        value={replyText[q.id] || ""}
                        onChange={(e) =>
                          setReplyText({ ...replyText, [q.id]: e.target.value })
                        }
                        rows={3}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full border border-gray-200 bg-white rounded-xl px-4 py-3 text-sm text-gray-700 placeholder-gray-300 resize-none focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f] transition"
                      />
                      <button
                        onClick={(e) => { e.stopPropagation(); handleReply(q.id); }}
                        className="px-5 py-2.5 bg-[#1e3a5f] hover:bg-[#16304f] text-white text-sm font-semibold rounded-xl transition-colors"
                      >
                        Reply & Resolve
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Pagination */}
        {queries.length > 0 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-5 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <span className="text-sm text-gray-400 font-medium">
              Page {currentPage} of {totalPages || 1}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="px-5 py-2 rounded-xl bg-[#1e3a5f] text-white text-sm font-semibold hover:bg-[#16304f] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}