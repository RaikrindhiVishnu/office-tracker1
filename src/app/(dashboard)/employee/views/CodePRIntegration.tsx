"use client";
import { useState } from "react";

const MOCK_PRS = [
  { id: "PR-120", title: "Feature: Add real-time notifications", author: "johndoe", status: "Open", branch: "feat/notifications", time: "2 hours ago", additions: 120, deletions: 15 },
  { id: "PR-119", title: "Fix: Resolve null pointer in dashboard", author: "sarahsmith", status: "Merged", branch: "fix/dashboard-crash", time: "1 day ago", additions: 45, deletions: 12 },
  { id: "PR-118", title: "Refactor: Move auth logic to context", author: "mikelee", status: "Closed", branch: "refactor/auth", time: "3 days ago", additions: 350, deletions: 280 },
];

export default function CodePRIntegration({ projectId, user, projectColor }: { projectId: string; user: any; projectColor: string }) {
  const [activeTab, setActiveTab] = useState<"prs" | "commits">("prs");

  return (
    <div style={{ background: "#fff", borderRadius: "16px", padding: "24px", border: "1px solid #e2e8f0" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <h2 style={{ fontSize: "18px", fontWeight: 800, color: "#0f172a", margin: 0 }}>Code & Pull Requests</h2>
        <button style={{ background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "8px", padding: "6px 12px", fontSize: "12px", fontWeight: 700, color: "#475569", cursor: "pointer" }}>
          ⚙️ Configure Repository
        </button>
      </div>

      <div style={{ display: "flex", gap: "16px", borderBottom: "1px solid #e2e8f0", marginBottom: "20px" }}>
        <button onClick={() => setActiveTab("prs")} style={{ background: "none", border: "none", padding: "8px 0", fontSize: "14px", fontWeight: 700, color: activeTab === "prs" ? projectColor : "#64748b", borderBottom: activeTab === "prs" ? `2px solid ${projectColor}` : "2px solid transparent", cursor: "pointer" }}>Pull Requests</button>
        <button onClick={() => setActiveTab("commits")} style={{ background: "none", border: "none", padding: "8px 0", fontSize: "14px", fontWeight: 700, color: activeTab === "commits" ? projectColor : "#64748b", borderBottom: activeTab === "commits" ? `2px solid ${projectColor}` : "2px solid transparent", cursor: "pointer" }}>Recent Commits</button>
      </div>

      {activeTab === "prs" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {MOCK_PRS.map(pr => (
            <div key={pr.id} style={{ padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fafafa" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                  <span style={{ fontSize: "14px", fontWeight: 800, color: "#0f172a" }}>{pr.title}</span>
                  <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "100px", color: pr.status === "Open" ? "#16a34a" : pr.status === "Merged" ? "#7c3aed" : "#dc2626", background: pr.status === "Open" ? "#dcfce7" : pr.status === "Merged" ? "#ede9fe" : "#fee2e2" }}>{pr.status}</span>
                </div>
                <div style={{ fontSize: "12px", color: "#64748b", display: "flex", alignItems: "center", gap: "12px" }}>
                  <span>#{pr.id}</span>
                  <span>•</span>
                  <span>{pr.author}</span>
                  <span>•</span>
                  <span style={{ color: "#3b82f6", background: "#eff6ff", padding: "1px 6px", borderRadius: "4px", fontFamily: "monospace" }}>{pr.branch}</span>
                  <span>•</span>
                  <span>{pr.time}</span>
                </div>
              </div>
              <div style={{ textAlign: "right", fontSize: "12px", fontWeight: 600, fontFamily: "monospace" }}>
                <span style={{ color: "#16a34a" }}>+{pr.additions}</span>
                <span style={{ color: "#dc2626", marginLeft: "8px" }}>-{pr.deletions}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ padding: "30px", textAlign: "center", color: "#94a3b8", fontSize: "14px" }}>
          <div style={{ fontSize: "32px", marginBottom: "12px" }}>💻</div>
          No recent commits found for this repository.
        </div>
      )}
    </div>
  );
}
