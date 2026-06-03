// src/components/mobile/MobileMeetingJoiner.tsx

"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, limit, orderBy } from "firebase/firestore";
import { Video, Calendar, Clock, ChevronRight, Play } from "lucide-react";
import { useRouter } from "next/navigation";

interface Meeting {
  id: string;
  title: string;
  hostName: string;
  startTime: any; // Timestamp
  meetingUrl?: string;
  chatId?: string;
}

export const MobileMeetingJoiner: React.FC = () => {
  const { user } = useAuth();
  const router = useRouter();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMeetings = async () => {
      if (!user) return;
      try {
        // Query meetings (or fallback mock)
        const snap = await getDocs(
          query(collection(db, "meetings"), limit(5))
        );
        
        if (!snap.empty) {
          setMeetings(
            snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Meeting))
          );
        } else {
          // Add mock meetings for demo purposes if empty
          setMeetings([
            {
              id: "meet_1",
              title: "Daily Standup Meeting",
              hostName: "HR Manager",
              startTime: { toDate: () => new Date(Date.now() + 15 * 60000) },
              meetingUrl: "/meet?room=standup",
              chatId: "standup_chat",
            },
            {
              id: "meet_2",
              title: "Product Roadmap Sync",
              hostName: "Tech Lead",
              startTime: { toDate: () => new Date(Date.now() + 3 * 3600000) },
              meetingUrl: "/meet?room=roadmap",
              chatId: "roadmap_chat",
            },
          ]);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    fetchMeetings();
  }, [user]);

  const handleJoin = (meeting: Meeting) => {
    if (meeting.meetingUrl) {
      router.push(meeting.meetingUrl);
    } else {
      router.push("/meet");
    }
  };

  if (loading) {
    return <div className="text-center text-xs text-gray-400 py-6">Loading upcoming meetings...</div>;
  }

  return (
    <div className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm w-full">
      <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
        <Video className="w-4.5 h-4.5 text-indigo-600" />
        Join Meetings
      </h3>

      <div className="flex flex-col gap-3">
        {meetings.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">No meetings scheduled for today</p>
        ) : (
          meetings.map((meeting) => {
            const timeStr = meeting.startTime?.toDate
              ? meeting.startTime.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : "";
            
            return (
              <div
                key={meeting.id}
                className="flex items-center justify-between p-4 bg-gray-50/50 hover:bg-gray-50 border border-gray-50 hover:border-gray-100 rounded-2xl transition-all duration-300"
              >
                <div className="min-w-0 pr-4">
                  <h4 className="text-xs font-bold text-gray-900 truncate">{meeting.title}</h4>
                  <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>Today at {timeStr}</span>
                    <span>·</span>
                    <span>By {meeting.hostName}</span>
                  </p>
                </div>

                <button
                  onClick={() => handleJoin(meeting)}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[11px] font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
                >
                  <Play className="w-3 h-3 fill-current" />
                  Join
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
