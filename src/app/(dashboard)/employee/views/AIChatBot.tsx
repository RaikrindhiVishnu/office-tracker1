"use client";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";

type Message = {
  id: string;
  sender: "user" | "ai";
  text: string;
  timestamp: Date;
};

export default function AIChatBot() {
  const { user, userData } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      sender: "ai",
      text: "Hi there! I'm your HR & AI Assistant. Ask me about your leave balance, company policies, or anything else!",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMsg: Message = { id: Date.now().toString(), sender: "user", text: input, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    // Mock AI Response Logic
    setTimeout(() => {
      let aiText = "I'm not sure about that. Please contact HR for more details.";
      const query = userMsg.text.toLowerCase();

      if (query.includes("leave") || query.includes("balance")) {
        aiText = `You currently have 12 Annual Leaves and 5 Sick Leaves remaining. Would you like me to help you apply for leave?`;
      } else if (query.includes("policy") || query.includes("dress code")) {
        aiText = "Our company follows a business casual dress code from Monday to Thursday, and smart casuals on Fridays.";
      } else if (query.includes("salary") || query.includes("pay")) {
        aiText = "Your next salary will be credited on the 1st of the upcoming month. You can view your latest payslips in the Payroll section.";
      } else if (query.includes("hello") || query.includes("hi")) {
        aiText = `Hello ${(userData as any)?.name?.split(" ")[0] || "there"}! How can I help you today?`;
      } else if (query.includes("attendance")) {
        aiText = "You have maintained a 98% attendance rate this month. Keep up the good work!";
      }

      const aiMsg: Message = { id: (Date.now() + 1).toString(), sender: "ai", text: aiText, timestamp: new Date() };
      setMessages(prev => [...prev, aiMsg]);
      setIsTyping(false);
    }, 1500);
  };

  return (
    <div style={{ position: "fixed", bottom: "30px", right: "30px", zIndex: 9999, fontFamily: "'Inter', sans-serif" }}>
      {/* Chat Window */}
      {isOpen && (
        <div style={{
          position: "absolute",
          bottom: "70px",
          right: 0,
          width: "350px",
          height: "500px",
          background: "#fff",
          borderRadius: "20px",
          boxShadow: "0 20px 40px -10px rgba(0,0,0,0.2)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          border: "1px solid #e2e8f0"
        }}>
          {/* Header */}
          <div style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", color: "#fff" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px" }}>🤖</div>
              <div>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700 }}>HR AI Assistant</h3>
                <p style={{ margin: 0, fontSize: "11px", opacity: 0.8 }}>Online</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", padding: "4px" }}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          {/* Messages Area */}
          <div style={{ flex: 1, padding: "20px", overflowY: "auto", background: "#f8fafc", display: "flex", flexDirection: "column", gap: "12px" }}>
            {messages.map((m) => (
              <div key={m.id} style={{ alignSelf: m.sender === "user" ? "flex-end" : "flex-start", maxWidth: "80%" }}>
                <div style={{
                  background: m.sender === "user" ? "#6366f1" : "#fff",
                  color: m.sender === "user" ? "#fff" : "#1e293b",
                  padding: "12px 16px",
                  borderRadius: m.sender === "user" ? "16px 16px 0 16px" : "16px 16px 16px 0",
                  fontSize: "14px",
                  lineHeight: 1.5,
                  boxShadow: "0 2px 5px rgba(0,0,0,0.05)",
                  border: m.sender === "ai" ? "1px solid #e2e8f0" : "none"
                }}>
                  {m.text}
                </div>
                <div style={{ fontSize: "10px", color: "#94a3b8", marginTop: "4px", textAlign: m.sender === "user" ? "right" : "left", padding: "0 4px" }}>
                  {m.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            ))}
            {isTyping && (
              <div style={{ alignSelf: "flex-start", background: "#fff", padding: "12px 16px", borderRadius: "16px 16px 16px 0", border: "1px solid #e2e8f0", display: "flex", gap: "4px" }}>
                <div className="w-2 h-2 rounded-full bg-indigo-300 animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 rounded-full bg-indigo-300 animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 rounded-full bg-indigo-300 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div style={{ padding: "16px", background: "#fff", borderTop: "1px solid #e2e8f0", display: "flex", gap: "8px" }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Ask anything..."
              style={{
                flex: 1,
                padding: "10px 16px",
                borderRadius: "20px",
                border: "1px solid #cbd5e1",
                fontSize: "14px",
                outline: "none",
                background: "#f8fafc"
              }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isTyping}
              style={{
                background: input.trim() && !isTyping ? "#6366f1" : "#cbd5e1",
                color: "#fff",
                border: "none",
                borderRadius: "50%",
                width: "40px",
                height: "40px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: input.trim() && !isTyping ? "pointer" : "not-allowed",
                transition: "background 0.2s"
              }}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
            </button>
          </div>
        </div>
      )}

      {/* Floating Bubble */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: "60px",
          height: "60px",
          borderRadius: "30px",
          background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
          color: "#fff",
          border: "none",
          boxShadow: "0 10px 25px -5px rgba(99, 102, 241, 0.5)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "28px",
          transition: "transform 0.2s"
        }}
        onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.05)"}
        onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
      >
        {isOpen ? (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        ) : (
          "✨"
        )}
      </button>
    </div>
  );
}
