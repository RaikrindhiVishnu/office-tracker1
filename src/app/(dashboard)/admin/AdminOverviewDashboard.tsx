"use client";

import React, { useEffect, useState } from "react";
import { collection, query, where, getDocs, onSnapshot, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";

type Props = {
  totalEmployees: number;
  onlineEmployees: number;
  offlineEmployees: number;
  pendingLeaves: number;
  setView: (view: any) => void;
  chatNotifications: any[];
  user: any;
  isCheckedIn: boolean;
  totalSeconds: number;
};

// ─── Design Tokens (matches Employee Dashboard) ────────────────────────────────
const T = {
  bg: "transparent",
  card: "#FFFFFF",
  border: "rgba(0,0,0,0.07)",
  borderLight: "rgba(0,0,0,0.04)",
  text: "#1D1D1F",
  text2: "#6E6E73",
  text3: "#AEAEB2",
  accent: "#282B3E",
  accentLight: "#F0F2F8",
  green: "#282B3E",
  greenLight: "#F0F2F8",
  orange: "#4A4D64",
  orangeLight: "#F8F9FB",
  red: "#1D1D27",
  redLight: "#E2E6F0",
  font: "'Plus Jakarta Sans', system-ui, sans-serif",
  radius: "18px",
  radiusSm: "10px",
  shadow: "0 1px 2px rgba(0,0,0,0.04)",
};

const CARD: React.CSSProperties = {
  background: T.card,
  border: `1px solid ${T.border}`,
  borderRadius: T.radius,
  padding: "20px",
  boxShadow: T.shadow,
  position: "relative",
  overflow: "hidden",
};

const CARD_LABEL: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, letterSpacing: "-0.01em",
  textTransform: "none", color: T.text2,
  marginBottom: 12, display: "block",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getInitials(name: string) {
  return (name ?? "").split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

function formatTotal(min = 0) {
  const m = min < 0 ? 0 : min;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CARD 1 — Admin Profile & Info
// ═══════════════════════════════════════════════════════════════════════════════
function AdminProfileCard({ user, isCheckedIn, totalSeconds }: { user: any; isCheckedIn: boolean; totalSeconds: number }) {
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    if (!user?.uid) return;
    return onSnapshot(
      query(collection(db, "users"), where("uid", "==", user.uid)),
      (snap) => { if (!snap.empty) setProfile(snap.docs[0].data()); }
    );
  }, [user]);

  const name = profile?.name ?? profile?.displayName ?? user?.displayName ?? "Admin";
  const role = profile?.designation ?? profile?.role ?? "Administrator";
  const dept = profile?.department ?? "Management";
  const empId = profile?.employeeId ?? profile?.empId ?? "ADMIN";
  const totalWorked = Math.max(0, Math.floor(totalSeconds / 60));

  const details = [
    { icon: "📱", label: "Mobile", value: profile?.phone ?? profile?.mobile ?? "—" },
    { icon: "✉️", label: "Email", value: profile?.email ?? user?.email ?? "—" },
    { icon: "📍", label: "Location", value: profile?.address ?? profile?.workLocation ?? "—" },
    { icon: "📅", label: "Joined", value: profile?.dateOfJoining ?? profile?.joinDate ?? "—" },
  ];

  return (
    <div className="hover-card welcome-card" style={{ ...CARD, padding: 0, display: "flex", flexDirection: "column" }}>
      {/* Profile header */}
      <div className="profile-header" style={{ background: "linear-gradient(135deg, #f0f4ff 0%, #e8f0fb 100%)", padding: "24px 20px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 14 }}>
        <div className="avatar-box" style={{ width: 60, height: 60, borderRadius: 16, background: T.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800, color: "#fff", flexShrink: 0, boxShadow: "0 8px 16px -4px rgba(0,113,227,0.3)", border: "2px solid #fff" }}>
          {getInitials(name) || "A"}
        </div>
        <div style={{ minWidth: 0 }}>
          <div className="name-text" style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-0.3px", color: T.text }}>{name}</div>
          <div className="role-text" style={{ fontSize: 12, fontWeight: 600, color: T.accent, marginTop: 3 }}>{role}</div>
          {(dept || empId) && (
            <div className="tags-row" style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
              {dept && <span className="tag-item" style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: "rgba(0,0,0,0.06)", color: T.text2 }}>{dept}</span>}
              {empId && <span className="tag-item" style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: "rgba(0,0,0,0.06)", color: T.text2 }}>{empId}</span>}
            </div>
          )}
        </div>
      </div>

      {/* Info rows */}
      <div className="info-rows" style={{ padding: "16px 20px", flex: 1, display: "flex", flexDirection: "column", gap: 0 }}>
        <span style={{ ...CARD_LABEL, marginBottom: 10 }}>Admin Info</span>
        {details.map(({ icon, label, value }) => (
          <div key={label} className="info-row-item" style={{ display: "grid", gridTemplateColumns: "20px 72px 1fr", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: `1px solid ${T.borderLight}` }}>
            <span style={{ fontSize: 13, textAlign: "center" }}>{icon}</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: T.text3 }}>{label}</span>
            <span style={{ fontSize: 12, fontWeight: 500, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</span>
          </div>
        ))}
      </div>

      {/* Status strip */}
      <div className="status-strip" style={{ margin: "0 16px 16px", background: T.greenLight, borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: isCheckedIn ? T.green : T.text3, flexShrink: 0, boxShadow: isCheckedIn ? "0 0 0 3px rgba(40,43,62,0.15)" : "none" }} />
        <div>
          <div className="status-text" style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{isCheckedIn ? "Checked In" : "Checked Out"}</div>
          <div className="status-subtext" style={{ fontSize: 12, color: T.text2, marginTop: 1 }}>{isCheckedIn ? `${formatTotal(totalWorked)} online today` : "Not checked in"}</div>
        </div>
        <div className="time-text" style={{ marginLeft: "auto", fontSize: 13, fontWeight: 800, color: T.green }}>{formatTotal(totalWorked)}</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CARD 2 — Company Attendance Summary (Col 1, Row 3)
// ═══════════════════════════════════════════════════════════════════════════════
function CompanyAttendanceCard({ totalEmployees, onlineEmployees, offlineEmployees }: any) {
  const pct = totalEmployees > 0 ? (onlineEmployees / totalEmployees) * 100 : 0;
  
  return (
    <div className="hover-card" style={{ ...CARD }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <span style={CARD_LABEL}>Company Attendance</span>
      </div>
      <div style={{ textAlign: "center", padding: "10px 0 20px" }}>
        <div style={{ fontSize: 36, fontWeight: 800, color: T.text, lineHeight: 1 }}>
          {onlineEmployees}
          <span style={{ fontSize: 18, color: T.text3 }}>/{totalEmployees}</span>
        </div>
        <div style={{ fontSize: 12, color: T.text2, marginTop: 4, fontWeight: 600 }}>Present Today</div>
      </div>
      <div style={{ height: 6, borderRadius: 99, background: T.redLight, overflow: "hidden", marginBottom: 12 }}>
        <div style={{ height: "100%", width: `${pct}%`, borderRadius: 99, background: T.green, transition: "width 1s cubic-bezier(0.4, 0, 0.2, 1)" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 700 }}>
        <span style={{ color: T.green }}>● {onlineEmployees} Online</span>
        <span style={{ color: T.red }}>● {offlineEmployees} Offline</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CARD 3 — Pending Approvals
// ═══════════════════════════════════════════════════════════════════════════════
function PendingApprovalsCard({ pendingLeaves, setView }: any) {
  const [pendingExpenses, setPendingExpenses] = useState(0);

  useEffect(() => {
    const fetchExpenses = async () => {
      try {
        const q = query(collection(db, "expenseClaims"), where("status", "==", "Submitted"));
        const snap = await getDocs(q);
        setPendingExpenses(snap.size);
      } catch (err) {}
    };
    fetchExpenses();
  }, []);

  const total = pendingLeaves + pendingExpenses;

  return (
    <div className="hover-card" style={{ ...CARD }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <span style={CARD_LABEL}>Pending Approvals</span>
        <button
          onClick={() => setView("approval-center")}
          style={{ fontSize: 11.5, fontWeight: 800, padding: "6px 14px", borderRadius: 10, background: T.accentLight, color: T.accent, border: "none", cursor: "pointer", fontFamily: T.font, boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}
        >
          View All
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 7 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Leave Requests</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: pendingLeaves > 0 ? T.orange : T.text3 }}>{pendingLeaves} Pending</span>
          </div>
          <div style={{ height: 6, borderRadius: 99, background: "rgba(0,0,0,0.06)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: pendingLeaves > 0 ? "50%" : "0%", borderRadius: 99, background: T.orange, transition: "width 1s cubic-bezier(0.4, 0, 0.2, 1)" }} />
          </div>
        </div>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 7 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Expense Claims</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: pendingExpenses > 0 ? T.accent : T.text3 }}>{pendingExpenses} Pending</span>
          </div>
          <div style={{ height: 6, borderRadius: 99, background: "rgba(0,0,0,0.06)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: pendingExpenses > 0 ? "50%" : "0%", borderRadius: 99, background: T.accent, transition: "width 1s cubic-bezier(0.4, 0, 0.2, 1)" }} />
          </div>
        </div>
      </div>

      <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid rgba(0,0,0,0.05)`, display: "flex", gap: 8 }}>
        <div onClick={() => setView("monthlyReport")} style={{ flex: 1, background: "#FAFAFA", borderRadius: 12, padding: "12px", border: `1px solid rgba(0,0,0,0.05)`, cursor: "pointer", display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: T.text2, fontWeight: 600 }}>Leaves</span>
            <span style={{ color: T.text }}>🌴</span>
          </div>
          <span style={{ fontSize: 16, fontWeight: 800, color: T.text }}>{pendingLeaves}</span>
        </div>
        <div onClick={() => setView("expenses")} style={{ flex: 1, background: "#FAFAFA", borderRadius: 12, padding: "12px", border: `1px solid rgba(0,0,0,0.05)`, cursor: "pointer", display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: T.text2, fontWeight: 600 }}>Expenses</span>
            <span style={{ color: T.text }}>💸</span>
          </div>
          <span style={{ fontSize: 16, fontWeight: 800, color: T.text }}>{pendingExpenses}</span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CARD 4 — Recent Meet Messages
// ═══════════════════════════════════════════════════════════════════════════════
function MeetMessagesCard({ chatNotifications }: { chatNotifications: any[] }) {
  return (
    <div className="hover-card" style={{ ...CARD }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <span style={CARD_LABEL}>Meet Messages</span>
        <button
          onClick={() => window.open("/meet", "_blank")}
          style={{ fontSize: 11.5, fontWeight: 800, padding: "6px 14px", borderRadius: 10, background: T.accentLight, color: T.accent, border: "none", cursor: "pointer", fontFamily: T.font, boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}
        >
          Open Chat
        </button>
      </div>

      {chatNotifications.length === 0 ? (
        <div style={{ textAlign: "center", padding: "32px 0" }}>
          <p style={{ fontSize: 32, marginBottom: 8 }}>💬</p>
          <p style={{ fontSize: 13, color: T.text2 }}>No new messages</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 220, overflowY: "auto", paddingRight: 4 }}>
          {chatNotifications.slice(0, 5).map((notif: any, i: number) => (
            <div key={i} style={{ display: "flex", gap: 10, padding: "10px 12px", borderRadius: 10, background: "#FAFAFA", border: `1px solid ${T.borderLight}` }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: T.accentLight, color: T.accent, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
                {notif.fromName?.charAt(0) || "U"}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{notif.fromName || "Unknown User"}</div>
                <div style={{ fontSize: 12, color: T.text2, marginTop: 2, lineHeight: 1.4, wordBreak: "break-word" }}>{notif.message}</div>
                <div style={{ fontSize: 10, color: T.text3, marginTop: 4, fontWeight: 500 }}>
                  {notif.timestamp?.toDate ? notif.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Just now"}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CARD 5 — Employee Directory
// ═══════════════════════════════════════════════════════════════════════════════
function EmployeeDirectoryCard({ setView }: any) {
  const [employees, setEmployees] = useState<any[]>([]);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    const q = query(collection(db, "attendance"), where("date", "==", todayStr));
    return onSnapshot(q, (snap) => {
      const onlineSet = new Set<string>();
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        const sessions = data.sessions || [];
        const last = sessions[sessions.length - 1];
        if (last && last.checkOut === null) onlineSet.add(data.userId);
      });
      setOnlineUserIds(onlineSet);
    });
  }, []);

  useEffect(() => {
    return onSnapshot(collection(db, "users"), (snap) => {
      setEmployees(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  const onlineCount = onlineUserIds.size;

  return (
    <div className="hover-card" style={{ ...CARD, padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "18px 20px 12px", borderBottom: `1px solid rgba(0,0,0,0.05)`, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <span style={{ ...CARD_LABEL, margin: 0 }}>Employee Directory</span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: T.text2, background: "rgba(0,0,0,0.04)", padding: "2px 9px", borderRadius: 6 }}>{employees.length} Total</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: T.green, background: T.greenLight, padding: "2px 9px", borderRadius: 6 }}>● {onlineCount} Online</span>
          </div>
        </div>
        <button onClick={() => setView("employees")} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: T.radiusSm, border: `1px solid ${T.border}`, background: "#FAFAFA", fontSize: 11, fontWeight: 700, color: T.text, cursor: "pointer" }}>
          View Directory
        </button>
      </div>

      <div style={{ padding: "12px 14px", height: 260, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
        {employees.map((e) => {
          const isOnline = onlineUserIds.has(e.uid);
          return (
            <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 10, background: "#FAFAFA", border: `1px solid rgba(0,0,0,0.04)` }}>
              <div style={{ position: "relative" }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: isOnline ? T.greenLight : T.accentLight, color: isOnline ? T.green : T.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800 }}>
                  {getInitials(e.name || e.email || "U")}
                </div>
                <div style={{ position: "absolute", bottom: -2, right: -2, width: 10, height: 10, borderRadius: "50%", background: isOnline ? "#10B981" : "#9CA3AF", border: "2px solid #FAFAFA" }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.name || e.email || "Unknown"}</div>
                <div style={{ fontSize: 11.5, color: T.text3, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.designation || "Employee"}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CARD 6 — All Projects
// ═══════════════════════════════════════════════════════════════════════════════
function ActiveProjectsCard({ setView }: any) {
  const [projects, setProjects] = useState<any[]>([]);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const snap = await getDocs(query(collection(db, "projects")));
        setProjects(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {}
    };
    fetchProjects();
  }, []);

  const fmtDue = (raw: any) => {
    if (!raw) return null;
    if (raw?.toDate) return raw.toDate().toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    try { return new Date(raw).toLocaleDateString("en-IN", { day: "numeric", month: "short" }); } catch { return String(raw); }
  };

  return (
    <div className="hover-card" style={{ ...CARD, padding: "20px 20px 0 20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <span style={CARD_LABEL}>All Projects</span>
        <button onClick={() => setView("Project Management")} style={{ fontSize: 10, fontWeight: 700, padding: "2px 9px", borderRadius: 6, background: T.accentLight, color: T.accent, border: "none", cursor: "pointer" }}>
          {projects.length} projects
        </button>
      </div>

      {projects.length === 0 ? (
        <div style={{ textAlign: "center", padding: "28px 0" }}>
          <p style={{ fontSize: 28, marginBottom: 8 }}>📁</p>
          <p style={{ fontSize: 13, color: T.text2 }}>No projects found</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, height: 350, overflowY: "auto", padding: "4px 4px 20px 4px" }}>
          {projects.map((p) => {
            const title = p.name ?? p.title ?? p.projectName ?? "Untitled";
            const progress = Math.min(Number(p.progress ?? p.completion ?? p.percent ?? 0), 100);
            const due = fmtDue(p.dueDate ?? p.due ?? p.deadline ?? p.endDate);
            return (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, borderLeft: `3px solid ${T.accent}`, borderTop: `1px solid rgba(0,0,0,0.04)`, borderRight: `1px solid rgba(0,0,0,0.04)`, borderBottom: `1px solid rgba(0,0,0,0.04)`, background: "#FAFAFA" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{title}</span>
                  {due && <div style={{ fontSize: 11, color: T.text3, fontWeight: 500, marginTop: 2 }}>Due {due}</div>}
                </div>
                <div style={{ width: 80, display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                  <div style={{ flex: 1, height: 3, borderRadius: 99, background: "rgba(0,0,0,0.06)", overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 99, width: `${progress}%`, background: T.accent }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: T.text2, minWidth: 28, textAlign: "right" }}>{progress}%</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Modal Shell ──────────────────────────────────────────────────────────────
function Modal({ onClose, children, wide = false }: { onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", fn);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", fn); document.body.style.overflow = ""; };
  }, [onClose]);
  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        background: "rgba(17,24,39,0.5)", backdropFilter: "blur(4px)",
      }}
    >
      <div
        style={{
          width: "100%", maxWidth: wide ? 600 : 440,
          borderRadius: "16px 16px 0 0", background: T.card,
          boxShadow: "0 -8px 40px rgba(0,0,0,0.12)",
          maxHeight: "92vh", display: "flex", flexDirection: "column",
          overflow: "hidden", margin: "0 auto",
        }}
      >
        <div style={{ overflowY: "auto", flex: 1 }}>{children}</div>
      </div>
    </div>
  );
}

function ModalHeader({ emoji, title, subtitle, onClose }: { emoji: string; title: string; subtitle: string; onClose: () => void }) {
  return (
    <div
      style={{
        padding: "18px 20px 14px", borderBottom: `1px solid ${T.borderLight}`,
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: T.radiusSm, background: T.accentLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
          {emoji}
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{title}</div>
          <div style={{ fontSize: 12, color: T.text2, marginTop: 1 }}>{subtitle}</div>
        </div>
      </div>
      <button
        onClick={onClose}
        style={{ width: 28, height: 28, borderRadius: "50%", border: `1px solid ${T.border}`, background: "#FAFAFA", cursor: "pointer", fontSize: 16, color: T.text2, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
      >
        ×
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEND MAIL MODAL
// ═══════════════════════════════════════════════════════════════════════════════
function SendMailModal({ onClose, user }: { onClose: () => void; user: any }) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [recipientOption, setRecipientOption] = useState<"all" | "custom">("all");
  const [customEmails, setCustomEmails] = useState("");
  const [priority, setPriority] = useState<"normal" | "high">("normal");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => { if (done) { const t = setTimeout(onClose, 1500); return () => clearTimeout(t); } }, [done, onClose]);

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) { alert("Subject and Body are required."); return; }
    try {
      setSending(true);
      let recipients: any[] = [];
      
      if (recipientOption === "all") {
        const snap = await getDocs(collection(db, "users"));
        recipients = snap.docs.map(d => ({ email: d.data().email, name: d.data().name || d.data().displayName || "Employee" })).filter(r => r.email);
      } else {
        recipients = customEmails.split(",").map(e => ({ email: e.trim(), name: "Employee" })).filter(r => r.email);
      }

      if (recipients.length === 0) { alert("No valid recipients."); setSending(false); return; }

      const res = await fetch("/api/send-custom-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject, body, recipients, priority, sentBy: user?.email || "admin"
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send");
      
      setDone(true);
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setSending(false);
    }
  };

  const INP: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: T.radiusSm, border: `1.5px solid ${T.border}`, background: "#FAFAFA", fontSize: 13, color: T.text, outline: "none", fontFamily: T.font };

  return (
    <>
      <ModalHeader emoji="✉️" title="Send Broadcast Mail" subtitle="Send an email to employees" onClose={onClose} />
      <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 16 }}>
        {done ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 0", gap: 10 }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: T.greenLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>✅</div>
            <p style={{ fontSize: 15, fontWeight: 700, color: T.text }}>Mail Sent Successfully!</p>
          </div>
        ) : (
          <>
            <div>
              <label style={{ ...CARD_LABEL, marginBottom: 6 }}>Subject *</label>
              <input style={INP} placeholder="e.g. Important Company Update" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div>
              <label style={{ ...CARD_LABEL, marginBottom: 6 }}>Recipients</label>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <button onClick={() => setRecipientOption("all")} style={{ flex: 1, padding: "8px", borderRadius: 8, border: `1px solid ${recipientOption === "all" ? T.accent : T.border}`, background: recipientOption === "all" ? T.accentLight : "#FAFAFA", color: recipientOption === "all" ? T.accent : T.text2, fontSize: 12, fontWeight: 700 }}>All Employees</button>
                <button onClick={() => setRecipientOption("custom")} style={{ flex: 1, padding: "8px", borderRadius: 8, border: `1px solid ${recipientOption === "custom" ? T.accent : T.border}`, background: recipientOption === "custom" ? T.accentLight : "#FAFAFA", color: recipientOption === "custom" ? T.accent : T.text2, fontSize: 12, fontWeight: 700 }}>Custom Emails</button>
              </div>
              {recipientOption === "custom" && (
                <input style={INP} placeholder="john@example.com, jane@example.com" value={customEmails} onChange={(e) => setCustomEmails(e.target.value)} />
              )}
            </div>
            <div>
              <label style={{ ...CARD_LABEL, marginBottom: 6 }}>Priority</label>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setPriority("normal")} style={{ flex: 1, padding: "8px", borderRadius: 8, border: `1px solid ${priority === "normal" ? T.green : T.border}`, background: priority === "normal" ? T.greenLight : "#FAFAFA", color: priority === "normal" ? T.green : T.text2, fontSize: 12, fontWeight: 700 }}>Normal</button>
                <button onClick={() => setPriority("high")} style={{ flex: 1, padding: "8px", borderRadius: 8, border: `1px solid ${priority === "high" ? T.red : T.border}`, background: priority === "high" ? T.redLight : "#FAFAFA", color: priority === "high" ? T.red : T.text2, fontSize: 12, fontWeight: 700 }}>High Priority</button>
              </div>
            </div>
            <div>
              <label style={{ ...CARD_LABEL, marginBottom: 6 }}>Message *</label>
              <textarea style={{ ...INP, resize: "vertical" }} rows={5} placeholder="Write your message here..." value={body} onChange={(e) => setBody(e.target.value)} />
            </div>
            <button
              onClick={handleSend}
              disabled={sending}
              style={{ padding: "12px", borderRadius: 10, background: sending ? "#93C5FD" : T.accent, color: "#fff", border: "none", fontSize: 13, fontWeight: 700, cursor: sending ? "not-allowed" : "pointer" }}
            >
              {sending ? "Sending emails..." : "Send Broadcast"}
            </button>
          </>
        )}
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CARD 7 — Upcoming Holidays
// ═══════════════════════════════════════════════════════════════════════════════
const CANONICAL_HOLIDAYS = [
  { date: `${new Date().getFullYear()}-08-15`, title: "Independence Day", type: "National" },
  { date: `${new Date().getFullYear()}-10-02`, title: "Gandhi Jayanti", type: "National" },
  { date: `${new Date().getFullYear()}-12-25`, title: "Christmas", type: "Festival" }
];

function UpcomingHolidaysCard() {
  const [holidays, setHolidays] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDocs(query(collection(db, "holidays"), orderBy("date", "asc")))
      .then((snap) => { setHolidays(snap.empty ? CANONICAL_HOLIDAYS : snap.docs.map((d) => ({ id: d.id, ...d.data() }))); setLoading(false); })
      .catch(() => { setHolidays(CANONICAL_HOLIDAYS); setLoading(false); });
  }, []);

  const todayMs = new Date().setHours(0, 0, 0, 0);
  const upcoming = holidays.filter((h) => new Date(h.date + "T00:00:00").getTime() >= todayMs).slice(0, 5);
  const TYPE_BADGE: Record<string, { bg: string; color: string }> = {
    National: { bg: T.accentLight, color: T.accent },
    Festival: { bg: T.orangeLight, color: T.orange },
    Optional: { bg: T.greenLight, color: T.green },
  };

  return (
    <div className="hover-card" style={{ ...CARD }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <span style={CARD_LABEL}>Upcoming Holidays</span>
        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 9px", borderRadius: 6, background: T.orangeLight, color: T.orange }}>{upcoming.length} remaining</span>
      </div>
      {loading ? (
        <p style={{ color: T.text2, fontSize: 12, textAlign: "center", padding: "12px 0" }}>Loading…</p>
      ) : (
        <div>
          {upcoming.map((h, i) => {
            const d = new Date(h.date + "T00:00:00");
            const daysLeft = Math.ceil((d.getTime() - Date.now()) / 86400000);
            const ts = TYPE_BADGE[h.type] || TYPE_BADGE.National;
            const isLast = i === upcoming.length - 1;
            return (
              <div key={h.id ?? i} style={{ display: "flex", alignItems: "center", padding: "8px 0", borderBottom: isLast ? "none" : `1px solid ${T.borderLight}`, gap: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: T.accent, minWidth: 48, flexShrink: 0 }}>{d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                <span style={{ fontSize: 12.5, color: T.text, fontWeight: 500, flex: 1 }}>{h.title}</span>
                {daysLeft >= 0 && daysLeft <= 14 && (
                  <span style={{ fontSize: 10.5, fontWeight: 600, color: T.green, flexShrink: 0 }}>
                    {daysLeft === 0 ? "Today 🎉" : daysLeft === 1 ? "Tomorrow" : `${daysLeft}d`}
                  </span>
                )}
                <span style={{ fontSize: 9.5, fontWeight: 700, padding: "2px 7px", borderRadius: 5, background: ts.bg, color: ts.color, flexShrink: 0 }}>{h.type ?? "Holiday"}</span>
              </div>
            );
          })}
          {upcoming.length === 0 && <p style={{ textAlign: "center", color: T.text2, fontSize: 12.5, padding: "16px 0" }}>No upcoming holidays</p>}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CARD 8 — Quick Actions
// ═══════════════════════════════════════════════════════════════════════════════
function QuickActionsCard({ onOpenMail }: { onOpenMail: () => void }) {
  return (
    <div className="hover-card" style={{ ...CARD, padding: "20px 20px 24px 20px" }}>
      <span style={CARD_LABEL}>Quick Actions</span>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <button onClick={onOpenMail} style={{ padding: "16px 12px", borderRadius: 12, background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)", color: "#fff", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", gap: 8, alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(15,23,42,0.2)" }}>
          <span style={{ fontSize: 24 }}>✉️</span>
          <span style={{ fontSize: 12, fontWeight: 700 }}>Send Mail</span>
        </button>
        <button onClick={() => window.open("/meet", "_blank")} style={{ padding: "16px 12px", borderRadius: 12, background: "#FAFAFA", border: `1px solid ${T.border}`, cursor: "pointer", display: "flex", flexDirection: "column", gap: 8, alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 24 }}>📹</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: T.text }}>Start Meet</span>
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function AdminOverviewDashboard({
  totalEmployees,
  onlineEmployees,
  offlineEmployees,
  pendingLeaves,
  setView,
  chatNotifications,
  user,
  isCheckedIn,
  totalSeconds
}: Props) {
  const [activeModal, setActiveModal] = useState<string | null>(null);
  
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";
  const dateStr = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const greetEmoji = hour < 12 ? "🌅" : hour < 17 ? "☀️" : "🌙";

  return (
    <div style={{ fontFamily: T.font, background: "transparent", color: T.text }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 2px; }
        @media (max-width: 1024px) {
          .dashboard-grid { grid-template-columns: 1fr !important; gap: 10px !important; }
          .right-col-grid { grid-column: 1 / -1 !important; grid-template-columns: 1fr !important; gap: 10px !important; }
          .full-mobile-card { grid-column: 1 / -1 !important; }
          .mobile-header { margin-bottom: 0 !important; gap: 12px !important; }
          .welcome-card { background: linear-gradient(135deg, #0f172a 0%, #3b82f6 100%) !important; border: none !important; color: white !important; }
          .welcome-card .profile-header { padding: 16px 16px 12px !important; background: transparent !important; border-bottom: none !important; }
          .welcome-card .name-text { color: white !important; font-size: 18px !important; }
          .welcome-card .role-text { color: rgba(255,255,255,0.85) !important; font-size: 13px !important; }
          .welcome-card .info-rows { display: none !important; }
          .welcome-card .status-strip { margin: 0 16px 16px !important; padding: 12px 14px !important; background: rgba(255,255,255,0.12) !important; border: 1px solid rgba(255,255,255,0.2) !important; box-shadow: 0 4px 12px rgba(0,0,0,0.1) !important; }
          .welcome-card .status-text { color: white !important; font-size: 14px !important; }
          .welcome-card .status-subtext { color: rgba(255,255,255,0.7) !important; }
          .welcome-card .time-text { color: white !important; font-size: 16px !important; }
        }
        .hover-card { transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important; }
        .hover-card:hover { transform: translateY(-4px); box-shadow: 0 20px 40px -12px rgba(0,0,0,0.15) !important; z-index: 10; }
        button { transition: all 0.2s ease; }
        button:not(:disabled):hover { transform: translateY(-2px); filter: brightness(1.05); box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
      `}</style>

      {/* Modals */}
      {activeModal === "sendMail" && (
        <Modal onClose={() => setActiveModal(null)} wide>
          <SendMailModal onClose={() => setActiveModal(null)} user={user} />
        </Modal>
      )}

      {/* Header */}
      <div className="mobile-header" style={{ display: "flex", alignItems: "center", justifyContent: "flex-start", marginTop: 4, marginBottom: 24, gap: 64, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: T.text, letterSpacing: "-0.04em", margin: 0, lineHeight: 1.2, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 24 }}>{greetEmoji}</span>
            <span>{greeting}, {user?.email?.split("@")[0] || "Admin"}</span>
          </h1>
          <p style={{ fontSize: 14, color: T.text2, marginTop: 6, fontWeight: 600, letterSpacing: "0.01em" }}>{dateStr}</p>
        </div>
      </div>

      {/* Grid Layout matches exactly DashboardView.tsx */}
      <div className="dashboard-grid" style={{ display: "grid", gridTemplateColumns: "320px 1fr 1fr", gap: 14, alignItems: "start" }}>
        
        {/* Left Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <AdminProfileCard user={user} isCheckedIn={isCheckedIn} totalSeconds={totalSeconds} />
          <CompanyAttendanceCard totalEmployees={totalEmployees} onlineEmployees={onlineEmployees} offlineEmployees={offlineEmployees} />
          <UpcomingHolidaysCard />
        </div>

        {/* Right Column Grid */}
        <div className="right-col-grid" style={{ gridColumn: "2 / 4", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div className="full-mobile-card"><PendingApprovalsCard pendingLeaves={pendingLeaves} setView={setView} /></div>
          <div className="full-mobile-card"><MeetMessagesCard chatNotifications={chatNotifications} /></div>
          <div className="full-mobile-card"><ActiveProjectsCard setView={setView} /></div>
          <div className="full-mobile-card" style={{ minWidth: 0 }}><EmployeeDirectoryCard setView={setView} /></div>
        </div>

      </div>
    </div>
  );
}
