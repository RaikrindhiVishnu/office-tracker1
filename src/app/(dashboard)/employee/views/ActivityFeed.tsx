"use client";
import { useEffect, useState } from "react";
import { collection, query, orderBy, onSnapshot, limit, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export function logActivity(projectId: string, userDetails: { uid: string, name: string }, action: string, details: string) {
  try {
    addDoc(collection(db, "activityLogs"), {
      projectId,
      userId: userDetails.uid,
      userName: userDetails.name,
      action,
      details,
      timestamp: serverTimestamp()
    });
  } catch (err) {
    console.error("Failed to log activity:", err);
  }
}

export default function ActivityFeed({ projectId }: { projectId?: string }) {
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    let q = query(collection(db, "activityLogs"), orderBy("timestamp", "desc"), limit(50));
    // In a real app we'd filter by projectId, but for demo let's fetch all or conditionally filter if projectId provided.
    
    const unsub = onSnapshot(q, (snap) => {
      let data: any[] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (projectId) {
        data = data.filter((d: any) => d.projectId === projectId);
      }
      setLogs(data);
    });

    return () => unsub();
  }, [projectId]);

  const getIcon = (action: string) => {
    const a = action.toLowerCase();
    if (a.includes("task") || a.includes("ticket")) return "📋";
    if (a.includes("doc") || a.includes("file")) return "📄";
    if (a.includes("comment") || a.includes("forum")) return "💬";
    if (a.includes("review") || a.includes("pr")) return "🔍";
    if (a.includes("milestone")) return "🚩";
    return "⚡";
  };

  return (
    <div style={{ background: "#fff", borderRadius: "16px", border: "1px solid #e2e8f0", padding: "20px", fontFamily: "'Inter', sans-serif" }}>
      <h3 style={{ fontSize: "16px", fontWeight: 800, color: "#0f172a", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ color: "#3b82f6" }}>⚡</span> Activity Feed
      </h3>
      
      <div style={{ display: "flex", flexDirection: "column", gap: "16px", maxHeight: "400px", overflowY: "auto", paddingRight: "8px" }}>
        {logs.length === 0 ? (
          <p style={{ fontSize: "13px", color: "#94a3b8", textAlign: "center", margin: "20px 0" }}>No recent activity.</p>
        ) : (
          logs.map((log) => (
            <div key={log.id} style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
              <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", flexShrink: 0 }}>
                {getIcon(log.action)}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: "13px", color: "#334155", lineHeight: 1.4 }}>
                  <span style={{ fontWeight: 700, color: "#0f172a" }}>{log.userName}</span> {log.action} <span style={{ fontWeight: 600 }}>{log.details}</span>
                </p>
                <p style={{ margin: 0, marginTop: "2px", fontSize: "11px", color: "#94a3b8" }}>
                  {log.timestamp?.toDate ? log.timestamp.toDate().toLocaleString() : "Just now"}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
