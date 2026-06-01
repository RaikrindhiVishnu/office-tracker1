"use client";

import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Bot, Mic, VolumeX, Volume2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getTodayAttendance } from "@/lib/attendance";

interface Message {
  role: "user" | "bot";
  text: string;
}

export default function ChatBot() {
  const { userData } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.onresult = (event: any) => {
        let text = "";
        for (let i = 0; i < event.results.length; i++) {
          text += event.results[i][0].transcript;
        }
        setInput(text);
      };
      recognitionRef.current.onend = () => setIsListening(false);
      recognitionRef.current.onerror = () => setIsListening(false);
    }
  }, []);

  const toggleListen = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      if (recognitionRef.current) {
        setInput("");
        recognitionRef.current.start();
        setIsListening(true);
      }
    }
  };

  const speak = (text: string) => {
    if (isMuted || !window.speechSynthesis) return;
    const cleanText = text.replace(/[*_~`]/g, "");
    const utterance = new SpeechSynthesisUtterance(cleanText);
    window.speechSynthesis.speak(utterance);
  };

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Send initial "greeting" message secretly to prompt the bot to check context
  useEffect(() => {
    if (isOpen && !hasStarted && userData) {
      setHasStarted(true);
      sendInitialPrompt();
    }
  }, [isOpen, userData, hasStarted]);

  const getUserContext = async () => {
    if (!userData?.uid) return {};
    
    let hasCheckedIn = false;
    let hasWorkUpdate = false;
    let assignedProjects: { id: string; name: string }[] = [];

    try {
      // 1. Check Attendance
      const att = await getTodayAttendance(userData.uid);
      if (att && att.sessions && att.sessions.length > 0) {
        const lastSession = att.sessions[att.sessions.length - 1];
        if (lastSession.checkOut === null) {
          hasCheckedIn = true;
        }
      }

      // 2. Check Work Updates for today
      const today = new Date().toISOString().split("T")[0];
      const updatesSnap = await getDocs(query(collection(db, "workUpdates"), where("uid", "==", userData.uid)));
      const todayUpdates = updatesSnap.docs.filter(doc => {
        const data = doc.data();
        if (!data.createdAt) return false;
        const dateStr = data.createdAt.toDate?.()?.toISOString().split("T")[0];
        return dateStr === today;
      });
      if (todayUpdates.length > 0) hasWorkUpdate = true;

      // 3. Get Projects
      const projectsSnap = await getDocs(query(collection(db, "projects"), where("members", "array-contains", userData.uid)));
      assignedProjects = projectsSnap.docs.map(d => ({ id: d.id, name: d.data().name }));
      
    } catch (err) {
      console.error("Error fetching context for chat:", err);
    }

    return {
      userName: userData?.name || userData?.email?.split('@')[0],
      hasCheckedIn,
      hasWorkUpdate,
      assignedProjects,
    };
  };

  const sendInitialPrompt = async () => {
    setIsLoading(true);
    try {
      const context = await getUserContext();

      const greetings = [
        "How can I help you today?",
        "What's on your agenda for today?",
        "How can I support you right now?",
        "Is there anything specific you need help with?"
      ];
      const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
      
      let greetingText = `Hello ${context.userName || "there"}! I'm **Tracker Bot**, your AI HR Assistant and Office Manager. Here is your current status for today:\n* **Attendance:** ${context.hasCheckedIn ? "Checked in" : "Not checked in yet"}\n* **Work Update:** ${context.hasWorkUpdate ? "Submitted" : "Not submitted yet"}\n\n${randomGreeting}`;
      
      if (!context.hasWorkUpdate) {
        greetingText += "\n\n*Since you haven't submitted your update yet, what have you been working on today?*";
      }

      setMessages([{ role: "bot", text: greetingText }]);
      speak(greetingText);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg = input;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: userMsg }]);
    setIsLoading(true);

    try {
      const context = await getUserContext();

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          message: userMsg,
          history: messages,
          context: { 
            ...context, 
            uid: userData?.uid, 
            userEmail: userData?.email 
          } 
        }),
      });

      const data = await res.json();
      if (res.ok && data.text) {
        setMessages((prev) => [...prev, { role: "bot", text: data.text }]);
        speak(data.text);
      } else {
        const errorMsg = data.details || data.error || "I'm having trouble connecting right now.";
        const botError = `I'm sorry, an error occurred: ${errorMsg}`;
        setMessages((prev) => [...prev, { role: "bot", text: botError }]);
        speak(botError);
      }
    } catch (error: any) {
      console.error(error);
      setMessages((prev) => [...prev, { role: "bot", text: `I'm sorry, a network error occurred: ${error.message || "Unknown error"}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Only show the bot if the user is logged in
  if (!userData) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="mb-4 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col"
            style={{ height: "500px", maxHeight: "80vh" }}
          >
            {/* Header */}
            <div className="bg-linear-to-r from-[#0b3a5a] to-[#1a5276] p-4 flex justify-between items-center shadow-md z-10">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-lg">
                  <Bot size={20} className="text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">HR Assistant</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
                    <span className="text-white/80 text-xs">Online</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => {
                    setIsMuted(!isMuted);
                    if (!isMuted) window.speechSynthesis?.cancel(); // Stop talking if muted mid-sentence
                  }}
                  className="text-white/80 hover:text-white transition-colors hover:bg-white/10 p-1.5 rounded-lg"
                  title={isMuted ? "Unmute Bot" : "Mute Bot"}
                >
                  {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="text-white/80 hover:text-white transition-colors hover:bg-white/10 p-1.5 rounded-lg"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                      msg.role === "user"
                        ? "bg-[#0b3a5a] text-white rounded-br-sm shadow-sm"
                        : "bg-white border border-gray-100 text-gray-700 rounded-bl-sm shadow-sm"
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-gray-100 text-gray-500 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-3 bg-white border-t border-gray-100">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="flex items-center gap-2 bg-slate-50 rounded-full border border-gray-200 px-2 py-1.5 focus-within:border-[#0b3a5a] focus-within:ring-1 focus-within:ring-[#0b3a5a]/20 transition-all shadow-sm"
              >
                <button
                  type="button"
                  onClick={toggleListen}
                  className={`${isListening ? "bg-red-500 hover:bg-red-600 animate-pulse text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-500"} p-2 rounded-full transition-colors`}
                  title="Speak to dictate"
                >
                  <Mic size={16} />
                </button>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask me anything..."
                  className="flex-1 bg-transparent px-3 py-1.5 text-sm focus:outline-none text-gray-700 placeholder-gray-400"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="bg-[#0b3a5a] text-white p-2 rounded-full hover:bg-[#1a5276] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  <Send size={16} />
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="bg-linear-to-r from-[#0b3a5a] to-[#1a5276] text-white p-4 rounded-full shadow-xl hover:shadow-2xl transition-all flex items-center justify-center border-2 border-white/20"
      >
        {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
      </motion.button>
    </div>
  );
}
