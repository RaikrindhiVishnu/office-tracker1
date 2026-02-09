"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import MeetPanel from "@/components/MeetPanel";
import CallHistory from "@/components/CallHistory";
import ProfessionalChatSystem from "@/components/ProfessionalChatSystem";
/* ---------------- TYPES ---------------- */

type User = {
  uid: string;
  name?: string;
  email: string;
  avatar?: string;
  online?: boolean;
};

export default function MeetChatApp({ users }: { users: User[] }) {
  const { user } = useAuth();

  const [showProfessionalChat, setShowProfessionalChat] = useState(false);

  return (
    <div className="h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex items-center justify-center p-4">
      
      {/* ✅ CHAT MODAL */}
      {showProfessionalChat && (
        <ProfessionalChatSystem
          users={users}
          onClose={() => setShowProfessionalChat(false)}
        />
      )}

      {/* MAIN CARD */}
      <div className="w-full max-w-7xl h-[calc(100vh-2rem)] bg-white rounded-3xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col">
        
        {/* HEADER */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-gray-100">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Meet & Chat</h1>
            <p className="text-sm text-gray-500">Connect with your team</p>
          </div>

          {/* ✅ OPEN CHAT BUTTON */}
          <button
            onClick={() => setShowProfessionalChat(true)}
            className="px-6 py-3 bg-green-700 text-white rounded-full font-semibold shadow-lg hover:bg-green-800 transition-all duration-300 hover:scale-105 flex items-center gap-2"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            Open Chat
          </button>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            
            {/* VIDEO */}
            <div className="bg-gradient-to-br from-blue-50 to-white p-6 rounded-2xl border border-blue-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-800">
                   Calls
                </h3>
              </div>

              <MeetPanel users={users} />
            </div>

            {/* CALL HISTORY */}
            <div className="bg-gradient-to-br from-purple-50 to-white p-6 rounded-2xl border border-purple-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-800">
                  Recent Calls
                </h3>
              </div>

              <CallHistory />
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
