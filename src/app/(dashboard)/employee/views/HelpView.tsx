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
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

const SUBJECT_LIMIT = 100;
const MESSAGE_LIMIT = 1000;
const PREVIEW_LENGTH = 150;

function ExpandableText({
  text,
  previewLength = PREVIEW_LENGTH,
}: {
  text: string;
  previewLength?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > previewLength;

  return (
    <p className="text-sm text-gray-600 whitespace-pre-wrap break-words leading-relaxed">
      {isLong && !expanded ? text.slice(0, previewLength) + "…" : text}
      {isLong && (
        <button
          onClick={() => setExpanded((prev) => !prev)}
          className="ml-1 text-[#1E3A5F] font-semibold underline text-xs"
        >
          {expanded ? "See Less" : "See More"}
        </button>
      )}
    </p>
  );
}

const CATEGORIES = [
  "Attendance Issue",
  "Payroll Query",
  "Leave Problem",
  "Technical Bug",
  "HR Request",
  "Other",
];

export default function HelpView() {
  const { user } = useAuth();

  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [queries, setQueries] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [tab, setTab] = useState<"new" | "history">("new");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.uid) return;
    const q = query(
      collection(db, "employeeQueries"),
      where("employeeId", "==", user.uid),
      orderBy("createdAt", "desc")
    );
    return onSnapshot(q, (snap) => {
      setQueries(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, [user]);

  const handleSubmit = async () => {
    if (!user?.uid) return;
    if (!subject.trim() || !message.trim()) {
      setMsg("Please fill all fields.");
      return;
    }
    try {
      setSubmitting(true);
      setMsg("");
      await addDoc(collection(db, "employeeQueries"), {
        subject,
        message,
        employeeId: user.uid,
        employeeName: user.email?.split("@")[0] || "Employee",
        status: "pending",
        adminReply: "",
        repliedAt: null,
        employeeUnread: false,
        adminUnread: true,
        createdAt: serverTimestamp(),
      });
      setSubject("");
      setMessage("");
      setMsg("✅ Query submitted successfully!");
      setTimeout(() => {
        setMsg("");
        setTab("history");
      }, 1600);
    } catch {
      setMsg("Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) return <div className="p-6 text-gray-400">Loading user...</div>;

  const pending = queries.filter((q) => q.status === "pending").length;
  const resolved = queries.filter((q) => q.status === "resolved").length;
  const canSubmit = subject.trim() && message.trim();

  return (
    <div className="p-5 space-y-4" style={{ fontFamily: "'DM Sans','Segoe UI',sans-serif" }}>

      {/* ── HEADER BANNER ── */}
      <div style={{
        background: "linear-gradient(120deg,#1E3A5F 0%,#1a5c8a 100%)",
        borderRadius: 16,
        padding: "18px 22px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 12,
      }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", letterSpacing: "-0.2px" }}>
            ❓ Help & Support
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>
            Raise a query — we'll get back to you
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {[
            { label: "Pending",  val: pending,  dot: "#fbbf24", bg: "rgba(251,191,36,0.15)",  border: "rgba(251,191,36,0.3)"  },
            { label: "Resolved", val: resolved, dot: "#4ade80", bg: "rgba(74,222,128,0.15)", border: "rgba(74,222,128,0.3)" },
          ].map((s) => (
            <div key={s.label} style={{
              display: "flex", alignItems: "center", gap: 6,
              background: s.bg, border: `1px solid ${s.border}`,
              borderRadius: 20, padding: "5px 12px",
            }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: "#fff" }}>{s.val}</span>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{s.label}</span>
            </div>
          ))}

          <div style={{
            display: "flex", gap: 3, marginLeft: 4,
            background: "rgba(0,0,0,0.18)", borderRadius: 10, padding: 3,
          }}>
            {(["new", "history"] as const).map((key) => (
              <button key={key} onClick={() => setTab(key)} style={{
                padding: "6px 14px", borderRadius: 7, border: "none",
                fontSize: 11, fontWeight: 700, cursor: "pointer",
                background: tab === key ? "#fff" : "transparent",
                color: tab === key ? "#1E3A5F" : "rgba(255,255,255,0.45)",
                transition: "all 0.15s",
              }}>
                {key === "new" ? "✏️ New Query" : "📋 My Queries"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ════ NEW QUERY ════ */}
      {tab === "new" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>

          {/* LEFT */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

            {/* Tips */}
            <div style={{
              background: "#eff6ff", border: "1px solid #bfdbfe",
              borderRadius: 14, padding: "14px 16px",
              display: "flex", gap: 12,
            }}>
              <div style={{
                width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                background: "#1E3A5F",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
              }}>💡</div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#1E3A5F", marginBottom: 5 }}>
                  Tips for a quick response
                </div>
                <ul style={{ margin: 0, padding: "0 0 0 14px", fontSize: 11, color: "#3b82f6", lineHeight: 1.9 }}>
                  <li>Be specific about the issue</li>
                  <li>Include relevant dates or IDs</li>
                  <li>Describe steps to reproduce</li>
                </ul>
              </div>
            </div>

            {/* Subject */}
            <div style={cardStyle}>
              <label style={labelStyle}>Subject</label>
              <input
                value={subject}
                onChange={(e) => {
                  if (e.target.value.length <= SUBJECT_LIMIT) setSubject(e.target.value);
                }}
                placeholder="Brief title of your issue…"
                style={{
                  ...inputStyle,
                  borderColor: subject.length >= SUBJECT_LIMIT ? "#fca5a5" : "#e5e7eb",
                }}
              />
              <div style={{
                textAlign: "right", fontSize: 10, marginTop: 4,
                color: subject.length >= SUBJECT_LIMIT ? "#ef4444" : "#9ca3af",
              }}>
                {subject.length}/{SUBJECT_LIMIT}
              </div>
            </div>

            {/* Quick categories */}
            <div style={cardStyle}>
              <label style={labelStyle}>Quick Category</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {CATEGORIES.map((cat) => (
                  <button key={cat} onClick={() => setSubject(cat)} style={{
                    padding: "5px 13px", borderRadius: 20,
                    fontSize: 11, fontWeight: 600,
                    cursor: "pointer", transition: "all 0.15s",
                    border: "1.5px solid",
                    borderColor: subject === cat ? "#1E3A5F" : "#e5e7eb",
                    background: subject === cat ? "#1E3A5F" : "#f8fafc",
                    color: subject === cat ? "#fff" : "#64748b",
                  }}>
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

            {/* Message */}
            <div style={{ ...cardStyle, flex: 1, display: "flex", flexDirection: "column" }}>
              <label style={labelStyle}>Describe Your Issue</label>
              <div style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column" }}>
                <textarea
                  value={message}
                  onChange={(e) => {
                    if (e.target.value.length <= MESSAGE_LIMIT) setMessage(e.target.value);
                  }}
                  placeholder="What happened, when it happened, and what you expected…"
                  style={{
                    ...inputStyle,
                    flex: 1, resize: "none", minHeight: 160,
                    lineHeight: 1.65, fontFamily: "inherit",
                    borderColor: message.length >= MESSAGE_LIMIT ? "#fca5a5" : "#e5e7eb",
                  } as React.CSSProperties}
                />
                <div style={{
                  position: "absolute", bottom: 10, right: 12,
                  fontSize: 10,
                  color: message.length >= MESSAGE_LIMIT ? "#ef4444" : "#9ca3af",
                }}>
                  {message.length}/{MESSAGE_LIMIT}
                </div>
              </div>
            </div>

            {/* Submit */}
            <div style={cardStyle}>
              {msg && (
                <div style={{
                  marginBottom: 10, padding: "10px 14px", borderRadius: 10,
                  fontSize: 12, fontWeight: 600, textAlign: "center",
                  background: msg.startsWith("✅") ? "#f0fdf4" : "#fef2f2",
                  border: `1px solid ${msg.startsWith("✅") ? "#bbf7d0" : "#fecaca"}`,
                  color: msg.startsWith("✅") ? "#15803d" : "#dc2626",
                }}>{msg}</div>
              )}

              <div style={{
                display: "flex", alignItems: "center", gap: 6,
                marginBottom: 10, fontSize: 11, color: "#94a3b8",
              }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e" }} />
                Typically responded within 1 business day
              </div>

              <button
                onClick={handleSubmit}
                disabled={submitting || !canSubmit}
                style={{
                  width: "100%",
                  padding: "12px 20px",
                  borderRadius: 11,
                  border: "none",
                  fontSize: 13, fontWeight: 700,
                  cursor: submitting || !canSubmit ? "not-allowed" : "pointer",
                  transition: "all 0.18s",
                  background: !canSubmit
                    ? "#f1f5f9"
                    : "linear-gradient(135deg,#1E3A5F,#1a6fa8)",
                  color: !canSubmit ? "#94a3b8" : "#fff",
                  boxShadow: !canSubmit ? "none" : "0 4px 14px rgba(30,58,95,0.3)",
                  opacity: submitting ? 0.65 : 1,
                }}
              >
                {submitting ? "⏳ Submitting…" : "🚀 Submit Query"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════ HISTORY ════ */}
      {tab === "history" && (
        <div>
          {loading ? (
            <div style={{ textAlign: "center", padding: "48px 0", color: "#94a3b8", fontSize: 13 }}>
              <div style={{ fontSize: 26, marginBottom: 8 }}>⏳</div>
              Loading your queries…
            </div>
          ) : queries.length === 0 ? (
            <div style={{
              textAlign: "center", padding: "64px 0",
              background: "#fff", borderRadius: 16,
              border: "1px solid #f1f5f9",
              boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
            }}>
              <div style={{ fontSize: 44, marginBottom: 12 }}>📭</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#1e293b", marginBottom: 6 }}>
                No queries yet
              </div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 20 }}>
                Submit your first query using the "New Query" tab.
              </div>
              <button
                onClick={() => setTab("new")}
                style={{
                  padding: "9px 22px", borderRadius: 10, border: "none",
                  background: "linear-gradient(135deg,#1E3A5F,#1a6fa8)",
                  color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
                  boxShadow: "0 4px 14px rgba(30,58,95,0.25)",
                }}
              >
                ✏️ Raise a Query
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {queries.map((q) => {
                const isResolved = q.status === "resolved";
                const hasReply = !!q.adminReply;
                const exp = expandedId === q.id;
                const ts = q.createdAt
                  ?.toDate?.()
                  ?.toLocaleDateString("en-IN", {
                    day: "numeric", month: "short", year: "numeric",
                  });

                return (
                  <div key={q.id} style={{
                    background: "#fff",
                    borderRadius: 14,
                    border: "1px solid #f1f5f9",
                    borderLeft: `4px solid ${isResolved ? "#22c55e" : "#f59e0b"}`,
                    boxShadow: exp
                      ? "0 4px 20px rgba(0,0,0,0.08)"
                      : "0 1px 6px rgba(0,0,0,0.05)",
                    overflow: "hidden",
                    transition: "box-shadow 0.2s",
                  }}>
                    {/* Header row */}
                    <div
                      onClick={() => setExpandedId(exp ? null : q.id)}
                      style={{
                        display: "flex", justifyContent: "space-between",
                        alignItems: "center", padding: "14px 18px",
                        cursor: "pointer", gap: 12,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                          background: isResolved ? "#dcfce7" : "#fef9c3",
                          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
                        }}>
                          {isResolved ? "✅" : "⏳"}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: 13, fontWeight: 700, color: "#0f172a",
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          }}>
                            {q.subject}
                          </div>
                          <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2, display: "flex", gap: 8 }}>
                            {ts && <span>📅 {ts}</span>}
                            {hasReply && (
                              <span style={{ color: "#16a34a", fontWeight: 600 }}>💬 Admin replied</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
                          background: isResolved ? "#dcfce7" : "#fef9c3",
                          color: isResolved ? "#166534" : "#92400e",
                          border: `1px solid ${isResolved ? "#bbf7d0" : "#fcd34d"}`,
                          textTransform: "capitalize" as const,
                          letterSpacing: "0.3px",
                        }}>
                          {isResolved ? "Resolved" : "Pending"}
                        </span>
                        <span style={{ fontSize: 10, color: "#cbd5e1" }}>{exp ? "▲" : "▼"}</span>
                      </div>
                    </div>

                    {/* Expanded */}
                    {exp && (
                      <div style={{ padding: "0 18px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
                        <div style={{ height: 1, background: "#f1f5f9" }} />

                        <div style={{
                          background: "#f9fafb", border: "1px solid #e5e7eb",
                          borderRadius: 10, padding: "12px 14px",
                        }}>
                          <div style={sectionLabelStyle}>📝 Your Message</div>
                          <ExpandableText text={q.message} />
                        </div>

                        {hasReply ? (
                          <div style={{
                            background: "#f0fdf4", border: "1px solid #bbf7d0",
                            borderRadius: 10, padding: "12px 14px",
                          }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                              <div style={{
                                width: 28, height: 28, borderRadius: 8, background: "#22c55e",
                                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
                              }}>👨‍💼</div>
                              <div>
                                <div style={{ fontSize: 11, fontWeight: 800, color: "#15803d" }}>Admin Reply</div>
                                {q.repliedAt && (
                                  <div style={{ fontSize: 9, color: "#86efac" }}>
                                    {q.repliedAt?.toDate?.()?.toLocaleDateString("en-IN", {
                                      day: "numeric", month: "short",
                                    })}
                                  </div>
                                )}
                              </div>
                            </div>
                            <ExpandableText text={q.adminReply} />
                          </div>
                        ) : (
                          <div style={{
                            background: "#fffbeb", border: "1px solid #fcd34d",
                            borderRadius: 10, padding: "10px 14px",
                            display: "flex", gap: 8, alignItems: "center",
                          }}>
                            <span style={{ fontSize: 15 }}>⏳</span>
                            <span style={{ fontSize: 12, color: "#92400e", fontWeight: 500 }}>
                              Awaiting admin response…
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Shared style tokens ─────────────────────────────────── */
const cardStyle: React.CSSProperties = {
  background: "#fff",
  borderRadius: 14,
  padding: 16,
  boxShadow: "0 1px 8px rgba(0,0,0,0.06)",
  border: "1px solid #f1f5f9",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 10, fontWeight: 800,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.9px",
  marginBottom: 9,
};

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 9, fontWeight: 800,
  color: "#9ca3af",
  textTransform: "uppercase",
  letterSpacing: "0.8px",
  marginBottom: 7,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1.5px solid #e5e7eb",
  borderRadius: 10,
  padding: "10px 13px",
  fontSize: 13,
  color: "#1e293b",
  outline: "none",
  background: "#f9fafb",
  fontFamily: "inherit",
  transition: "border-color 0.15s",
};