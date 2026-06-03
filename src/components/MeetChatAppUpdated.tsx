"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import TeamsStyleChatUpdated from "./TeamsStyleChat";
import TeamsStyleCalls from "@/components/TeamsStyleCalls";
import {
  collection, onSnapshot, query, where, orderBy,
  updateDoc, doc, writeBatch, addDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

type User = {
  uid: string;
  name?: string | null;
  email: string | null;
  profilePhoto?: string;
  avatar?: string;
  online?: boolean;
};

interface MeetChatAppProps {
  users: User[];
  isOpen?: boolean;
  onClose?: () => void;
  targetUid?: string | null;
}

type UserStatus = "available" | "busy" | "dnd" | "brb" | "away" | "offline" | "lunch";

type Notification = {
  id: string;
  fromUid: string;
  fromName: string;
  message: string;
  chatId: string;
  timestamp: any;
  read: boolean;
};

const STATUS_CONFIG: Record<UserStatus, { label: string; color: string }> = {
  available: { label: "Available", color: "#22c55e" },
  busy: { label: "Busy", color: "#ef4444" },
  dnd: { label: "Do not disturb", color: "#ef4444" },
  brb: { label: "Be right back", color: "#f59e0b" },
  away: { label: "Appear away", color: "#f59e0b" },
  lunch: { label: "Out for lunch", color: "#a855f7" },
  offline: { label: "Appear offline", color: "#9ca3af" },
};

const getUserName = (u?: Partial<User> | null) => u?.name ?? u?.email ?? "User";

export default function MeetChatAppUpdated({ users, isOpen = false, onClose, targetUid }: MeetChatAppProps) {
  const { user } = useAuth();
  const [showFullScreen, setShowFullScreen] = useState(isOpen);
  const [activeTab, setActiveTab] = useState<"chat" | "calls">("chat");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [myStatus, setMyStatus] = useState<UserStatus>("available");

  const notifRef = useRef<HTMLDivElement>(null);
  const settRef = useRef<HTMLDivElement>(null);
  const profRef = useRef<HTMLDivElement>(null);

  const currentUser = users.find(u => u.uid === user?.uid);
  const myStCfg = STATUS_CONFIG[myStatus];

  useEffect(() => { setShowFullScreen(isOpen); }, [isOpen]);

  // Notifications listener
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "notifications"),
      where("toUid", "==", user.uid),
      where("read", "==", false),
      orderBy("timestamp", "desc")
    );
    return onSnapshot(q, snap =>
      setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() } as Notification)))
    );
  }, [user]);

  // Close dropdowns on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifs(false);
      if (settRef.current && !settRef.current.contains(e.target as Node)) setShowSettings(false);
      if (profRef.current && !profRef.current.contains(e.target as Node)) setShowProfile(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const handleClose = () => { setShowFullScreen(false); if (onClose) onClose(); };

  const markAllRead = async () => {
    const batch = writeBatch(db);
    notifications.forEach(n => batch.update(doc(db, "notifications", n.id), { read: true }));
    await batch.commit();
  };

  const changeStatus = async (s: UserStatus) => {
    setMyStatus(s);
    if (user) await updateDoc(doc(db, "userStatus", user.uid), { status: s, online: s !== "offline" });
    setShowProfile(false);
  };

  if (!showFullScreen) return null;

  const avatarBg = currentUser?.profilePhoto ? "transparent" : "#6366f1";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", fontFamily: "'DM Sans', sans-serif", overflow: "hidden" }}>

      {/* ── HEADER ── */}
      <div style={{
        height: 52, background: "#1e2230", color: "#fff",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 10px", flexShrink: 0, borderBottom: "1px solid rgba(255,255,255,.08)",
        gap: 6,
      }}>
        {/* Left — Back button + Tabs */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>

          {/* Back button */}
          <button
            title="Back"
            onClick={handleClose}
            style={{ ...hdrBtn, flexShrink: 0 }}
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>

          {/* Chat / Calls tabs */}
          <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.08)", borderRadius: 10, padding: "3px" }}>
            <button
              onClick={() => setActiveTab("chat")}
              style={{
                padding: "5px 14px",
                borderRadius: 8, border: "none", cursor: "pointer",
                background: activeTab === "chat" ? "#e8512a" : "transparent",
                color: activeTab === "chat" ? "#fff" : "rgba(255,255,255,.7)",
                fontWeight: 700, fontSize: 13, transition: "all .15s",
              }}
            >
              Chats
            </button>
            <button
              onClick={() => setActiveTab("calls")}
              style={{
                padding: "5px 14px",
                borderRadius: 8, border: "none", cursor: "pointer",
                background: activeTab === "calls" ? "#e8512a" : "transparent",
                color: activeTab === "calls" ? "#fff" : "rgba(255,255,255,.7)",
                fontWeight: 700, fontSize: 13, transition: "all .15s",
              }}
            >
              Calls
            </button>
          </div>
        </div>

        {/* Right — icons */}
        <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>

          {/* NOTIFICATION BELL */}
          <div ref={notifRef} style={{ position: "relative" }}>
            <button
              title="Notifications"
              onClick={() => { setShowNotifs(p => !p); setShowSettings(false); setShowProfile(false); }}
              style={hdrBtn}
            >
              <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {notifications.length > 0 && (
                <span style={{
                  position: "absolute", top: 4, right: 4,
                  width: 8, height: 8, borderRadius: "50%",
                  background: "#e8512a", border: "1.5px solid #1e2230",
                }} />
              )}
            </button>

            {showNotifs && (
              <div style={{ ...dropdown, width: 290, top: 46, right: 0 }}>
                <div style={{ padding: "12px 14px", borderBottom: "1px solid #f0f2f5", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1d23", display: "flex", alignItems: "center", gap: 7 }}>
                    Notifications
                    {notifications.length > 0 && (
                      <span style={{ fontSize: 10.5, fontWeight: 700, background: "#fff3ef", color: "#e8512a", borderRadius: 10, padding: "1px 7px" }}>
                        {notifications.length}
                      </span>
                    )}
                  </div>
                  {notifications.length > 0 && (
                    <button onClick={markAllRead} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11.5, color: "#e8512a", fontWeight: 600 }}>
                      Mark all read
                    </button>
                  )}
                </div>
                <div style={{ maxHeight: 260, overflowY: "auto" }}>
                  {notifications.length === 0
                    ? <div style={{ padding: "28px 14px", textAlign: "center", fontSize: 13, color: "#9aa0ad" }}>🔔 No new notifications</div>
                    : notifications.slice(0, 10).map(n => {
                      const sender = users.find(u => u.uid === n.fromUid);
                      return (
                        <div key={n.id} onClick={async () => { await updateDoc(doc(db, "notifications", n.id), { read: true }); setShowNotifs(false); }}
                          style={{ display: "flex", alignItems: "flex-start", gap: 9, padding: "10px 14px", borderBottom: "1px solid #f9fafb", cursor: "pointer" }}>
                          <div style={{
                            width: 34, height: 34, borderRadius: 9, flexShrink: 0, overflow: "hidden",
                            background: sender?.profilePhoto ? "transparent" : "linear-gradient(135deg,#6366f1,#a78bfa)",
                            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff",
                          }}>
                            {sender?.profilePhoto ? <img src={sender.profilePhoto} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" /> : n.fromName.charAt(0).toUpperCase()}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12.5, fontWeight: 600, color: "#1a1d23", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.fromName}</div>
                            <div style={{ fontSize: 11.5, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.message}</div>
                            <div style={{ fontSize: 10.5, color: "#9aa0ad", marginTop: 2 }}>{n.timestamp?.toDate?.()?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                          </div>
                          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#e8512a", flexShrink: 0, marginTop: 4 }} />
                        </div>
                      );
                    })
                  }
                </div>
              </div>
            )}
          </div>

          {/* SETTINGS */}
          <div ref={settRef} style={{ position: "relative" }}>
            <button title="Settings" onClick={() => { setShowSettings(p => !p); setShowNotifs(false); setShowProfile(false); }} style={hdrBtn}>
              <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
            {showSettings && (
              <div style={{ ...dropdown, width: 200, top: 46, right: 0 }}>
                <div style={{ padding: "10px 14px 6px", fontSize: 13, fontWeight: 700, color: "#1a1d23", borderBottom: "1px solid #f0f2f5" }}>Settings</div>
                <div style={{ padding: "5px 0" }}>
                  {[{ e: "👤", l: "Profile" }, { e: "🔔", l: "Notifications" }, { e: "🎨", l: "Appearance" }, { e: "🔒", l: "Privacy" }, { e: "💬", l: "Chat settings" }].map(item => (
                    <div key={item.l} onClick={() => setShowSettings(false)} style={menuItem}>
                      <span style={{ fontSize: 14 }}>{item.e}</span>{item.l}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* PROFILE */}
          <div ref={profRef} style={{ position: "relative" }}>
            <button
              title="Profile"
              onClick={() => { setShowProfile(p => !p); setShowNotifs(false); setShowSettings(false); }}
              style={{ ...hdrBtn, width: "auto", padding: "0 6px" }}
            >
              <div style={{ position: "relative", width: 28, height: 28, flexShrink: 0 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%", overflow: "hidden",
                  background: currentUser?.profilePhoto ? "transparent" : avatarBg,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 700, color: "#fff",
                }}>
                  {currentUser?.profilePhoto
                    ? <img src={currentUser.profilePhoto} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
                    : getUserName(currentUser).charAt(0).toUpperCase()}
                </div>
                <div style={{
                  width: 9, height: 9, borderRadius: "50%", border: "2px solid #1e2230",
                  background: myStCfg.color, position: "absolute", bottom: -1, right: -1,
                }} />
              </div>
            </button>

            {showProfile && (
              <div style={{ ...dropdown, width: 260, top: 46, right: 0 }} onClick={e => e.stopPropagation()}>
                <div style={{ padding: 14, borderBottom: "1px solid #f0f2f5", display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 13, overflow: "hidden", flexShrink: 0,
                    background: currentUser?.profilePhoto ? "transparent" : "linear-gradient(135deg,#6366f1,#a78bfa)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 18, fontWeight: 700, color: "#fff", position: "relative",
                  }}>
                    {currentUser?.profilePhoto
                      ? <img src={currentUser.profilePhoto} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
                      : getUserName(currentUser).charAt(0).toUpperCase()}
                    <div style={{
                      width: 12, height: 12, borderRadius: "50%", border: "2px solid #fff",
                      background: myStCfg.color, position: "absolute", bottom: -2, right: -2,
                    }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: "#1a1d23", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{getUserName(currentUser ?? user as any)}</div>
                    <div style={{ fontSize: 11.5, color: "#6b7280", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.email}</div>
                  </div>
                </div>
                <div style={{ padding: "4px 10px 2px", fontSize: 10.5, fontWeight: 700, color: "#9aa0ad", textTransform: "uppercase", letterSpacing: ".5px" }}>Set Status</div>
                <div style={{ padding: "3px 0" }}>
                  {(Object.entries(STATUS_CONFIG) as [UserStatus, { label: string; color: string }][]).map(([key, cfg]) => (
                    <div key={key} onClick={() => changeStatus(key)}
                      style={{ ...menuItem, background: myStatus === key ? "#fff3ef" : "transparent" }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: cfg.color, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>{cfg.label}</div>
                      {myStatus === key && (
                        <svg width="14" height="14" fill="none" stroke="#e8512a" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" /></svg>
                      )}
                    </div>
                  ))}
                </div>
                <div style={{ borderTop: "1px solid #f0f2f5", padding: "3px 0" }}>
                  <div onClick={handleClose} style={{ ...menuItem, color: "#ef4444" }}>
                    <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                    Sign out
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MAIN CONTENT — fills remaining height, no overflow */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", minHeight: 0 }}>
        {activeTab === "chat" && <TeamsStyleChatUpdated users={users} targetUid={targetUid} />}
        {activeTab === "calls" && (
          <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
            <TeamsStyleCalls users={users} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ── shared inline style objects ── */
const hdrBtn: React.CSSProperties = {
  width: 34, height: 34, borderRadius: 8, border: "none",
  background: "transparent", cursor: "pointer", color: "rgba(255,255,255,.75)",
  display: "flex", alignItems: "center", justifyContent: "center",
  position: "relative", transition: "background .14s",
};

const dropdown: React.CSSProperties = {
  position: "absolute", background: "#fff",
  border: "1px solid #e8eaf0", borderRadius: 13,
  boxShadow: "0 8px 32px rgba(0,0,0,.14)", zIndex: 9000,
  overflow: "hidden",
};

const menuItem: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 10,
  padding: "9px 14px", cursor: "pointer",
  fontSize: 13, color: "#1a1d23", fontWeight: 500,
  transition: "background .12s",
};