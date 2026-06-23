"use client";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";

export default function MeetView({ users }: { users?: any[] }) {
  const { user, userData } = useAuth();
  const [inCall, setInCall] = useState(false);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [summary, setSummary] = useState<any>(null);

  const startCall = () => setInCall(true);
  const endCall = () => setInCall(false);

  const generateAISummary = () => {
    setGeneratingSummary(true);
    // Mock AI processing delay
    setTimeout(() => {
      setSummary({
        minutes: "Discussed the upcoming Sprint 6 deliverables. Agreed to prioritize the real-time chat feature. Reviewed the Q2 budget and approved the new marketing spend.",
        actionItems: [
          "John to draft the technical spec for real-time chat by Tuesday.",
          "Sarah to review the marketing budget and allocate funds by Thursday.",
          "Team to finalize the Sprint 6 board and assign tasks."
        ],
        sentiment: "Positive and aligned"
      });
      setGeneratingSummary(false);
    }, 2500);
  };

  return (
    <div style={{ height: "calc(100vh - 64px)", display: "flex", flexDirection: "column", background: "#0f172a", fontFamily: "'Inter', sans-serif", color: "#f8fafc" }}>
      {/* Header */}
      <div style={{ padding: "16px 24px", borderBottom: "1px solid #1e293b", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: 800, margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ color: "#3b82f6" }}>📹</span> Office Meet
          </h1>
          <p style={{ fontSize: "12px", color: "#94a3b8", margin: 0, marginTop: "4px" }}>Secure, encrypted video conferencing</p>
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          {!inCall ? (
            <button onClick={startCall} style={{ background: "#3b82f6", color: "#fff", border: "none", padding: "10px 20px", borderRadius: "8px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}>
              Start New Meeting
            </button>
          ) : (
            <button onClick={endCall} style={{ background: "#ef4444", color: "#fff", border: "none", padding: "10px 20px", borderRadius: "8px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}>
              End Call
            </button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Main Video Area */}
        <div style={{ flex: 1, padding: "24px", display: "flex", flexDirection: "column", gap: "16px", overflowY: "auto" }}>
          {!inCall ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyItems: "center", justifyContent: "center", border: "2px dashed #334155", borderRadius: "16px", background: "#1e293b" }}>
              <span style={{ fontSize: "48px", marginBottom: "16px" }}>🎥</span>
              <h2 style={{ fontSize: "24px", fontWeight: 700, color: "#f8fafc", marginBottom: "8px" }}>You are not in a meeting</h2>
              <p style={{ color: "#94a3b8" }}>Start a new meeting or join with a code to connect with your team.</p>
            </div>
          ) : (
            <>
              {/* Video Grid */}
              <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px" }}>
                {/* Me */}
                <div style={{ background: "#000", borderRadius: "16px", overflow: "hidden", position: "relative", border: "2px solid #3b82f6" }}>
                  <img src={(userData as any)?.profilePhoto || "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=800"} alt="Me" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.8 }} />
                  <div style={{ position: "absolute", bottom: "16px", left: "16px", background: "rgba(0,0,0,0.6)", padding: "4px 12px", borderRadius: "8px", fontSize: "12px", fontWeight: 600 }}>
                    You ({(userData as any)?.name || "Me"})
                  </div>
                </div>
                {/* Other Participant */}
                <div style={{ background: "#000", borderRadius: "16px", overflow: "hidden", position: "relative" }}>
                  <img src="https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=800" alt="Participant" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.8 }} />
                  <div style={{ position: "absolute", bottom: "16px", left: "16px", background: "rgba(0,0,0,0.6)", padding: "4px 12px", borderRadius: "8px", fontSize: "12px", fontWeight: 600 }}>
                    Alex Chen
                  </div>
                </div>
              </div>

              {/* Controls */}
              <div style={{ background: "#1e293b", padding: "16px", borderRadius: "16px", display: "flex", justifyContent: "center", gap: "16px" }}>
                <button style={{ width: "48px", height: "48px", borderRadius: "24px", background: "#334155", border: "none", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px" }}>🎤</button>
                <button style={{ width: "48px", height: "48px", borderRadius: "24px", background: "#334155", border: "none", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px" }}>📹</button>
                <button style={{ width: "48px", height: "48px", borderRadius: "24px", background: "#334155", border: "none", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px" }}>🖥️</button>
                <button onClick={endCall} style={{ width: "48px", height: "48px", borderRadius: "24px", background: "#ef4444", border: "none", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px" }}>❌</button>
              </div>
            </>
          )}
        </div>

        {/* AI Sidebar */}
        <div style={{ width: "350px", background: "#1e293b", borderLeft: "1px solid #334155", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "20px", borderBottom: "1px solid #334155" }}>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800, display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ color: "#a855f7" }}>✨</span> AI Meeting Assistant
            </h3>
            <p style={{ margin: 0, marginTop: "4px", fontSize: "12px", color: "#94a3b8" }}>Transcribe and summarize instantly.</p>
          </div>
          
          <div style={{ flex: 1, padding: "20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px" }}>
            {summary ? (
              <div className="animate-fade-in">
                <div style={{ background: "#0f172a", padding: "16px", borderRadius: "12px", border: "1px solid #334155", marginBottom: "16px" }}>
                  <h4 style={{ fontSize: "12px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", marginBottom: "8px", margin: 0 }}>Meeting Minutes</h4>
                  <p style={{ fontSize: "14px", lineHeight: 1.5, color: "#f8fafc", margin: 0 }}>{summary.minutes}</p>
                </div>

                <div style={{ background: "#0f172a", padding: "16px", borderRadius: "12px", border: "1px solid #334155", marginBottom: "16px" }}>
                  <h4 style={{ fontSize: "12px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", marginBottom: "12px", margin: 0 }}>Action Items</h4>
                  <ul style={{ margin: 0, paddingLeft: "16px", fontSize: "14px", color: "#f8fafc", display: "flex", flexDirection: "column", gap: "8px" }}>
                    {summary.actionItems.map((item: string, i: number) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>

                <div style={{ background: "#0f172a", padding: "16px", borderRadius: "12px", border: "1px solid #334155" }}>
                  <h4 style={{ fontSize: "12px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", marginBottom: "8px", margin: 0 }}>Sentiment</h4>
                  <p style={{ fontSize: "14px", fontWeight: 600, color: "#10b981", margin: 0 }}>{summary.sentiment}</p>
                </div>
              </div>
            ) : (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#64748b", textAlign: "center" }}>
                <span style={{ fontSize: "32px", marginBottom: "16px", opacity: 0.5 }}>📝</span>
                <p style={{ fontSize: "13px", maxWidth: "200px" }}>Click "Generate AI Summary" to analyze the ongoing conversation.</p>
              </div>
            )}
          </div>

          <div style={{ padding: "20px", borderTop: "1px solid #334155" }}>
            <button 
              onClick={generateAISummary}
              disabled={generatingSummary}
              style={{
                width: "100%", padding: "14px", borderRadius: "12px", border: "none",
                background: generatingSummary ? "#475569" : "linear-gradient(135deg, #a855f7, #6366f1)",
                color: "#fff", fontSize: "14px", fontWeight: 800, cursor: generatingSummary ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                transition: "opacity 0.2s"
              }}
            >
              {generatingSummary ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Analyzing transcript...
                </>
              ) : "✨ Generate AI Summary"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
