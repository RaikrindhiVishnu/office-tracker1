"use client";
import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

export default function DocumentEditor() {
  const { user, userData } = useAuth();
  const [documents, setDocuments] = useState<any[]>([]);
  const [activeDoc, setActiveDoc] = useState<any>(null);
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Fetch all live docs (in a real app, you'd filter by project)
    const unsub = onSnapshot(query(collection(db, "projectDocs")), (snap) => {
      const docsList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setDocuments(docsList);
    });
    return () => unsub();
  }, []);

  const handleCreateNew = async () => {
    setIsSaving(true);
    try {
      const docRef = await addDoc(collection(db, "projectDocs"), {
        title: "Untitled Document",
        content: "# New Document\nStart typing here...",
        lastModifiedBy: user?.uid,
        lastModifiedByName: (userData as any)?.name || user?.email,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp()
      });
      setActiveDoc({ id: docRef.id, title: "Untitled Document", content: "# New Document\nStart typing here..." });
      setTitle("Untitled Document");
      setContent("# New Document\nStart typing here...");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (!activeDoc) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, "projectDocs", activeDoc.id), {
        title,
        content,
        lastModifiedBy: user?.uid,
        lastModifiedByName: (userData as any)?.name || user?.email,
        updatedAt: serverTimestamp()
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Simple Auto-save effect
  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeDoc && (title !== activeDoc.title || content !== activeDoc.content)) {
        handleSave();
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [title, content]);

  return (
    <div style={{ display: "flex", height: "calc(100vh - 64px)", background: "#f8fafc", fontFamily: "'Inter', sans-serif" }}>
      
      {/* Sidebar: Document List */}
      <div style={{ width: "280px", borderRight: "1px solid #e2e8f0", background: "#fff", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "20px", borderBottom: "1px solid #e2e8f0" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 800, margin: 0, color: "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ color: "#3b82f6" }}>📝</span> Live Docs
          </h2>
          <button 
            onClick={handleCreateNew}
            disabled={isSaving}
            style={{ width: "100%", marginTop: "16px", padding: "10px", background: "#3b82f6", color: "#fff", border: "none", borderRadius: "8px", fontWeight: 700, cursor: "pointer" }}>
            + New Document
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
          {documents.length === 0 ? (
            <p style={{ fontSize: "13px", color: "#94a3b8", textAlign: "center", marginTop: "20px" }}>No documents yet.</p>
          ) : (
            documents.map(d => (
              <div 
                key={d.id} 
                onClick={() => {
                  setActiveDoc(d);
                  setTitle(d.title || "Untitled");
                  setContent(d.content || "");
                }}
                style={{ 
                  padding: "12px", 
                  borderRadius: "8px", 
                  marginBottom: "8px", 
                  cursor: "pointer",
                  background: activeDoc?.id === d.id ? "#eff6ff" : "transparent",
                  border: `1px solid ${activeDoc?.id === d.id ? "#bfdbfe" : "transparent"}`,
                  transition: "all 0.2s"
                }}
              >
                <h3 style={{ fontSize: "14px", fontWeight: 700, color: activeDoc?.id === d.id ? "#1d4ed8" : "#334155", margin: "0 0 4px 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.title}</h3>
                <p style={{ fontSize: "11px", color: "#94a3b8", margin: 0 }}>
                  Edited by {d.lastModifiedByName}
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Editor Area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {!activeDoc ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#94a3b8" }}>
            <span style={{ fontSize: "48px", marginBottom: "16px", opacity: 0.5 }}>📄</span>
            <h2>Select or create a document to start editing</h2>
          </div>
        ) : (
          <>
            {/* Editor Toolbar */}
            <div style={{ padding: "16px 24px", background: "#fff", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <input 
                value={title} 
                onChange={e => setTitle(e.target.value)} 
                style={{ fontSize: "20px", fontWeight: 800, color: "#0f172a", border: "none", outline: "none", width: "50%", background: "transparent" }}
                placeholder="Document Title"
              />
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span style={{ fontSize: "12px", color: "#94a3b8" }}>
                  {isSaving ? "Saving..." : "Saved to cloud"}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: "-8px" }}>
                  <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "#3b82f6", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: 700, border: "2px solid #fff" }} title={(userData as any)?.name}>
                    {(userData as any)?.name?.charAt(0) || "U"}
                  </div>
                </div>
                <button style={{ padding: "6px 12px", background: "#f1f5f9", color: "#475569", border: "none", borderRadius: "6px", fontWeight: 600, fontSize: "13px", cursor: "pointer" }}>Share</button>
              </div>
            </div>

            {/* Split View: Markdown & Preview */}
            <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
              <div style={{ flex: 1, padding: "24px", borderRight: "1px solid #e2e8f0", background: "#fff" }}>
                <textarea 
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  style={{ width: "100%", height: "100%", border: "none", outline: "none", resize: "none", fontSize: "15px", lineHeight: 1.6, color: "#334155", fontFamily: "monospace" }}
                  placeholder="Write using Markdown..."
                />
              </div>
              <div style={{ flex: 1, padding: "24px", background: "#f8fafc", overflowY: "auto" }}>
                <div style={{ 
                  background: "#fff", 
                  padding: "32px", 
                  minHeight: "100%", 
                  borderRadius: "8px", 
                  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                  border: "1px solid #e2e8f0"
                }}>
                  {/* Simple Markdown Preview (Regex parsing for basic stuff) */}
                  <div dangerouslySetInnerHTML={{ 
                    __html: content
                      .replace(/^### (.*$)/gim, '<h3 style="font-size: 1.25em; font-weight: 700; margin-top: 1em; margin-bottom: 0.5em;">$1</h3>')
                      .replace(/^## (.*$)/gim, '<h2 style="font-size: 1.5em; font-weight: 800; margin-top: 1em; margin-bottom: 0.5em; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.3em;">$1</h2>')
                      .replace(/^# (.*$)/gim, '<h1 style="font-size: 2em; font-weight: 900; margin-top: 0.5em; margin-bottom: 0.5em;">$1</h1>')
                      .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
                      .replace(/\*(.*?)\*/gim, '<em>$1</em>')
                      .replace(/\[(.*?)\]\((.*?)\)/gim, '<a href="$2" style="color: #3b82f6; text-decoration: underline;">$1</a>')
                      .replace(/\n/gim, '<br />')
                  }} style={{ color: "#334155", lineHeight: 1.7 }} />
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
