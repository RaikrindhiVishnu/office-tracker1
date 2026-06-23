"use client";

import React from "react";

export default function FullPageLoader() {
  return (
    <div className="fixed inset-0 z-[9999] bg-white flex flex-col items-center justify-center">
      <div className="flex flex-col items-center">
        
        {/* Sleek Professional Spinner */}
        <div className="relative w-20 h-20 flex items-center justify-center mb-8">
          <svg 
            className="absolute inset-0 w-full h-full animate-spin text-indigo-600" 
            viewBox="0 0 50 50"
          >
            <circle 
              cx="25" cy="25" r="22" 
              fill="none" 
              strokeWidth="3.5" 
              stroke="currentColor" 
              strokeDasharray="100, 200" 
              strokeLinecap="round" 
              className="opacity-20"
            />
            <circle 
              cx="25" cy="25" r="22" 
              fill="none" 
              strokeWidth="3.5" 
              stroke="currentColor" 
              strokeDasharray="90, 150" 
              strokeDashoffset="-35"
              strokeLinecap="round" 
            />
          </svg>
          {/* Subtle Logo inside */}
          <span className="text-3xl relative z-10 animate-pulse">🏢</span>
        </div>

        {/* Brand Text */}
        <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">
          TechGy Innovations
        </h2>
        <h3 className="text-xs font-bold text-slate-400 tracking-[0.2em] uppercase mt-3 animate-pulse">
          Loading Workspace
        </h3>
        
      </div>
    </div>
  );
}
