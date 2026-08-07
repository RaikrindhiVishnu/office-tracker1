import React, { useState, useRef } from 'react';

type LocPreference = 'allow' | 'deny' | 'ask';

export function useLocationPrompt() {
  const [isOpen, setIsOpen] = useState(false);
  
  // We store the resolver to wait for user interaction
  const resolverRef = useRef<((val: { lat: number, lng: number, accuracy: number } | null) => void) | null>(null);

  const fetchNativeLocation = (): Promise<{lat: number, lng: number, accuracy: number} | null> => {
    return new Promise((resolve) => {
      if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
        () => {
          alert("Location access was denied by your browser/device. Please enable it in your browser settings.");
          resolve(null);
        },
        { timeout: 5000, enableHighAccuracy: true }
      );
    });
  };

  const getGeoLocationWithPrompt = async (): Promise<{ lat: number, lng: number, accuracy: number } | null> => {
    const pref = localStorage.getItem('loc_prompt_pref') as LocPreference;
    
    if (pref === 'deny') {
      alert("Location access was previously denied. Please clear your site data or change your preference to check in.");
      return null;
    }
    
    if (pref === 'allow') {
      return fetchNativeLocation();
    }
    
    // Show custom modal
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setIsOpen(true);
    });
  };

  const handleAllowNow = async () => {
    setIsOpen(false);
    localStorage.setItem('loc_prompt_pref', 'allow');
    const loc = await fetchNativeLocation();
    if (resolverRef.current) resolverRef.current(loc);
  };

  const handleAskEveryTime = async () => {
    setIsOpen(false);
    localStorage.setItem('loc_prompt_pref', 'ask');
    const loc = await fetchNativeLocation();
    if (resolverRef.current) resolverRef.current(loc);
  };

  const handleDonotAsk = () => {
    setIsOpen(false);
    localStorage.setItem('loc_prompt_pref', 'deny');
    if (resolverRef.current) resolverRef.current(null);
  };

  const LocationPromptModal = () => {
    if (!isOpen) return null;
    return (
      <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-100 dark:border-slate-700">
          <div className="p-6 text-center">
            <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.243-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">Location Access Required</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
              We need your location to verify your check-in from the office premises. How would you like to proceed?
            </p>
            <div className="flex flex-col space-y-3">
              <button onClick={handleAllowNow} className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-all shadow-md hover:shadow-lg active:scale-[0.98]">
                Allow Now
              </button>
              <button onClick={handleAskEveryTime} className="w-full py-3.5 px-4 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl font-semibold transition-all active:scale-[0.98]">
                Ask Every Time
              </button>
              <button onClick={handleDonotAsk} className="w-full py-3.5 px-4 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 rounded-xl font-semibold transition-all active:scale-[0.98]">
                Don't Ask Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return { getGeoLocationWithPrompt, LocationPromptModal };
}
