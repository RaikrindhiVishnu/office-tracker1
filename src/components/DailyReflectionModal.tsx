"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";

export default function DailyReflectionModal() {
  const { userData } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  
  const [mood, setMood] = useState("");
  const [accomplishments, setAccomplishments] = useState("");
  const [hasBlocker, setHasBlocker] = useState<boolean | null>(null);
  const [blockerDetails, setBlockerDetails] = useState("");
  const [needsSupport, setNeedsSupport] = useState<boolean | null>(null);
  const [supportDetails, setSupportDetails] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const checkReflectionStatus = async () => {
      if (!userData?.uid) return;

      try {
        const now = new Date();
        const hours = now.getHours();
        
        // Only trigger after 4 PM (16:00)
        if (hours < 16) {
          setIsChecking(false);
          return;
        }

        // Format date as YYYY-MM-DD local time
        const offset = now.getTimezoneOffset();
        const localDate = new Date(now.getTime() - (offset*60*1000));
        const todayStr = localDate.toISOString().split('T')[0];

        // Check if already submitted today
        const reflectionsRef = collection(db, "dailyReflections");
        const q = query(
          reflectionsRef, 
          where("userId", "==", userData.uid),
          where("date", "==", todayStr)
        );
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
          setIsOpen(true);
        }
      } catch (error) {
        console.error("Error checking daily reflection:", error);
      } finally {
        setIsChecking(false);
      }
    };

    checkReflectionStatus();
    
    // Optional: check periodically if they keep the tab open for a long time
    const interval = setInterval(() => {
      if (!isOpen) checkReflectionStatus();
    }, 1000 * 60 * 15); // Check every 15 minutes

    return () => clearInterval(interval);
  }, [userData, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mood || hasBlocker === null || needsSupport === null) {
      alert("Please fill in the required fields (Mood, Blockers, Support).");
      return;
    }

    if (!userData?.uid) return;

    try {
      setIsSubmitting(true);
      
      const now = new Date();
      const offset = now.getTimezoneOffset();
      const localDate = new Date(now.getTime() - (offset*60*1000));
      const todayStr = localDate.toISOString().split('T')[0];

      await addDoc(collection(db, "dailyReflections"), {
        userId: userData.uid,
        userName: userData.name || userData.email,
        date: todayStr,
        mood,
        accomplishments,
        hasBlocker,
        blockerDetails: hasBlocker ? blockerDetails : "",
        needsSupport,
        supportDetails: needsSupport ? supportDetails : "",
        additionalNotes,
        timestamp: serverTimestamp(),
      });

      setIsOpen(false);
    } catch (error) {
      console.error("Error submitting reflection:", error);
      alert("Failed to save reflection. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // If we are still checking if it's time to open, render nothing
  if (isChecking) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
              <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Daily Reflection</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">A quick check-in about your day</p>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
              <form id="reflection-form" onSubmit={handleSubmit} className="space-y-6">
                
                {/* 1. Mood */}
                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                    1. How was your day? <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {[
                      { icon: <svg className="w-7 h-7 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>, label: "Great" },
                      { icon: <svg className="w-7 h-7 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 15h2m-6-3h.01M17 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>, label: "Good" },
                      { icon: <svg className="w-7 h-7 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>, label: "Okay" },
                      { icon: <svg className="w-7 h-7 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>, label: "Challenging" },
                      { icon: <svg className="w-7 h-7 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>, label: "Difficult" }
                    ].map((m) => (
                      <button
                        key={m.label}
                        type="button"
                        onClick={() => setMood(m.label)}
                        className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all ${
                          mood === m.label 
                            ? "bg-indigo-50 text-indigo-600 border-2 border-indigo-500 shadow-sm" 
                            : "bg-slate-50 text-slate-500 border-2 border-transparent hover:bg-slate-100 dark:bg-slate-700 dark:hover:bg-slate-600"
                        }`}
                      >
                        {m.icon}
                        <span className="text-xs font-medium text-inherit text-center">{m.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Accomplishments */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                    2. What did you accomplish today?
                  </label>
                  <textarea
                    value={accomplishments}
                    onChange={(e) => setAccomplishments(e.target.value)}
                    placeholder="e.g. Completed the employee dashboard and fixed the API integration."
                    className="w-full rounded-xl border-slate-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white sm:text-sm p-3 min-h-[80px]"
                  />
                </div>

                {/* 3. Blockers */}
                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                    3. Did you face any blockers? <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input 
                        type="radio" 
                        name="blocker" 
                        checked={hasBlocker === false}
                        onChange={() => setHasBlocker(false)}
                        className="text-indigo-600 focus:ring-indigo-500 border-slate-300"
                      />
                      <span className="text-sm text-slate-700 dark:text-slate-300">No blockers</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input 
                        type="radio" 
                        name="blocker"
                        checked={hasBlocker === true}
                        onChange={() => setHasBlocker(true)}
                        className="text-indigo-600 focus:ring-indigo-500 border-slate-300"
                      />
                      <span className="text-sm text-slate-700 dark:text-slate-300">Yes, I had a blocker</span>
                    </label>
                  </div>
                  {hasBlocker && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                      <label className="block text-xs font-semibold text-slate-500 mb-1 mt-2 uppercase">What was blocking you?</label>
                      <textarea
                        required
                        value={blockerDetails}
                        onChange={(e) => setBlockerDetails(e.target.value)}
                        placeholder="Briefly describe the issue..."
                        className="w-full rounded-xl border-slate-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white sm:text-sm p-3"
                      />
                    </motion.div>
                  )}
                </div>

                {/* 4. Support */}
                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                    4. Do you need any support? <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input 
                        type="radio" 
                        name="support" 
                        checked={needsSupport === false}
                        onChange={() => setNeedsSupport(false)}
                        className="text-indigo-600 focus:ring-indigo-500 border-slate-300"
                      />
                      <span className="text-sm text-slate-700 dark:text-slate-300">No</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input 
                        type="radio" 
                        name="support"
                        checked={needsSupport === true}
                        onChange={() => setNeedsSupport(true)}
                        className="text-indigo-600 focus:ring-indigo-500 border-slate-300"
                      />
                      <span className="text-sm text-slate-700 dark:text-slate-300">Yes</span>
                    </label>
                  </div>
                  {needsSupport && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                      <label className="block text-xs font-semibold text-slate-500 mb-1 mt-2 uppercase">What support do you need?</label>
                      <textarea
                        required
                        value={supportDetails}
                        onChange={(e) => setSupportDetails(e.target.value)}
                        placeholder="e.g. Need a quick call with the manager..."
                        className="w-full rounded-xl border-slate-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white sm:text-sm p-3"
                      />
                    </motion.div>
                  )}
                </div>

                {/* 5. Additional Notes */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                    5. Anything else you'd like to share?
                  </label>
                  <textarea
                    value={additionalNotes}
                    onChange={(e) => setAdditionalNotes(e.target.value)}
                    placeholder="Optional notes..."
                    className="w-full rounded-xl border-slate-200 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-slate-700 dark:border-slate-600 dark:text-white sm:text-sm p-3 min-h-[80px]"
                  />
                </div>

              </form>
            </div>

            <div className="p-6 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
              <button
                type="submit"
                form="reflection-form"
                disabled={isSubmitting || !mood || hasBlocker === null || needsSupport === null}
                className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Submit Reflection"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
