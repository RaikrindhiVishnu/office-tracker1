// src/components/mobile/AIVoiceAssistant.tsx

"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { Mic, MicOff, Sparkles, MessageSquare, CornerDownRight, Loader2 } from "lucide-react";
import { useNotifications } from "@/context/NotificationContext";
import { useRouter } from "next/navigation";

export const AIVoiceAssistant: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useNotifications();
  const router = useRouter();

  // Speech recognition
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [recognition, setRecognition] = useState<any>(null);

  // Response parsing
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recog = new SpeechRecognition();
        recog.continuous = false;
        recog.interimResults = false;
        recog.lang = "en-US";

        recog.onresult = (event: any) => {
          const text = event.results[0][0].transcript;
          setTranscript(text);
          handleProcessCommand(text);
        };

        recog.onerror = (e: any) => {
          console.error("Assistant speech error:", e);
          setIsRecording(false);
        };

        recog.onend = () => {
          setIsRecording(false);
        };

        setRecognition(recog);
      }
    }
  }, [user]);

  const startListening = () => {
    if (!recognition) {
      alert("Voice input is not supported in this browser context.");
      return;
    }
    setTranscript("");
    setResponse(null);
    setIsRecording(true);
    recognition.start();
  };

  const handleProcessCommand = async (commandText: string) => {
    if (!commandText.trim() || !user) return;
    setLoading(true);

    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/ai/assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ command: commandText }),
      });

      if (!res.ok) {
        throw new Error("Assistant failed to decode command");
      }

      const { data } = await res.json();
      executeAction(data.action, data.params);
    } catch (e: any) {
      setResponse(`Sorry, I encountered an error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const executeAction = (action: string, params: any) => {
    switch (action) {
      case "CHECK_IN":
        setResponse("Redirecting you to mark check-in...");
        setTimeout(() => router.push("/mobile?action=checkin"), 1500);
        break;
      case "CHECK_OUT":
        setResponse("Redirecting you to mark check-out...");
        setTimeout(() => router.push("/mobile?action=checkout"), 1500);
        break;
      case "APPLY_LEAVE":
        const leaveQuery = new URLSearchParams({
          tab: "leave",
          action: "apply",
          ...(params.fromDate ? { fromDate: params.fromDate } : {}),
          ...(params.toDate ? { toDate: params.toDate } : {}),
          ...(params.leaveType ? { leaveType: params.leaveType } : {}),
        }).toString();
        setResponse("Opening pre-filled leave form...");
        setTimeout(() => router.push(`/employee?${leaveQuery}`), 1500);
        break;
      case "SHOW_TASKS":
        setResponse("Opening your tasks board...");
        setTimeout(() => router.push("/employee?tab=tasks"), 1500);
        break;
      case "SCHEDULE_MEETING":
        setResponse("Redirecting you to schedule a meeting...");
        setTimeout(() => router.push("/employee"), 1500);
        break;
      default:
        setResponse(`I understood your query as general text: "${transcript}". Please try a clear command like: "check me in" or "apply leave tomorrow".`);
        break;
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm w-full">
      <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
        <Sparkles className="w-4.5 h-4.5 text-indigo-600 animate-pulse" />
        AI Voice Assistant
      </h3>

      <div className="flex flex-col items-center gap-4">
        {/* Mic Circle */}
        <button
          onClick={isRecording ? () => recognition.stop() : startListening}
          className={`w-20 h-20 rounded-full flex items-center justify-center text-white shadow-lg active:scale-95 transition-all ${
            isRecording
              ? "bg-red-500 shadow-red-100 animate-ping border-4 border-red-50"
              : "bg-indigo-600 shadow-indigo-100 border-4 border-indigo-50"
          }`}
        >
          {isRecording ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </button>

        <span className="text-xs font-bold text-gray-500">
          {isRecording ? "Listening..." : "Tap to speak command"}
        </span>

        {/* Command query bubble */}
        {transcript && (
          <div className="w-full flex items-start gap-2 pt-3 border-t border-gray-50">
            <MessageSquare className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0 text-xs">
              <p className="font-bold text-gray-500">You said:</p>
              <p className="text-gray-700 italic mt-0.5">"{transcript}"</p>
            </div>
          </div>
        )}

        {/* Assistant Response bubble */}
        {(loading || response) && (
          <div className="w-full flex items-start gap-2 bg-indigo-50/50 p-3.5 rounded-2xl border border-indigo-100">
            <Sparkles className="w-4.5 h-4.5 text-indigo-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0 text-xs">
              <p className="font-bold text-indigo-800">AI Assistant:</p>
              {loading ? (
                <div className="flex items-center gap-1.5 text-indigo-500 mt-1 font-medium">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Processing voice intent...
                </div>
              ) : (
                <p className="text-indigo-900 mt-1 font-medium">{response}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
