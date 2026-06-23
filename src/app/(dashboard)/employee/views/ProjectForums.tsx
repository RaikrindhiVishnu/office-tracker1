"use client";
import { useEffect, useState } from "react";
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function ProjectForums({ projectId, user, projectColor }: { projectId: string; user: any; projectColor: string }) {
  const [threads, setThreads] = useState<any[]>([]);
  const [activeThread, setActiveThread] = useState<any>(null);
  const [newThreadTitle, setNewThreadTitle] = useState("");
  const [newThreadContent, setNewThreadContent] = useState("");
  const [replyContent, setReplyContent] = useState("");

  useEffect(() => {
    if (!projectId) return;
    const q = query(collection(db, "projectForums"), where("projectId", "==", projectId), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snap) => {
      setThreads(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, [projectId]);

  const createThread = async () => {
    if (!newThreadTitle.trim() || !newThreadContent.trim()) return;
    await addDoc(collection(db, "projectForums"), {
      projectId,
      title: newThreadTitle.trim(),
      content: newThreadContent.trim(),
      createdBy: user.uid,
      authorName: user.displayName || user.email?.split("@")[0] || "Unknown",
      createdAt: serverTimestamp(),
      replies: []
    });
    setNewThreadTitle("");
    setNewThreadContent("");
  };

  const addReply = async () => {
    if (!replyContent.trim() || !activeThread) return;
    const updatedReplies = [
      ...(activeThread.replies || []),
      {
        id: Math.random().toString(36).substring(2),
        content: replyContent.trim(),
        authorName: user.displayName || user.email?.split("@")[0] || "Unknown",
        createdAt: new Date().toISOString()
      }
    ];
    await updateDoc(doc(db, "projectForums", activeThread.id), { replies: updatedReplies });
    setReplyContent("");
  };

  if (activeThread) {
    const thread = threads.find(t => t.id === activeThread.id) || activeThread;
    return (
      <div style={{ background: "#fff", borderRadius: "16px", padding: "20px", border: "1px solid #e2e8f0" }}>
        <button onClick={() => setActiveThread(null)} style={{ background: "none", border: "none", color: projectColor, cursor: "pointer", fontWeight: 700, fontSize: "14px", marginBottom: "16px" }}>
          ← Back to Forums
        </button>
        <h2 style={{ fontSize: "20px", fontWeight: 800, marginBottom: "8px" }}>{thread.title}</h2>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "20px" }}>
          <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: projectColor, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: "bold" }}>
            {thread.authorName?.[0]?.toUpperCase()}
          </div>
          <span style={{ fontSize: "12px", color: "#64748b" }}>Posted by {thread.authorName}</span>
        </div>
        <p style={{ fontSize: "14px", color: "#334155", lineHeight: "1.6", background: "#f8fafc", padding: "16px", borderRadius: "12px" }}>
          {thread.content}
        </p>

        <div style={{ marginTop: "30px" }}>
          <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a", marginBottom: "12px" }}>Replies ({thread.replies?.length || 0})</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px" }}>
            {thread.replies?.map((r: any) => (
              <div key={r.id} style={{ padding: "12px", borderRadius: "10px", border: "1px solid #e2e8f0", background: "#fff" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                  <span style={{ fontSize: "12px", fontWeight: 700, color: "#0f172a" }}>{r.authorName}</span>
                  <span style={{ fontSize: "10px", color: "#94a3b8" }}>{new Date(r.createdAt).toLocaleString()}</span>
                </div>
                <p style={{ fontSize: "13px", color: "#475569", margin: 0 }}>{r.content}</p>
              </div>
            ))}
          </div>
          
          <div style={{ display: "flex", gap: "10px" }}>
            <input 
              value={replyContent} 
              onChange={e => setReplyContent(e.target.value)} 
              placeholder="Write a reply..." 
              style={{ flex: 1, padding: "10px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px" }}
              onKeyDown={e => { if (e.key === "Enter") addReply(); }}
            />
            <button onClick={addReply} style={{ background: projectColor, color: "#fff", border: "none", borderRadius: "8px", padding: "0 16px", fontWeight: 700, cursor: "pointer" }}>Reply</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "#fff", borderRadius: "16px", padding: "20px", border: "1px solid #e2e8f0" }}>
      <h2 style={{ fontSize: "18px", fontWeight: 800, marginBottom: "20px", color: "#0f172a" }}>Project Discussion Forums</h2>
      
      <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "30px", background: "#f8fafc", padding: "16px", borderRadius: "12px" }}>
        <input 
          value={newThreadTitle} 
          onChange={e => setNewThreadTitle(e.target.value)} 
          placeholder="Thread Title" 
          style={{ padding: "10px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px", fontWeight: 600 }}
        />
        <textarea 
          value={newThreadContent} 
          onChange={e => setNewThreadContent(e.target.value)} 
          placeholder="What's on your mind?" 
          rows={3}
          style={{ padding: "10px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px", resize: "none" }}
        />
        <button onClick={createThread} disabled={!newThreadTitle.trim() || !newThreadContent.trim()} style={{ alignSelf: "flex-end", background: projectColor, color: "#fff", border: "none", borderRadius: "8px", padding: "8px 16px", fontWeight: 700, cursor: "pointer", opacity: (!newThreadTitle.trim() || !newThreadContent.trim()) ? 0.5 : 1 }}>
          Post Thread
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {threads.map(t => (
          <div key={t.id} onClick={() => setActiveThread(t)} style={{ padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", transition: "all 0.2s" }} onMouseEnter={e => e.currentTarget.style.borderColor = projectColor} onMouseLeave={e => e.currentTarget.style.borderColor = "#e2e8f0"}>
            <div>
              <h3 style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a", margin: 0, marginBottom: "4px" }}>{t.title}</h3>
              <p style={{ fontSize: "12px", color: "#64748b", margin: 0 }}>Started by {t.authorName} • {t.replies?.length || 0} replies</p>
            </div>
            <span style={{ fontSize: "18px", color: "#cbd5e1" }}>→</span>
          </div>
        ))}
        {threads.length === 0 && (
          <p style={{ textAlign: "center", color: "#94a3b8", fontSize: "13px", margin: "20px 0" }}>No discussion threads yet. Start one above!</p>
        )}
      </div>
    </div>
  );
}
