// src/components/mobile/VoiceWorkUpdate.tsx

"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { Mic, MicOff, Send, Loader2, Sparkles, Plus, Trash2, CheckCircle2 } from "lucide-react";
import { useNotifications } from "@/context/NotificationContext";

export const VoiceWorkUpdate: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useNotifications();

  // Speech Recognition States
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [recognition, setRecognition] = useState<any>(null);

  // Parsing & Processing States
  const [processing, setProcessing] = useState(false);
  const [parsedData, setParsedData] = useState<{
    completed: string[];
    pending: string[];
    plan: string[];
  } | null>(null);

  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recog = new SpeechRecognition();
        recog.continuous = true;
        recog.interimResults = true;
        recog.lang = "en-US";

        recog.onresult = (event: any) => {
          let interimTranscript = "";
          let finalTranscript = "";

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }
          setTranscript((prev) => prev + finalTranscript);
        };

        recog.onerror = (e: any) => {
          if (e.error === "not-allowed") {
            alert("Microphone access denied. Please enable microphone permissions in your browser settings.");
          } else {
            console.error("Speech Recognition Error:", e.error || e);
          }
          setIsRecording(false);
        };

        recog.onend = () => {
          setIsRecording(false);
        };

        setRecognition(recog);
      }
    }
  }, []);

  const toggleRecording = () => {
    if (!recognition) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    if (isRecording) {
      try {
        recognition.stop();
      } catch (e) {
        console.warn("Could not stop recognition", e);
      }
      setIsRecording(false);
    } else {
      setTranscript("");
      try {
        recognition.start();
        setIsRecording(true);
      } catch (e: any) {
        if (e.name === "InvalidStateError") {
          setIsRecording(true); // Already started, just sync our state
        } else {
          console.error("Speech recognition start failed:", e);
        }
      }
    }
  };

  const handleParseTranscript = async () => {
    if (!transcript.trim() || !user) return;

    setProcessing(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch("/api/ai/parse-voice-update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ transcript }),
      });

      if (!response.ok) {
        throw new Error("AI failed to process. Try manual editing.");
      }

      const res = await response.json();
      setParsedData(res.data);
      showToast({
        title: "Speech Parsed by AI! ✨",
        message: "Your voice report has been structured. Check cards below.",
        category: "ai",
        priority: "low",
      });
    } catch (e: any) {
      alert(e.message || "Failed parsing update");
    } finally {
      setProcessing(false);
    }
  };

  // Editable lists management
  const handleItemChange = (field: "completed" | "pending" | "plan", idx: number, val: string) => {
    if (!parsedData) return;
    const list = [...parsedData[field]];
    list[idx] = val;
    setParsedData({ ...parsedData, [field]: list });
  };

  const handleAddItem = (field: "completed" | "pending" | "plan") => {
    if (!parsedData) return;
    setParsedData({
      ...parsedData,
      [field]: [...parsedData[field], ""],
    });
  };

  const handleRemoveItem = (field: "completed" | "pending" | "plan", idx: number) => {
    if (!parsedData) return;
    const list = parsedData[field].filter((_, i) => i !== idx);
    setParsedData({ ...parsedData, [field]: list });
  };

  const handleSaveUpdate = async () => {
    if (!user || !parsedData) return;
    setSaving(true);
    const todayStr = new Date().toISOString().split("T")[0];
    const docId = `${user.uid}_${todayStr}`;

    try {
      await setDoc(
        doc(db, "dailyUpdates", docId),
        {
          userId: user.uid,
          date: todayStr,
          completed: parsedData.completed,
          pending: parsedData.pending,
          plan: parsedData.plan,
          transcript,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setSavedSuccess(true);
      setParsedData(null);
      setTranscript("");
      showToast({
        title: "Standup Submitted! ✓",
        message: "Your daily update has been logged successfully.",
        category: "productivity",
        priority: "low",
      });
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (e: any) {
      alert(e.message || "Failed saving standup update");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm max-w-lg mx-auto w-full">
      <div className="text-center pb-4 border-b border-gray-50">
        <h3 className="text-lg font-bold text-gray-950">AI Standup Update</h3>
        <p className="text-xs text-gray-400 mt-0.5">
          Speak naturally, AI will construct structured work reports.
        </p>
      </div>

      {savedSuccess && (
        <div className="my-4 p-4 bg-green-50 text-green-800 rounded-2xl border border-green-200 flex items-center gap-2 text-xs font-semibold">
          <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
          Standup submitted successfully!
        </div>
      )}

      {/* Mic Record Button */}
      {!parsedData && (
        <div className="flex flex-col items-center gap-4 py-8">
          <button
            onClick={toggleRecording}
            className={`w-24 h-24 rounded-full flex items-center justify-center text-white shadow-lg active:scale-95 transition-all duration-300 ${
              isRecording
                ? "bg-red-500 shadow-red-100 animate-pulse border-4 border-red-50"
                : "bg-indigo-600 shadow-indigo-100 border-4 border-indigo-50"
            }`}
          >
            {isRecording ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
          </button>
          
          <span className="text-xs font-bold text-gray-500">
            {isRecording ? "Recording speech... tap to stop" : "Tap microphone to record standup"}
          </span>

          {/* Real-time transcript display */}
          <div className="w-full min-h-[80px] bg-gray-50 border border-gray-100 rounded-2xl p-4 mt-2">
            {transcript ? (
              <p className="text-xs text-gray-700 leading-relaxed italic">"{transcript}"</p>
            ) : (
              <p className="text-xs text-gray-400 italic">"Spoken update text will stream here..."</p>
            )}
          </div>

          {transcript && !isRecording && (
            <button
              onClick={handleParseTranscript}
              disabled={processing}
              className="mt-4 w-full py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all duration-300"
            >
              {processing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              AI Extract Standup
            </button>
          )}
        </div>
      )}

      {/* Parsed Standup Cards */}
      {parsedData && (
        <div className="flex flex-col gap-6 py-4">
          <h4 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            Structured standup review
          </h4>

          {/* 1. Completed */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-green-600 uppercase tracking-wider">Completed Tasks</span>
              <button onClick={() => handleAddItem("completed")} className="p-1 hover:bg-gray-100 text-indigo-600 rounded">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {parsedData.completed.map((item, idx) => (
              <div key={idx} className="flex gap-2">
                <input
                  type="text"
                  value={item}
                  onChange={(e) => handleItemChange("completed", idx, e.target.value)}
                  className="flex-1 px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button onClick={() => handleRemoveItem("completed", idx)} className="p-2 text-gray-400 hover:text-red-500 rounded">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* 2. Pending */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-amber-600 uppercase tracking-wider">Blocked/Pending</span>
              <button onClick={() => handleAddItem("pending")} className="p-1 hover:bg-gray-100 text-indigo-600 rounded">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {parsedData.pending.map((item, idx) => (
              <div key={idx} className="flex gap-2">
                <input
                  type="text"
                  value={item}
                  onChange={(e) => handleItemChange("pending", idx, e.target.value)}
                  className="flex-1 px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button onClick={() => handleRemoveItem("pending", idx)} className="p-2 text-gray-400 hover:text-red-500 rounded">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* 3. Tomorrow Plan */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-indigo-600 uppercase tracking-wider">Tomorrow Plan</span>
              <button onClick={() => handleAddItem("plan")} className="p-1 hover:bg-gray-100 text-indigo-600 rounded">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {parsedData.plan.map((item, idx) => (
              <div key={idx} className="flex gap-2">
                <input
                  type="text"
                  value={item}
                  onChange={(e) => handleItemChange("plan", idx, e.target.value)}
                  className="flex-1 px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button onClick={() => handleRemoveItem("plan", idx)} className="p-2 text-gray-400 hover:text-red-500 rounded">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-2.5 mt-4">
            <button
              onClick={handleSaveUpdate}
              disabled={saving}
              className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl text-xs font-bold shadow-md hover:shadow-lg transition-all duration-300 flex items-center justify-center gap-1.5"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Submit Standup Report
            </button>
            <button
              onClick={() => setParsedData(null)}
              className="py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-2xl text-xs font-semibold transition-colors"
            >
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
