"use client";

import React from "react";

export default function SectionLoader() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[65vh] w-full">
      <div className="flex flex-col items-center">
        
        {/* Sleek Professional Spinner */}
        <div className="relative w-14 h-14 flex items-center justify-center mb-4">
          <svg 
            className="absolute inset-0 w-full h-full animate-spin text-indigo-600" 
            viewBox="0 0 50 50"
          >
            <circle 
              cx="25" cy="25" r="20" 
              fill="none" 
              strokeWidth="4" 
              stroke="currentColor" 
              strokeDasharray="90, 150" 
              strokeLinecap="round" 
              className="opacity-20"
            />
            <circle 
              cx="25" cy="25" r="20" 
              fill="none" 
              strokeWidth="4" 
              stroke="currentColor" 
              strokeDasharray="90, 150" 
              strokeDashoffset="-35"
              strokeLinecap="round" 
            />
          </svg>
          {/* Subtle Logo inside */}
          <span className="text-xl relative z-10 animate-pulse">🏢</span>
        </div>

        {/* Brand Text */}
        <h3 className="text-[11px] font-bold text-slate-400 tracking-[0.2em] uppercase">
          Loading Workspace
        </h3>
        
      </div>
    </div>
  );
}
