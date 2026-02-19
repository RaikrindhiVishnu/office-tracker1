"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import TeamsStyleChatUpdated from "./TeamsStyleChat";
import TeamsStyleCalls from "@/components/TeamsStyleCalls";
import { collection, onSnapshot, query, where, orderBy, updateDoc, doc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";

/* ---------------- TYPES ---------------- */

type User = {
  uid: string;
  name?: string;
  email: string;
  profilePhoto?: string;
  avatar?: string;
  online?: boolean;
};

interface MeetChatAppProps {
  users: User[];
  isOpen?: boolean;
  onClose?: () => void;
}

type UserStatus = "available" | "busy" | "dnd" | "brb" | "away" | "offline";

type Notification = {
  id: string;
  fromUid: string;
  fromName: string;
  message: string;
  chatId: string;
  timestamp: any;
  read: boolean;
};

export default function MeetChatAppUpdated({ users, isOpen = false, onClose }: MeetChatAppProps) {
  const { user } = useAuth();
  const [showFullScreen, setShowFullScreen] = useState(isOpen);
  const [activeTab, setActiveTab] = useState<"chat" | "calls">("chat");
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [userStatus, setUserStatus] = useState<UserStatus>("available");
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  
  const statusMenuRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);
  const currentUser = users.find(u => u.uid === user?.uid);

  // Update showFullScreen when isOpen prop changes
  useEffect(() => {
    setShowFullScreen(isOpen);
  }, [isOpen]);

  // Listen for notifications
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "notifications"),
      where("toUid", "==", user.uid),
      where("read", "==", false),
      orderBy("timestamp", "desc")
    );

    return onSnapshot(q, (snapshot) => {
      const notifs: Notification[] = [];
      snapshot.forEach((doc) => {
        notifs.push({ id: doc.id, ...doc.data() } as Notification);
      });
      setNotifications(notifs);
    });
  }, [user]);

  // Close menus when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (statusMenuRef.current && !statusMenuRef.current.contains(event.target as Node)) {
        setShowStatusMenu(false);
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleClose = () => {
    setShowFullScreen(false);
    if (onClose) {
      onClose();
    }
  };

  const markAllNotificationsAsRead = async () => {
    const batch = writeBatch(db);
    notifications.forEach((notif) => {
      batch.update(doc(db, "notifications", notif.id), { read: true });
    });
    await batch.commit();
  };

  const markNotificationAsRead = async (notificationId: string) => {
    await updateDoc(doc(db, "notifications", notificationId), {
      read: true,
    });
  };

  const getStatusColor = (status: UserStatus) => {
    switch (status) {
      case "available": return "bg-green-500";
      case "busy": return "bg-red-500";
      case "dnd": return "bg-red-500";
      case "brb": return "bg-yellow-500";
      case "away": return "bg-yellow-500";
      case "offline": return "bg-gray-500";
      default: return "bg-gray-500";
    }
  };

  const getStatusIcon = (status: UserStatus) => {
    switch (status) {
      case "available":
        return (
          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        );
      case "busy":
      case "dnd":
        return <div className="w-2 h-2 bg-white rounded-full"></div>;
      case "brb":
      case "away":
        return (
          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
          </svg>
        );
      case "offline":
        return (
          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  if (!showFullScreen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 h-screen bg-white flex flex-col">
      {/* TOP HEADER BAR - Teams Style */}
      <div className="h-14 bg-[#464775] text-white flex items-center justify-between px-4 border-b border-gray-700">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold">MeetChat</h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Notification Bell */}
          <div className="relative" ref={notificationRef}>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative w-8 h-8 rounded hover:bg-[#5b5b7e] flex items-center justify-center transition-colors"
              title="Notifications"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {notifications.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                  {notifications.length > 9 ? "9+" : notifications.length}
                </span>
              )}
            </button>

            {/* Notification Dropdown */}
            {showNotifications && (
              <div className="absolute top-full right-0 mt-2 w-80 bg-white rounded-lg shadow-2xl border border-gray-200 z-50 max-h-96 overflow-hidden flex flex-col">
                <div className="p-3 border-b border-gray-200 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-800">Notifications</h3>
                  {notifications.length > 0 && (
                    <button
                      onClick={markAllNotificationsAsRead}
                      className="text-xs text-purple-600 hover:text-purple-700 font-medium"
                    >
                      Mark all as read
                    </button>
                  )}
                </div>
                <div className="overflow-y-auto flex-1">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      <svg className="w-12 h-12 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                      </svg>
                      <p className="text-sm">No new notifications</p>
                    </div>
                  ) : (
                    notifications.map((notif) => (
                      <div
                        key={notif.id}
                        className="p-3 hover:bg-gray-50 border-b border-gray-100 cursor-pointer transition-colors"
                        onClick={() => {
                          markNotificationAsRead(notif.id);
                          setShowNotifications(false);
                        }}
                      >
                        <div className="flex items-start gap-3">
                         {(() => {
  const sender = users.find(u => u.uid === notif.fromUid);

  return (
    <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-purple-400 to-blue-400 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
      {sender?.profilePhoto ? (
        <img
          src={sender.profilePhoto}
          alt="Sender"
          className="w-full h-full object-cover"
        />
      ) : (
        notif.fromName.charAt(0).toUpperCase()
      )}
    </div>
  );
})()}

                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-gray-800 truncate">
                              {notif.fromName}
                            </p>
                            <p className="text-sm text-gray-600 truncate">
                              {notif.message}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              {notif.timestamp?.toDate?.()?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Profile Dropdown */}
          <div className="relative" ref={profileMenuRef}>
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center gap-2 px-3 py-1 rounded hover:bg-[#5b5b7e] cursor-pointer transition-colors"
            >
              <div className="relative">
               <div className="w-7 h-7 rounded-full overflow-hidden bg-purple-500 flex items-center justify-center text-sm font-bold">
  {currentUser?.profilePhoto ? (
    <img
      src={currentUser.profilePhoto}
      alt="Profile"
      className="w-full h-full object-cover"
    />
  ) : (
    <span>
      {user?.email?.charAt(0).toUpperCase() || "U"}
    </span>
  )}
</div>

                <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#464775] flex items-center justify-center ${getStatusColor(userStatus)}`}>
                  {getStatusIcon(userStatus)}
                </div>
              </div>
              <span className="text-sm hidden md:block">{user?.email?.split("@")[0] || "User"}</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Profile Dropdown Menu */}
            {showProfileMenu && (
              <div className="absolute top-full right-0 mt-2 w-80 bg-white rounded-lg shadow-2xl overflow-hidden z-50">
                {/* User Info Section */}
                <div className="p-4 border-b border-gray-200">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="relative">
                     <div className="w-12 h-12 rounded-full overflow-hidden bg-purple-500 flex items-center justify-center text-white text-xl font-bold">
  {currentUser?.profilePhoto ? (
    <img
      src={currentUser.profilePhoto}
      alt="Profile"
      className="w-full h-full object-cover"
    />
  ) : (
    <span>
      {user?.email?.charAt(0).toUpperCase() || "U"}
    </span>
  )}
</div>

                      <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center ${getStatusColor(userStatus)}`}>
                        {getStatusIcon(userStatus)}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{user?.email?.split("@")[0] || "User"}</p>
                      <p className="text-sm text-gray-600 truncate">{user?.email}</p>
                    </div>
                  </div>
                  <button className="w-full text-left text-sm text-blue-600 hover:underline">
                    View account
                  </button>
                </div>

                {/* Status Section */}
                <div className="p-2">
                  <button
                    onClick={() => {
                      setUserStatus("available");
                      setShowStatusMenu(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-gray-100 transition-colors ${userStatus === "available" ? "bg-gray-50" : ""}`}
                  >
                    <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <span className="text-gray-900">Available</span>
                  </button>

                  <button
                    onClick={() => {
                      setUserStatus("busy");
                      setShowStatusMenu(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-gray-100 transition-colors ${userStatus === "busy" ? "bg-gray-50" : ""}`}
                  >
                    <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    </div>
                    <span className="text-gray-900">Busy</span>
                  </button>

                  <button
                    onClick={() => {
                      setUserStatus("dnd");
                      setShowStatusMenu(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-gray-100 transition-colors ${userStatus === "dnd" ? "bg-gray-50" : ""}`}
                  >
                    <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    </div>
                    <span className="text-gray-900">Do not disturb</span>
                  </button>

                  <button
                    onClick={() => {
                      setUserStatus("brb");
                      setShowStatusMenu(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-gray-100 transition-colors ${userStatus === "brb" ? "bg-gray-50" : ""}`}
                  >
                    <div className="w-5 h-5 rounded-full bg-yellow-500 flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <span className="text-gray-900">Be right back</span>
                  </button>

                  <button
                    onClick={() => {
                      setUserStatus("away");
                      setShowStatusMenu(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-gray-100 transition-colors ${userStatus === "away" ? "bg-gray-50" : ""}`}
                  >
                    <div className="w-5 h-5 rounded-full bg-yellow-500 flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <span className="text-gray-900">Appear away</span>
                  </button>

                  <button
                    onClick={() => {
                      setUserStatus("offline");
                      setShowStatusMenu(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-gray-100 transition-colors ${userStatus === "offline" ? "bg-gray-50" : ""}`}
                  >
                    <div className="w-5 h-5 rounded-full bg-gray-500 flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <span className="text-gray-900">Appear offline</span>
                  </button>

                  <div className="border-t border-gray-200 my-2"></div>

                  <button className="w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-gray-100 transition-colors">
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-gray-900">Duration</span>
                    <svg className="w-4 h-4 text-gray-600 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>

                  <button className="w-full flex items-center gap-3 px-3 py-2 rounded hover:bg-gray-100 transition-colors">
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span className="text-gray-900">Reset status</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Settings Button */}
          <button className="w-8 h-8 rounded hover:bg-[#5b5b7e] flex items-center justify-center transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>

          {/* More Options */}
          <button className="w-8 h-8 rounded hover:bg-[#5b5b7e] flex items-center justify-center transition-colors">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
            </svg>
          </button>

          {/* Close Button */}
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded hover:bg-[#5b5b7e] flex items-center justify-center transition-colors"
            title="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT SIDEBAR - Navigation */}
        <div className="w-16 bg-[#464775] flex flex-col items-center py-4 gap-2">
          <button
            onClick={() => setActiveTab("chat")}
            className={`w-12 h-12 rounded-lg flex flex-col items-center justify-center transition-colors ${
              activeTab === "chat" ? "bg-[#5b5b7e]" : "hover:bg-[#5b5b7e]"
            }`}
            title="Chat"
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span className="text-[10px] text-white mt-1">Chat</span>
          </button>

          <button
            onClick={() => setActiveTab("calls")}
            className={`w-12 h-12 rounded-lg flex flex-col items-center justify-center transition-colors ${
              activeTab === "calls" ? "bg-[#5b5b7e]" : "hover:bg-[#5b5b7e]"
            }`}
            title="Calls"
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <span className="text-[10px] text-white mt-1">Calls</span>
          </button>
        </div>

        {/* MAIN CONTENT */}
        <div className="flex-1 bg-gray-50">
          {activeTab === "chat" && <TeamsStyleChatUpdated users={users} />}
          {activeTab === "calls" && <TeamsStyleCalls users={users} />}
        </div>
      </div>
    </div>
  );
}