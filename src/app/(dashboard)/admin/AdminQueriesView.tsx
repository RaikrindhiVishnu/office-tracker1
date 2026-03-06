"use client";

import { useEffect, useState } from "react";
import {
  collection, query, orderBy, onSnapshot,
  updateDoc, doc, serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { User as FirebaseUser } from "firebase/auth";

const ITEMS_PER_PAGE = 8;

interface Query {
  id: string;
  employeeName?: string;
  employeeEmail?: string;
  subject?: string;
  message?: string;
  status?: string;
  adminReply?: string;
  adminUnread?: boolean;
  createdAt?: { seconds?: number } | string;
  repliedAt?: { seconds?: number } | string;
  [key: string]: unknown;
}

interface AdminQueriesViewProps {
  user: FirebaseUser | null;
  userData: any;
}

const AVATAR_PALETTE: [string, string][] = [
  ["#1a6ed8", "#e8f0fd"],
  ["#8b5cf6", "#ede9fe"],
  ["#059669", "#d1fae5"],
  ["#d97706", "#fef3c7"],
  ["#dc2626", "#fee2e2"],
  ["#0891b2", "#cffafe"],
];

function getAvatar(name: string): [string, string] {
  return AVATAR_PALETTE[(name.charCodeAt(0) || 65) % AVATAR_PALETTE.length] as [string, string];
}

function timeAgo(ts: { seconds?: number } | string | undefined): string {
  if (!ts) return "—";
  const d = typeof ts === "string" ? new Date(ts) : new Date((ts.seconds ?? 0) * 1000);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function AdminQueriesView({ user, userData }: AdminQueriesViewProps) {
  const [queries, setQueries] = useState<Query[]>([]);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [filter, setFilter] = useState<"all" | "pending" | "resolved">("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const q = query(collection(db, "employeeQueries"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) =>
      setQueries(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Query)))
    );
    return () => unsub();
  }, []);

  const handleReply = async (id: string) => {
    if (!replyText[id]?.trim()) return;
    await updateDoc(doc(db, "employeeQueries", id), {
      adminReply: replyText[id],
      status: "resolved",
      employeeUnread: true,
      adminUnread: false,
      repliedAt: serverTimestamp(),
    });
    setReplyText((p) => ({ ...p, [id]: "" }));
    setExpandedId(null);
  };

  const markAsRead = async (id: string) => {
    await updateDoc(doc(db, "employeeQueries", id), { adminUnread: false });
  };

  const filtered = queries.filter((q) => {
    const matchFilter = filter === "all" || q.status === filter;
    const s = search.toLowerCase();
    const matchSearch =
      !s ||
      (q.employeeName || "").toLowerCase().includes(s) ||
      (q.subject || "").toLowerCase().includes(s) ||
      (q.message || "").toLowerCase().includes(s);
    return matchFilter && matchSearch;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const pendingCount  = queries.filter((q) => q.status !== "resolved").length;
  const resolvedCount = queries.filter((q) => q.status === "resolved").length;
  const unreadCount   = queries.filter((q) => q.adminUnread).length;

  // ── inline styles matching the dashboard theme ──
  const S = {
    wrap:      { fontFamily: "'Nunito',-apple-system,sans-serif", padding: "24px 28px 32px", background: "#f0f4f8", minHeight: "100%" } as React.CSSProperties,
    card:      { background: "#fff", borderRadius: 16, border: "1px solid #e2eaf3", boxShadow: "0 1px 4px rgba(15,23,42,0.06)", overflow: "hidden" } as React.CSSProperties,
    thead:     { display: "grid", gridTemplateColumns: "2fr 2.8fr 1fr 160px", background: "#234567" } as React.CSSProperties,
    th:        { padding: "12px 18px", fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.45)", textTransform: "uppercase" as const, letterSpacing: "0.1em" },
    row:       { display: "grid", gridTemplateColumns: "2fr 2.8fr 1fr 160px", alignItems: "center", borderBottom: "1px solid #f1f5f9", cursor: "pointer", transition: "background 0.13s" } as React.CSSProperties,
    td:        { padding: "13px 18px" },
    chip:      (bg: string, color: string, border: string) => ({ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, padding: "4px 11px", borderRadius: 20, background: bg, color, border: `1.5px solid ${border}`, whiteSpace: "nowrap" as const }),
    badge:     (bg: string, color: string) => ({ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 800, padding: "3px 9px", borderRadius: 20, background: bg, color, textTransform: "uppercase" as const, letterSpacing: "0.05em", whiteSpace: "nowrap" as const }),
    dot:       (color: string) => ({ width: 5, height: 5, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }),
    panel:     { background: "#f7faff", borderTop: "1px solid #e2eaf3", borderBottom: "1px solid #e2eaf3", padding: "20px 22px" } as React.CSSProperties,
    msgBox:    { background: "#fff", border: "1.5px solid #e2eaf3", borderRadius: 12, padding: "14px 16px", fontSize: 13, color: "#334155", lineHeight: 1.75, fontWeight: 500 } as React.CSSProperties,
    replyBox:  { background: "#f0fdf4", border: "1.5px solid #bbf7d0", borderRadius: 12, padding: "14px 16px", fontSize: 13, color: "#166534", lineHeight: 1.75, fontWeight: 500 } as React.CSSProperties,
    label:     { fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase" as const, letterSpacing: "0.09em", marginBottom: 8 },
    meta:      { fontSize: 11, color: "#94a3b8", fontWeight: 600, marginTop: 7 },
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap');
        .aq-row-hover:hover { background: #f7faff !important; }
        .aq-btn {
          font-family: 'Nunito', sans-serif;
          font-weight: 700; font-size: 12px;
          padding: 6px 14px; border-radius: 9px;
          border: none; cursor: pointer; transition: all 0.16s;
          white-space: nowrap;
        }
        .aq-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .aq-btn-primary  { background: #1a6ed8; color: #fff; }
        .aq-btn-primary:not(:disabled):hover { background: #1558b0; }
        .aq-btn-dark     { background: #234567; color: #fff; }
        .aq-btn-dark:hover { background: #1a3450; }
        .aq-btn-ghost    { background: #f1f5f9; color: #64748b; border: 1.5px solid #e2eaf3; }
        .aq-btn-ghost:hover { background: #e8ecf4; }
        .aq-btn-outline  { background: transparent; color: #1a6ed8; border: 1.5px solid #c4d9f5; }
        .aq-btn-outline:hover { background: #e8f0fd; }
        .aq-filter-btn {
          font-family: 'Nunito', sans-serif;
          font-size: 12px; font-weight: 700;
          padding: 6px 15px; border-radius: 7px;
          border: none; cursor: pointer; transition: all 0.15s;
        }
        .aq-filter-btn.active { background: #234567; color: #fff; }
        .aq-filter-btn:not(.active) { background: transparent; color: #64748b; }
        .aq-filter-btn:not(.active):hover { background: #f0f4f8; }
        .aq-textarea {
          font-family: 'Nunito', sans-serif;
          width: 100%; padding: 11px 14px;
          border: 1.5px solid #e2eaf3; border-radius: 11px;
          font-size: 13px; font-weight: 500; color: #1e293b;
          background: #fff; resize: none; outline: none;
          transition: border-color 0.18s; box-sizing: border-box;
        }
        .aq-textarea:focus { border-color: #1a6ed8; box-shadow: 0 0 0 3px rgba(26,110,216,0.08); }
        .aq-textarea::placeholder { color: #c8d3e0; }
        .aq-search {
          font-family: 'Nunito', sans-serif;
          padding: 9px 14px 9px 36px;
          border: 1.5px solid #e2eaf3; border-radius: 10px;
          font-size: 13px; color: #1e293b; background: #fff;
          outline: none; width: 220px; font-weight: 500;
          transition: border-color 0.18s;
        }
        .aq-search:focus { border-color: #1a6ed8; box-shadow: 0 0 0 3px rgba(26,110,216,0.08); }
        .aq-search::placeholder { color: #c8d3e0; }
        .aq-page-btn {
          font-family: 'Nunito', sans-serif;
          font-size: 12px; font-weight: 700;
          padding: 6px 13px; border-radius: 8px;
          border: 1.5px solid #e2eaf3; background: #fff;
          color: #475569; cursor: pointer; transition: all 0.15s;
          min-width: 34px; text-align: center;
        }
        .aq-page-btn:disabled { opacity: 0.35; cursor: not-allowed; }
        .aq-page-btn.cur { background: #234567; color: #fff; border-color: #234567; }
        .aq-page-btn:not(.cur):not(:disabled):hover { background: #f0f4f8; }
        @keyframes aqSlide {
          from { opacity: 0; transform: translateY(-5px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .aq-panel-anim { animation: aqSlide 0.18s ease; }
      `}</style>

      <div style={S.wrap}>

        {/* ── HEADER ── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
              <span style={{ fontSize: 20 }}>💬</span>
              <h2 style={{ fontSize: 22, fontWeight: 900, color: "#1e293b", margin: 0, letterSpacing: "-0.3px" }}>Employee Queries</h2>
              {unreadCount > 0 && (
                <span style={S.chip("#e8f0fd", "#1a6ed8", "#c4d9f5")}>
                  <span style={S.dot("#1a6ed8")} />{unreadCount} new
                </span>
              )}
            </div>
            <p style={{ fontSize: 12, color: "#94a3b8", margin: 0, fontWeight: 500 }}>
              {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>

          {/* Search + Filter */}
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", fontSize: 13, pointerEvents: "none" }}>🔍</span>
              <input
                className="aq-search"
                placeholder="Search name, subject…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              />
            </div>
            <div style={{ display: "flex", gap: 3, background: "#fff", border: "1.5px solid #e2eaf3", borderRadius: 10, padding: 3 }}>
              {(["all", "pending", "resolved"] as const).map((f) => (
                <button key={f} className={`aq-filter-btn${filter === f ? " active" : ""}`}
                  onClick={() => { setFilter(f); setCurrentPage(1); }}>
                  {f === "all" ? `All (${queries.length})` : f === "pending" ? `Pending (${pendingCount})` : `Resolved (${resolvedCount})`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── SUMMARY CHIPS ── */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <span style={S.chip("#e8f0fd", "#1a6ed8", "#c4d9f5")}><span style={S.dot("#1a6ed8")} />{queries.length} Total</span>
          <span style={S.chip("#fef3c7", "#92400e", "#fde68a")}><span style={S.dot("#f59e0b")} />{pendingCount} Pending</span>
          <span style={S.chip("#dcfce7", "#15803d", "#bbf7d0")}><span style={S.dot("#22c55e")} />{resolvedCount} Resolved</span>
          {unreadCount > 0 && (
            <span style={S.chip("#fee2e2", "#991b1b", "#fca5a5")}><span style={S.dot("#ef4444")} />{unreadCount} Unread</span>
          )}
        </div>

        {/* ── TABLE CARD ── */}
        <div style={S.card}>

          {/* Head */}
          <div style={S.thead}>
            {["Employee", "Subject & Message", "Status", "Actions"].map((h) => (
              <div key={h} style={S.th}>{h}</div>
            ))}
          </div>

          {/* Empty */}
          {filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px 0", color: "#94a3b8" }}>
              <div style={{ fontSize: 44, marginBottom: 10 }}>📭</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#475569", marginBottom: 4 }}>No queries found</div>
              <div style={{ fontSize: 13 }}>{search ? "Try a different search term" : "Nothing here yet"}</div>
            </div>
          )}

          {/* Rows */}
          {paginated.map((q) => {
            const [ac, abg] = getAvatar(q.employeeName || "U");
            const isOpen = expandedId === q.id;
            return (
              <div key={q.id}>
                <div
                  className="aq-row-hover"
                  style={{ ...S.row, borderLeft: q.adminUnread ? `3px solid ${ac}` : "3px solid transparent", background: isOpen ? "#f7faff" : "transparent" }}
                  onClick={() => { setExpandedId(isOpen ? null : q.id); if (q.adminUnread) markAsRead(q.id); }}
                >
                  {/* Employee */}
                  <div style={{ ...S.td, display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: abg, color: ac, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 900, flexShrink: 0, border: `2px solid ${ac}35` }}>
                      {(q.employeeName || "U")[0].toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#1e293b", display: "flex", alignItems: "center", gap: 5 }}>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.employeeName || "Unknown"}</span>
                        {q.adminUnread && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#1a6ed8", display: "inline-block", flexShrink: 0 }} />}
                      </div>
                      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.employeeEmail || ""}</div>
                    </div>
                  </div>

                  {/* Subject */}
                  <div style={{ ...S.td, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.subject || "—"}</div>
                    <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.message || ""}</div>
                    <div style={{ fontSize: 10, color: "#c8d3e0", marginTop: 3, fontWeight: 600 }}>{timeAgo(q.createdAt as { seconds?: number } | string)}</div>
                  </div>

                  {/* Status */}
                  <div style={S.td}>
                    {q.status === "resolved"
                      ? <span style={S.badge("#dcfce7", "#15803d")}><span style={S.dot("#22c55e")} />Resolved</span>
                      : <span style={S.badge("#fef3c7", "#92400e")}><span style={S.dot("#f59e0b")} />Pending</span>}
                  </div>

                  {/* Actions */}
                  <div style={{ ...S.td, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 5 }}>
                    <button
                      className={`aq-btn ${isOpen ? "aq-btn-ghost" : "aq-btn-dark"}`}
                      onClick={(e) => { e.stopPropagation(); setExpandedId(isOpen ? null : q.id); }}
                      style={{ width: "100%", textAlign: "center" }}
                    >
                      {isOpen ? "Close" : "View"}
                    </button>
                    {q.adminUnread && (
                      <button
                        className="aq-btn"
                        onClick={(e) => { e.stopPropagation(); markAsRead(q.id); }}
                        style={{ width: "100%", textAlign: "center", fontSize: 11, padding: "4px 10px", background: "#e8f0fd", color: "#1a6ed8", border: "1.5px solid #c4d9f5", borderRadius: 7 }}
                      >
                        ✓ Mark Read
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded */}
                {isOpen && (
                  <div className="aq-panel-anim" style={S.panel}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, maxWidth: 820 }}>
                      <div>
                        <div style={S.label}>📩 Original Message</div>
                        <div style={S.msgBox}>{q.message || "—"}</div>
                        <div style={S.meta}>Submitted {timeAgo(q.createdAt as { seconds?: number } | string)}</div>
                      </div>
                      <div>
                        {q.adminReply ? (
                          <>
                            <div style={S.label}>✅ Reply Sent</div>
                            <div style={S.replyBox}>{q.adminReply}</div>
                            <div style={S.meta}>Replied {timeAgo(q.repliedAt as { seconds?: number } | string)}</div>
                          </>
                        ) : (
                          <>
                            <div style={S.label}>✍️ Write a Reply</div>
                            <textarea
                              className="aq-textarea"
                              rows={4}
                              placeholder="Type your reply here…"
                              value={replyText[q.id] || ""}
                              onChange={(e) => setReplyText((p) => ({ ...p, [q.id]: e.target.value }))}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                              <button
                                className="aq-btn aq-btn-primary"
                                disabled={!replyText[q.id]?.trim()}
                                onClick={(e) => { e.stopPropagation(); handleReply(q.id); }}
                                style={{ padding: "9px 18px", fontSize: 13 }}
                              >
                                Send & Resolve ✓
                              </button>
                              <button
                                className="aq-btn aq-btn-ghost"
                                onClick={(e) => { e.stopPropagation(); setExpandedId(null); }}
                              >
                                Cancel
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Pagination */}
          {filtered.length > ITEMS_PER_PAGE && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 20px", borderTop: "1px solid #f1f5f9", background: "#fafbfc", flexWrap: "wrap", gap: 10 }}>
              <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600 }}>
                Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} of {filtered.length}
              </span>
              <div style={{ display: "flex", gap: 4 }}>
                <button className="aq-page-btn" disabled={currentPage === 1} onClick={() => setCurrentPage((p) => p - 1)}>← Prev</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                  .reduce<(number | "…")[]>((acc, p, i, arr) => {
                    if (i > 0 && (p as number) - (arr[i - 1] as number) > 1) acc.push("…");
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, i) => (
                    <button key={i} className={`aq-page-btn${p === currentPage ? " cur" : ""}`}
                      disabled={p === "…"} style={{ cursor: p === "…" ? "default" : "pointer" }}
                      onClick={() => typeof p === "number" && setCurrentPage(p)}>
                      {p}
                    </button>
                  ))}
                <button className="aq-page-btn" disabled={currentPage === totalPages} onClick={() => setCurrentPage((p) => p + 1)}>Next →</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}