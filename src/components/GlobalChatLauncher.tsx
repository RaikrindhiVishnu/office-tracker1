"use client";

import { useState, useEffect } from "react";
import ProfessionalChatSystem from "./ProfessionalChatSystem";
import { useAuth } from "@/context/AuthContext";
import {
  collection,
  getDocs,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

type User = {
  uid: string;
  name?: string;
  email: string;
  avatar?: string;
  online?: boolean;
};

export default function GlobalChatLauncher() {
  const { user } = useAuth();
  const [showChat, setShowChat] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch users for chat
  useEffect(() => {
    if (!user) return;

    const fetchUsers = async () => {
      try {
        const usersSnapshot = await getDocs(collection(db, "users"));
        const usersList = usersSnapshot.docs
          .map(doc => ({
            uid: doc.id,
            ...doc.data(),
          } as User))
          .filter(u => u.uid !== user?.uid);
        setUsers(usersList);
      } catch (error) {
        console.error("Error fetching users:", error);
      }
    };

    fetchUsers();

    // Listen for presence updates
    const unsubscribePresence = onSnapshot(collection(db, "presence"), (snapshot) => {
      const presenceData: { [key: string]: any } = {};
      snapshot.docs.forEach(doc => {
        presenceData[doc.id] = doc.data();
      });

      setUsers(prev => prev.map(u => ({
        ...u,
        online: presenceData[u.uid]?.online || false,
      })));
    });

    return () => {
      unsubscribePresence();
    };
  }, [user]);

  if (!user) return null;

  return (
    <>
      {/* Global Chat Launcher - Sticky Floating Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <div className="relative">
          {/* Pulse Animation for New Messages */}
          {unreadCount > 0 && (
            <div className="absolute -inset-2 bg-green-500 rounded-full animate-ping opacity-20"></div>
          )}
          
          {/* Unread Count Badge */}
          {unreadCount > 0 && (
            <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold shadow-lg animate-bounce">
              {unreadCount > 99 ? "99+" : unreadCount}
            </div>
          )}

          {/* Main Chat Button */}
          <button
            onClick={() => setShowChat(true)}
            className="w-16 h-16 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-full shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-110 flex items-center justify-center group relative overflow-hidden"
            title="Open Chat"
          >
            {/* WhatsApp Icon */}
            <svg className="w-8 h-8 relative z-10" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.149-.67.149-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521.075-.148.669-1.611.916-2.206.242-.579.487-.501.669-.51l.57-.01c.198 0 .52.074.792.372s1.04 1.016 1.04 2.479 1.065 2.876 1.065 2.876 1.065 5.45-4.436 9.884-9.888 9.884-2.64 0-5.122-1.03-6.988-2.898a9.825 9.825 0 01-2.893-6.994c-.003-5.45 4.437-9.884 9.885-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
            </svg>

            {/* Hover Effect Background */}
            <div className="absolute inset-0 bg-gradient-to-r from-green-600 to-green-700 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          </button>

          {/* Quick Actions Tooltip */}
          <div className="absolute bottom-20 right-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
            <div className="bg-gray-900 text-white px-3 py-2 rounded-lg text-sm whitespace-nowrap shadow-xl">
              <div className="font-semibold">Quick Chat</div>
              <div className="text-xs text-gray-300">
                {unreadCount > 0 ? `${unreadCount} unread messages` : "Click to open chat"}
              </div>
              {/* Tooltip Arrow */}
              <div className="absolute -bottom-2 right-4 w-0 h-0 border-l-8 border-l-transparent border-r-8 border-r-transparent border-t-8 border-t-gray-900"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Chat System Modal */}
      {showChat && (
        <ProfessionalChatSystem 
          users={users} 
          onClose={() => setShowChat(false)}
        />
      )}
    </>
  );
}
