"use client";
// Trigger deployment sync
import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Bot, Mic, VolumeX, Volume2, Paperclip, ImageIcon } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getTodayAttendance } from "@/lib/attendance";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Message {
  role: "user" | "bot";
  text: string;
  timestamp?: Date;
  imageUrl?: string; // optional preview of uploaded image
}

export default function ChatBot({ isInline = false }: { isInline?: boolean }) {
  const { userData } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [hasPrimedAudio, setHasPrimedAudio] = useState(false);
  const recognitionRef = useRef<any>(null);
  
  useEffect(() => {
    if (isInline) setIsOpen(true);
  }, [isInline]);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [hasSubmittedToday, setHasSubmittedToday] = useState(true);
  const [isWorkUpdateFlowActive, setIsWorkUpdateFlowActive] = useState(false);

  // Dragging state
  const [position, setPosition] = useState({ right: 24, bottom: 24 });
  const [isDragging, setIsDragging] = useState(false);
  const dragInfo = useRef({ startX: 0, startY: 0, initRight: 0, initBottom: 0, wasDragged: false });

  const handleMouseDown = (e: React.MouseEvent) => {
    // Check if the click originated from the header or the main button
    const target = e.target as HTMLElement;
    if (target.closest('.chat-dragger')) {
      setIsDragging(true);
      dragInfo.current = { startX: e.clientX, startY: e.clientY, initRight: position.right, initBottom: position.bottom, wasDragged: false };
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - dragInfo.current.startX;
      const dy = e.clientY - dragInfo.current.startY;
      
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        dragInfo.current.wasDragged = true;
      }
      
      setPosition({
        right: Math.max(0, Math.min(window.innerWidth - 80, dragInfo.current.initRight - dx)),
        bottom: Math.max(0, Math.min(window.innerHeight - 80, dragInfo.current.initBottom - dy)),
      });
    };
    const handleMouseUp = () => {
      // Delay resetting isDragging so onClick handlers can check wasDragged if needed
      setTimeout(() => setIsDragging(false), 50);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const MENU_CATEGORIES = [
    { id: "attendance", label: "Attendance",    icon: "🟢",
      options: ["Check me in", "Check me out", "My attendance today"] },
    { id: "actions", label: "AI Do-It-For-Me", icon: "⚡",
      options: ["Draft my sick leave for today", "Summarize my delayed tasks", "Log a $50 lunch expense"] },
    { id: "rag", label: "Company Knowledge", icon: "🧠",
      options: ["What is our remote work policy?", "How do I claim health insurance?", "Who is the lead on Project Alpha?"] },
    { id: "updates",    label: "Work Updates",  icon: "📝",
      options: ["Submit my work update", "I have a blocker"] },
    { id: "projects",  label: "Projects",      icon: "📂",
      options: ["My assigned tasks", "My assigned bugs"] },
    { id: "leave",     label: "Leave",         icon: "📅",
      options: ["Apply for leave", "My leave balance"] },
    { id: "insights",  label: "AI Insights",   icon: "🤖",
      options: ["My productivity this week", "AI suggestions for me"] },
    { id: "help",      label: "Help & Support", icon: "⚙️",
      options: ["Contact HR", "Report an IT issue"] },
  ];

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true; // Stay active to give user time to speak
      recognition.interimResults = true;
      recognition.lang = "en-US";
      
      // onresult will be assigned dynamically in toggleListen to capture current input state
      
      recognition.onend = () => {
        console.log("Speech recognition ended");
        setIsListening(false);
      };
      
      recognition.onerror = (event: any) => {
        if (event.error === "not-allowed") {
          console.warn("Speech recognition access denied by browser.");
        } else {
          console.error("Speech recognition error:", event.error, event);
        }
        setIsListening(false);
      };
      
      recognitionRef.current = recognition;
    } else {
      console.warn("SpeechRecognition not supported in this browser");
    }
  }, []);

  const primeAudio = () => {
    if (!hasPrimedAudio && window.speechSynthesis) {
      const u = new SpeechSynthesisUtterance("");
      u.volume = 0;
      try {
        window.speechSynthesis.speak(u);
      } catch (e) {
        console.warn("primeAudio failed:", e);
      }
      setHasPrimedAudio(true);
    }
  };

  const toggleListen = () => {
    primeAudio();
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      if (recognitionRef.current) {
        const currentInput = input;
        recognitionRef.current.onresult = (event: any) => {
          let interimTranscript = "";
          let finalTranscript = "";
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }
          const transcript = finalTranscript || interimTranscript;
          if (transcript) {
            setInput((currentInput ? currentInput + " " : "") + transcript);
          }
        };
        try {
          recognitionRef.current.start();
          setIsListening(true);
        } catch (e) {
          console.warn("Failed to start SpeechRecognition (may already be running):", e);
          setIsListening(true); // Assuming it's already running if we get this error
        }
      }
    }
  };

  const speak = (text: string) => {
    if (!window.speechSynthesis) {
      console.warn("SpeechSynthesis not supported in this browser");
      return;
    }
    console.log("Speak called. isMuted status:", isMuted);
    if (isMuted) return;
    
    try {
      window.speechSynthesis.cancel(); // Clear any queued utterances
      const cleanText = text.replace(/[*_~`]/g, "");
      const utterance = new SpeechSynthesisUtterance(cleanText);
      
      utterance.onstart = () => console.log("Speech started speaking");
      utterance.onend = () => console.log("Speech finished speaking");
      utterance.onerror = (e: any) => {
        if (e.error !== "interrupted") {
          console.error("SpeechSynthesis error code:", e.error, e);
        }
      };
      
      window.speechSynthesis.speak(utterance);
      // Critical fix for mobile browsers (especially iOS Safari) where speech gets stuck or doesn't start
      window.speechSynthesis.resume();
    } catch (err) {
      console.error("Failed to run speechSynthesis:", err);
    }
  };

  const handleImageAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setAttachedImage(reader.result as string);
    };
    reader.readAsDataURL(file);
    // Reset file input so same file can be re-selected
    e.target.value = "";
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
    let yesterdaysUpdate: any = null;
    let assignedTasks: any[] = [];

    try {
      // 1. Check Attendance
      const att = await getTodayAttendance(userData.uid);
      if (att && att.sessions && att.sessions.length > 0) {
        const lastSession = att.sessions[att.sessions.length - 1];
        if (lastSession.checkOut === null) {
          hasCheckedIn = true;
        }
      }

      // 2. Check Work Updates for today and yesterday
      const today = new Date().toISOString().split("T")[0];
      const yesterdayDate = new Date(Date.now() - 86400000).toISOString().split("T")[0];

      const updatesSnap = await getDocs(query(collection(db, "workUpdates"), where("uid", "==", userData.uid)));

      const todayUpdates = updatesSnap.docs.filter(doc => {
        const data = doc.data();
        if (!data.createdAt) return false;
        const dateStr = data.createdAt.toDate?.()?.toISOString().split("T")[0];
        return dateStr === today;
      });
      if (todayUpdates.length > 0) hasWorkUpdate = true;

      const yesterdayUpdates = updatesSnap.docs.filter(doc => {
        const data = doc.data();
        if (!data.createdAt) return false;
        const dateStr = data.createdAt.toDate?.()?.toISOString().split("T")[0];
        return dateStr === yesterdayDate;
      });
      if (yesterdayUpdates.length > 0) {
        // Strip out timestamp to make it JSON-safe for the API context
        const data = yesterdayUpdates[0].data();
        yesterdaysUpdate = {
          todayTask: data.todayTask || data.task,
          nextTask: data.nextTask,
          blockers: data.blockers || data.notes,
          status: data.status,
          productivity: data.productivity
        };
      }

      // 3. Get Projects
      const projectsSnap = await getDocs(query(collection(db, "projects"), where("members", "array-contains", userData.uid)));
      assignedProjects = projectsSnap.docs.map(d => ({ id: d.id, name: d.data().name }));

      // 4. Get Assigned Tasks/Bugs
      const tasksSnap = await getDocs(query(collection(db, "projectTasks"), where("assignedTo", "==", userData.uid)));
      assignedTasks = tasksSnap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          title: data.title,
          status: data.status,
          ticketType: data.ticketType,
          projectId: data.projectId
        };
      });

    } catch (err) {
      console.error("Error fetching context for chat:", err);
    }

    return {
      userName: userData?.name || userData?.email?.split('@')[0],
      hasCheckedIn,
      hasWorkUpdate,
      assignedProjects,
      yesterdaysUpdate,
      assignedTasks
    };
  };

  const sendInitialPrompt = async () => {
    setIsLoading(true);
    try {
      const context = await getUserContext();
      setHasSubmittedToday(context.hasWorkUpdate || false);

      const greetings = [
        "How can I help you today?",
        "What's on your agenda for today?",
        "How can I support you right now?",
        "Is there anything specific you need help with?"
      ];
      const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];

      let greetingText = `Hello ${context.userName || "there"}! I'm **Tracker Bot**, your AI HR Assistant and Office Manager. Here is your current status for today:\n* **Attendance:** ${context.hasCheckedIn ? "Checked in" : "Not checked in yet"}\n* **Work Update:** ${context.hasWorkUpdate ? "Submitted" : "🔴 Not submitted yet"}\n\n${randomGreeting}`;

      if (!context.hasWorkUpdate) {
        greetingText += "\n\n*Since you haven't submitted your update yet, what have you been working on today?*";
      }

      setMessages([{ role: "bot", text: greetingText, timestamp: new Date() }]);
      speak(greetingText);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async (overrideMsg?: string) => {
    primeAudio();
    const textToSend = overrideMsg || input;
    if (!textToSend.trim() && !attachedImage) return;

    // Detect if work update flow is starting
    if (
      textToSend === "Submit my work update" || 
      textToSend.toLowerCase().includes("submit my work update") || 
      textToSend.toLowerCase().includes("submit daily update")
    ) {
      setIsWorkUpdateFlowActive(true);
    }

    const userMsg = textToSend;
    const imageToSend = attachedImage;
    setInput("");
    setAttachedImage(null);
    setActiveCategory(null);
    setMessages((prev) => [...prev, { role: "user", text: userMsg || "(image attached)", timestamp: new Date(), imageUrl: imageToSend || undefined }]);
    setIsLoading(true);

    try {
      const context = await getUserContext();

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMsg || "Please analyze this image and help me log a bug or task based on it.",
          history: messages,
          context: {
            ...context,
            uid: userData?.uid,
            userEmail: userData?.email
          },
          base64Image: imageToSend,
        }),
      });

      const data = await res.json();
      if (res.ok && data.text) {
        setMessages((prev) => [...prev, { role: "bot", text: data.text, timestamp: new Date() }]);
        speak(data.text);
        if (data.workUpdateLogged) {
          setIsWorkUpdateFlowActive(false);
          setHasSubmittedToday(true);
        }
      } else {
        const errorMsg = data.details || data.error || "I'm having trouble connecting right now.";
        const botError = `I'm sorry, an error occurred: ${errorMsg}`;
        setMessages((prev) => [...prev, { role: "bot", text: botError, timestamp: new Date() }]);
        speak(botError);
      }
    } catch (error: any) {
      console.error(error);
      setMessages((prev) => [...prev, { role: "bot", text: `I'm sorry, a network error occurred: ${error.message || "Unknown error"}`, timestamp: new Date() }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Only show the bot if the user is logged in
  if (!userData) return null;

  return (
    <div 
      className={isInline ? "flex flex-col h-[calc(100vh-140px)] w-full relative" : "fixed z-[9999] flex flex-col items-end"}
      style={isInline ? undefined : { right: position.right, bottom: position.bottom }}
      onMouseDown={isInline ? undefined : handleMouseDown}
    >
      <AnimatePresence>
        {isOpen && (
          <motion.div
            onClick={primeAudio}
            initial={isInline ? undefined : { opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={isInline ? undefined : { opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={`bg-white overflow-hidden flex flex-col ${isInline ? "w-full h-full flex-1 rounded-2xl border border-gray-100 shadow-sm" : "w-80 sm:w-96 mb-4 rounded-2xl shadow-2xl border border-gray-100"}`}
            style={isInline ? { height: "100%", maxHeight: "100%" } : { height: "500px", maxHeight: "80vh" }}
          >
            {/* Header */}
            <div className="bg-linear-to-r from-[#0b3a5a] to-[#1a5276] p-4 flex justify-between items-center shadow-md z-10 chat-dragger cursor-move">
              <div className="flex items-center gap-3 pointer-events-none">
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
                {!isInline && (
                  <button
                    onClick={() => setIsOpen(false)}
                    className="text-white/80 hover:text-white transition-colors hover:bg-white/10 p-1.5 rounded-lg"
                  >
                    <X size={20} />
                  </button>
                )}
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5 bg-slate-50/50">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed prose prose-sm max-w-none ${msg.role === "user"
                        ? "bg-[#0b3a5a] text-white rounded-br-sm shadow-sm prose-invert"
                        : "bg-white border border-gray-200 text-gray-800 rounded-bl-sm shadow-sm prose-p:my-1 prose-ul:my-1 prose-ul:pl-4 prose-li:my-0.5"
                      }`}
                  >
                    {msg.imageUrl && (
                      <img src={msg.imageUrl} alt="attachment" className="rounded-lg mb-2 max-w-full max-h-40 object-cover" />
                    )}
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.text}
                    </ReactMarkdown>
                  </div>
                  {msg.timestamp && (
                    <span className="text-[10px] text-gray-400 mt-1 px-1">
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {msg.role === "user" && " ✓✓"}
                    </span>
                  )}
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-gray-100 text-gray-500 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm flex items-center gap-1.5 h-10">
                    <span className="w-1.5 h-1.5 bg-[#0b3a5a]/60 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                    <span className="w-1.5 h-1.5 bg-[#0b3a5a]/60 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                    <span className="w-1.5 h-1.5 bg-[#0b3a5a]/60 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
                  </div>
                </div>
              )}

              {/* Navigation Grid and Options inside Messages Area log */}
              {!isLoading && messages.length > 0 && messages[messages.length - 1].role === "bot" && !isWorkUpdateFlowActive && (
                <div className="mt-4 p-2 bg-slate-50/70 rounded-2xl border border-slate-100/80 space-y-3 flex flex-col shrink-0 font-sans">
                  
                  {!activeCategory ? (
                    <div className="flex flex-wrap gap-1.5 justify-start">
                      {MENU_CATEGORIES.map((cat) => (
                        <button
                          key={cat.id}
                          onClick={() => setActiveCategory(cat.id)}
                          className="text-[11px] font-bold px-3 py-1.5 rounded-full border bg-white text-slate-700 border-slate-200 hover:border-[#0b3a5a]/50 hover:text-[#0b3a5a] hover:bg-slate-50 transition-all flex flex-row items-center gap-1.5 select-none shadow-xs cursor-pointer active:scale-95 shrink-0"
                        >
                          <span className="text-xs shrink-0">{cat.icon}</span>
                          <span className="font-sans font-semibold">{cat.label}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    /* If a category IS selected, hide the pills grid and show the questions list + Back button */
                    <div className="flex flex-col gap-2">
                      {/* Back button */}
                      <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
                        <button
                          onClick={() => setActiveCategory(null)}
                          className="text-[10px] font-bold text-slate-500 hover:text-[#0b3a5a] flex items-center gap-1 transition-colors cursor-pointer bg-white px-2 py-0.5 rounded-lg border border-slate-200 shadow-2xs hover:bg-slate-50"
                        >
                          <span>←</span> <span>Back</span>
                        </button>
                        <span className="text-[11px] font-bold text-[#0b3a5a] flex items-center gap-1">
                          {MENU_CATEGORIES.find(c => c.id === activeCategory)?.icon} {MENU_CATEGORIES.find(c => c.id === activeCategory)?.label}
                        </span>
                      </div>

                      {/* Sub-options for selected category: Styled exactly like the chips in the user image */}
                      <div className="flex flex-wrap gap-1.5 justify-start">
                        {MENU_CATEGORIES.find(c => c.id === activeCategory)?.options.map((opt) => (
                          <button
                            key={opt}
                            onClick={() => handleSend(opt)}
                            className="text-[11px] bg-white text-slate-700 border border-slate-200 px-3 py-1.5 rounded-full hover:bg-[#0b3a5a]/5 hover:border-[#0b3a5a]/30 hover:text-[#0b3a5a] transition-all font-sans font-medium shadow-xs cursor-pointer active:scale-95"
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Image Preview Strip */}
            {attachedImage && (
              <div className="px-3 pt-2 bg-white border-t border-gray-100 flex items-center gap-2">
                <div className="relative">
                  <img src={attachedImage} alt="preview" className="h-16 w-16 object-cover rounded-lg border border-gray-200" />
                  <button
                    onClick={() => setAttachedImage(null)}
                    className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs shadow"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-xs text-slate-500">Image attached — ask me to analyze it or log a bug!</p>
              </div>
            )}

            {/* Input Area */}
            <div className="p-3 bg-white border-t border-gray-100">
              {/* Hidden file input */}
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                onChange={handleImageAttach}
                className="hidden"
              />
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
                  className={`${isListening ? "bg-red-500 hover:bg-red-600 animate-pulse text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-500"} p-2 rounded-full transition-colors shrink-0`}
                  title="Speak to dictate"
                >
                  <Mic size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={`${attachedImage ? "bg-blue-500 text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-500"} p-2 rounded-full transition-colors shrink-0`}
                  title="Attach image / screenshot"
                >
                  <Paperclip size={16} />
                </button>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={attachedImage ? "Describe or ask about the image..." : "Ask me anything..."}
                  className="flex-1 min-w-0 bg-transparent px-2 py-1.5 text-sm focus:outline-none text-gray-700 placeholder-gray-400"
                />
                <button
                  type="submit"
                  disabled={(!input.trim() && !attachedImage) || isLoading}
                  className="bg-[#0b3a5a] text-white p-2 rounded-full hover:bg-[#1a5276] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shrink-0"
                >
                  <Send size={16} />
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Button */}
      {!isInline && (
        <div className="relative mt-2">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={(e) => {
              if (!dragInfo.current.wasDragged) setIsOpen(!isOpen);
            }}
            className="bg-linear-to-r from-[#0b3a5a] to-[#1a5276] text-white p-4 rounded-full shadow-xl hover:shadow-2xl transition-all flex items-center justify-center border-2 border-white/20 cursor-pointer chat-dragger cursor-move"
          >
            {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
          </motion.button>
          {!isOpen && !hasSubmittedToday && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 z-[9999]">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 text-[9px] text-white font-bold items-center justify-center shadow-md">!</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
