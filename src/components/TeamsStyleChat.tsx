"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  collection,
  addDoc,
  onSnapshot,
  orderBy,
  query,
  where,
  serverTimestamp,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import JitsiCall from "@/components/JitsiCall";

/* ─────────────────────── TYPES ─────────────────────── */

type User = {
  uid: string;
  name?: string | null;
  email: string | null;
  profilePhoto?: string;
  avatar?: string;
  online?: boolean;
  status?: "available" | "busy" | "dnd" | "brb" | "away" | "offline";
};

type Message = {
  id: string;
  text?: string;
  imageUrl?: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  senderUid: string;
  senderName?: string;
  status?: "sent" | "delivered" | "seen";
  createdAt: any;
  readBy?: string[];
  editedAt?: any;
  isEdited?: boolean;
};

type Chat = {
  id: string;
  participants: string[];
  lastMessage?: string;
  lastMessageTime?: any;
  unreadCount?: { [uid: string]: number };
  isGroup?: boolean;
  groupName?: string;
  groupAvatar?: string;
  createdBy?: string;
  createdAt?: any;
};

type Notification = {
  id: string;
  fromUid: string;
  fromName: string;
  message: string;
  chatId: string;
  timestamp: any;
  read: boolean;
};

const getUserName = (user?: Partial<User> | null): string =>
  user?.name ?? user?.email ?? "User";

/* ═══════════════════════ COMPONENT ═══════════════════════ */

export default function TeamsStyleChat({ users }: { users: User[] }) {
  const { user } = useAuth();

  /* ── State ── */
  const [jitsiRoom, setJitsiRoom]               = useState<string | null>(null);
  const [selectedChat, setSelectedChat]         = useState<Chat | null>(null);
  const [messages, setMessages]                 = useState<Message[]>([]);
  const [text, setText]                         = useState("");
  const [typing, setTyping]                     = useState<string[]>([]);
  const [searchQuery, setSearchQuery]           = useState("");
  const [chats, setChats]                       = useState<Chat[]>([]);
  const [showCreateGroup, setShowCreateGroup]   = useState(false);
  const [groupName, setGroupName]               = useState("");
  const [selectedMembers, setSelectedMembers]   = useState<string[]>([]);
  const [activeTab, setActiveTab]               = useState<"all" | "direct" | "groups">("all");
  const [notifications, setNotifications]       = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText]                 = useState("");
  const [selectedFile, setSelectedFile]         = useState<File | null>(null);
  const [uploading, setUploading]               = useState(false);

  const messagesEndRef    = useRef<HTMLDivElement>(null);
  const typingTimeout     = useRef<any>(null);
  const fileInputRef      = useRef<HTMLInputElement>(null);
  const notificationRef   = useRef<HTMLDivElement>(null);

  const chatId = useMemo(() => selectedChat?.id || null, [selectedChat]);

  /* ─────────── Update own online status ─────────── */
  useEffect(() => {
    if (!user) return;
    const updateStatus = () =>
      setDoc(doc(db, "userStatus", user.uid), { online: true, status: "available", lastSeen: serverTimestamp() }, { merge: true });
    updateStatus();
    const interval = setInterval(updateStatus, 30000);
    return () => {
      clearInterval(interval);
      setDoc(doc(db, "userStatus", user.uid), { online: false, lastSeen: serverTimestamp() }, { merge: true });
    };
  }, [user]);

  /* ─────────── Notifications ─────────── */
  useEffect(() => {
    if (!user) return;
    return onSnapshot(
      query(collection(db, "notifications"), where("toUid", "==", user.uid), where("read", "==", false), orderBy("timestamp", "desc")),
      (snap) => setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() } as Notification)))
    );
  }, [user]);

  /* ─────────── Close notification dropdown on outside click ─────────── */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(e.target as Node))
        setShowNotifications(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /* ─────────── Auto scroll ─────────── */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* ─────────── Listen to all chats ─────────── */
  useEffect(() => {
    if (!user) return;

    const unsubs: (() => void)[] = [];

    // Seed direct chats
    const initial: Chat[] = users
      .filter(u => u.uid !== user.uid)
      .map(u => ({
        id: [user.uid, u.uid].sort().join("_"),
        participants: [user.uid, u.uid],
        unreadCount: { [user.uid]: 0 },
        isGroup: false,
      }));
    setChats(initial);

    // Direct message listeners
    users.forEach(u => {
      if (u.uid === user.uid) return;
      const tempChatId = [user.uid, u.uid].sort().join("_");
      const unsub = onSnapshot(
        query(collection(db, "chats", tempChatId, "messages"), orderBy("createdAt", "desc")),
        (snap) => {
          const unread = snap.docs.filter(d => {
            const data = d.data();
            return data.senderUid !== user.uid && (!data.readBy || !data.readBy.includes(user.uid));
          }).length;
          const last = snap.docs[0]?.data();
          setChats(prev => prev.map(c =>
            c.id === tempChatId
              ? { ...c, unreadCount: { ...c.unreadCount, [user.uid]: unread }, lastMessage: last?.text || last?.fileName || "File", lastMessageTime: last?.createdAt }
              : c
          ));
        }
      );
      unsubs.push(unsub);
    });

    // Group chat listeners
    const groupUnsub = onSnapshot(
      query(collection(db, "groupChats"), where("participants", "array-contains", user.uid)),
      (snap) => {
        snap.forEach(groupDoc => {
          const gd = groupDoc.data();
          const msgsUnsub = onSnapshot(
            query(collection(db, "groupChats", groupDoc.id, "messages"), orderBy("createdAt", "desc")),
            (msgsSnap) => {
              const unread = msgsSnap.docs.filter(d => {
                const data = d.data();
                return data.senderUid !== user.uid && (!data.readBy || !data.readBy.includes(user.uid));
              }).length;
              const last = msgsSnap.docs[0]?.data();
              setChats(prev => {
                const exists = prev.find(c => c.id === groupDoc.id);
                const updated = { id: groupDoc.id, participants: gd.participants, unreadCount: { [user.uid]: unread }, lastMessage: last?.text || last?.fileName || "File", lastMessageTime: last?.createdAt, isGroup: true, groupName: gd.groupName, groupAvatar: gd.groupAvatar, createdBy: gd.createdBy, createdAt: gd.createdAt };
                return exists ? prev.map(c => c.id === groupDoc.id ? { ...c, ...updated } : c) : [...prev, updated];
              });
            }
          );
          unsubs.push(msgsUnsub);
        });
      }
    );
    unsubs.push(groupUnsub);
    return () => unsubs.forEach(u => u());
  }, [user, users]);

  /* ─────────── Listen to messages ─────────── */
  useEffect(() => {
    if (!chatId || !selectedChat) return;
    const path = selectedChat.isGroup ? `groupChats/${chatId}/messages` : `chats/${chatId}/messages`;
    return onSnapshot(query(collection(db, path), orderBy("createdAt", "asc")), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Message));
      setMessages(data);
      const batch = writeBatch(db);
      data.forEach(m => {
        if (m.senderUid !== user?.uid && (!m.readBy || !m.readBy.includes(user!.uid)))
          batch.update(doc(db, path, m.id), { readBy: [...(m.readBy || []), user!.uid], status: "seen" });
      });
      batch.commit();
    });
  }, [chatId, selectedChat, user]);

  /* ─────────── Typing indicator ─────────── */
  useEffect(() => {
    if (!chatId || !selectedChat) return;
    const path = selectedChat.isGroup ? `groupChats/${chatId}/typing` : `chats/${chatId}/typing`;
    return onSnapshot(query(collection(db, path)), (snap) => {
      const names: string[] = [];
      snap.forEach(d => {
        if (d.id !== user?.uid && d.data().typing) {
          const u = users.find(u => u.uid === d.id);
          if (u) names.push(u.name ?? u.email ?? "User");
        }
      });
      setTyping(names);
    });
  }, [chatId, selectedChat, user, users]);

  /* ─────────── Handlers ─────────── */
  const handleTyping = async () => {
    if (!chatId || !user || !selectedChat) return;
    const path = selectedChat.isGroup ? `groupChats/${chatId}/typing` : `chats/${chatId}/typing`;
    await setDoc(doc(db, path, user.uid), { typing: true, timestamp: serverTimestamp() });
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => deleteDoc(doc(db, path, user.uid)), 1500);
  };

  const sendText = async () => {
    if ((!text.trim() && !selectedFile) || !chatId || !user || !selectedChat) return;
    setUploading(true);
    try {
      let fileUrl = "", fileName = "", fileType = "";
      if (selectedFile) {
        const r = ref(storage, `chat-files/${chatId}/${Date.now()}_${selectedFile.name}`);
        await uploadBytes(r, selectedFile);
        fileUrl = await getDownloadURL(r);
        fileName = selectedFile.name;
        fileType = selectedFile.type;
      }
      const path = selectedChat.isGroup ? `groupChats/${chatId}/messages` : `chats/${chatId}/messages`;
      const msg: any = { senderUid: user.uid, senderName: getUserName(user), status: "sent", readBy: [user.uid], createdAt: serverTimestamp() };
      if (text.trim()) msg.text = text;
      if (fileUrl) { msg.fileUrl = fileUrl; msg.fileName = fileName; msg.fileType = fileType; }
      await addDoc(collection(db, path), msg);

      for (const pid of selectedChat.participants.filter(p => p !== user.uid))
        await addDoc(collection(db, "notifications"), { fromUid: user.uid, fromName: getUserName(user), toUid: pid, message: text || fileName || "Sent a file", chatId, timestamp: serverTimestamp(), read: false });

      const typingPath = selectedChat.isGroup ? `groupChats/${chatId}/typing` : `chats/${chatId}/typing`;
      await deleteDoc(doc(db, typingPath, user.uid));
      setText("");
      setSelectedFile(null);
    } catch (e) {
      console.error(e);
    } finally {
      setUploading(false);
    }
  };

  const deleteMessage = async (id: string) => {
    if (!selectedChat || !chatId) return;
    const path = selectedChat.isGroup ? `groupChats/${chatId}/messages` : `chats/${chatId}/messages`;
    await deleteDoc(doc(db, path, id));
  };

  const saveEditMessage = async () => {
    if (!editingMessageId || !editText.trim() || !selectedChat || !chatId) return;
    const path = selectedChat.isGroup ? `groupChats/${chatId}/messages` : `chats/${chatId}/messages`;
    await updateDoc(doc(db, path, editingMessageId), { text: editText, isEdited: true, editedAt: serverTimestamp() });
    setEditingMessageId(null);
    setEditText("");
  };

  const markAllNotificationsAsRead = async () => {
    const batch = writeBatch(db);
    notifications.forEach(n => batch.update(doc(db, "notifications", n.id), { read: true }));
    await batch.commit();
  };

  const goToChat = async (notif: Notification) => {
    const chat = chats.find(c => c.id === notif.chatId);
    if (chat) { setSelectedChat(chat); await updateDoc(doc(db, "notifications", notif.id), { read: true }); setShowNotifications(false); }
  };

  /* ─────────── Jitsi call ─────────── */
  const initiateCall = () => {
    if (!selectedChat || !user || selectedChat.isGroup) return;
    setJitsiRoom(`office_${selectedChat.id}`);
  };

  /* ─────────── Create group ─────────── */
  const createGroup = async () => {
    if (!groupName.trim() || selectedMembers.length < 2 || !user) return;
    const participants = [...selectedMembers, user.uid];
    const groupRef = await addDoc(collection(db, "groupChats"), { groupName: groupName.trim(), participants, createdBy: user.uid, createdAt: serverTimestamp() });
    await addDoc(collection(db, "groupChats", groupRef.id, "messages"), { text: `${getUserName(user)} created the group "${groupName.trim()}"`, senderUid: "system", senderName: "System", createdAt: serverTimestamp(), readBy: participants });
    setGroupName(""); setSelectedMembers([]); setShowCreateGroup(false);
    setSelectedChat({ id: groupRef.id, participants, isGroup: true, groupName: groupName.trim(), createdBy: user.uid });
  };

  /* ─────────── Helpers ─────────── */
  const getChatName = (chat: Chat) => {
    if (chat.isGroup) return chat.groupName || "Unnamed Group";
    const other = users.find(u => u.uid === chat.participants.find(p => p !== user?.uid));
    return other?.name || other?.email || "Unknown";
  };

  const getChatAvatar = (chat: Chat) => {
    if (chat.isGroup) return chat.groupName?.charAt(0).toUpperCase() || "G";
    const other = users.find(u => u.uid === chat.participants.find(p => p !== user?.uid));
    return (other?.name || other?.email)?.charAt(0).toUpperCase() || "?";
  };

  const getOtherUser = (chat: Chat) =>
    users.find(u => u.uid === chat.participants.find(p => p !== user?.uid));

  const isUserOnline = (chat: Chat) => {
    if (chat.isGroup) return false;
    return getOtherUser(chat)?.online || false;
  };

  const getUserStatus = (chat: Chat) => {
    if (chat.isGroup) return "";
    const other = getOtherUser(chat);
    if (!other?.online) return "Offline";
    const s = other.status;
    return s === "available" ? "Available" : s === "busy" ? "Busy" : s === "dnd" ? "Do not disturb" : s === "brb" ? "Be right back" : s === "away" ? "Away" : "Offline";
  };

  const getUnreadCount = (id: string) => {
    if (!user) return 0;
    return chats.find(c => c.id === id)?.unreadCount?.[user.uid] || 0;
  };

  const getFileIcon = (ft: string) => {
    if (ft.startsWith("image/")) return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
    if (ft.startsWith("video/")) return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>;
    if (ft.includes("pdf")) return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>;
    return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;
  };

  /* ─────────── Sorted / filtered chats ─────────── */
  const sortedChats = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return [...chats]
      .filter(chat => {
        if (activeTab === "direct" && chat.isGroup) return false;
        if (activeTab === "groups" && !chat.isGroup) return false;
        if (!q) return true;
        if (chat.isGroup) return chat.groupName?.toLowerCase().includes(q);
        const other = getOtherUser(chat);
        return other?.name?.toLowerCase().includes(q) || other?.email?.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        if (a.lastMessageTime && b.lastMessageTime) return (b.lastMessageTime?.toMillis() || 0) - (a.lastMessageTime?.toMillis() || 0);
        if (a.lastMessageTime) return -1;
        if (b.lastMessageTime) return 1;
        return getChatName(a).localeCompare(getChatName(b));
      });
  }, [chats, activeTab, searchQuery, users, user]);

  /* ═══════════════════════ RENDER ═══════════════════════ */
  return (
    <>
      <input ref={fileInputRef} type="file" className="hidden" onChange={e => { if (e.target.files?.[0]) setSelectedFile(e.target.files[0]); }} />

      {/* ── CREATE GROUP MODAL ── */}
      {showCreateGroup && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-800">Create Group</h3>
              <button onClick={() => { setShowCreateGroup(false); setGroupName(""); setSelectedMembers([]); }} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <input type="text" value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="Group name" className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-purple-300 mb-4" />
            <p className="text-sm font-medium text-gray-700 mb-2">Select Members ({selectedMembers.length} selected)</p>
            <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg mb-5">
              {users.filter(u => u.uid !== user?.uid).map(u => (
                <button key={u.uid} onClick={() => setSelectedMembers(prev => prev.includes(u.uid) ? prev.filter(id => id !== u.uid) : [...prev, u.uid])}
                  className={`w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors ${selectedMembers.includes(u.uid) ? "bg-purple-50" : ""}`}>
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${selectedMembers.includes(u.uid) ? "bg-purple-600 border-purple-600" : "border-gray-300"}`}>
                    {selectedMembers.includes(u.uid) && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                  </div>
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-blue-400 flex items-center justify-center text-white font-bold text-xs shrink-0">
                    {getUserName(u).charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-gray-800">{u.name || u.email}</span>
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setShowCreateGroup(false); setGroupName(""); setSelectedMembers([]); }} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
              <button onClick={createGroup} disabled={!groupName.trim() || selectedMembers.length < 2} className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed">Create Group</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MAIN LAYOUT ── */}
      <div className="flex h-full">

        {/* ── SIDEBAR ── */}
        <div className="w-80 bg-white border-r border-gray-200 flex flex-col shrink-0">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-gray-800">Chats</h2>
              <div className="flex items-center gap-1">
                {/* Notification bell */}
                <div className="relative" ref={notificationRef}>
                  <button onClick={() => setShowNotifications(!showNotifications)} className="relative w-9 h-9 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors">
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                    {notifications.length > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                        {notifications.length > 9 ? "9+" : notifications.length}
                      </span>
                    )}
                  </button>
                  {showNotifications && (
                    <div className="absolute top-full right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 max-h-96 overflow-hidden flex flex-col">
                      <div className="p-3 border-b border-gray-200 flex items-center justify-between">
                        <span className="font-semibold text-gray-800">Notifications</span>
                        {notifications.length > 0 && <button onClick={markAllNotificationsAsRead} className="text-xs text-purple-600 hover:text-purple-700 font-medium">Mark all read</button>}
                      </div>
                      <div className="overflow-y-auto flex-1">
                        {notifications.length === 0 ? (
                          <div className="p-8 text-center text-gray-400 text-sm">No new notifications</div>
                        ) : notifications.map(n => (
                          <button key={n.id} onClick={() => goToChat(n)} className="w-full p-3 hover:bg-gray-50 border-b border-gray-100 text-left">
                            <div className="flex items-start gap-3">
                              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-400 to-blue-400 flex items-center justify-center text-white font-bold text-sm shrink-0">{n.fromName.charAt(0).toUpperCase()}</div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm text-gray-800 truncate">{n.fromName}</p>
                                <p className="text-xs text-gray-500 truncate">{n.message}</p>
                                <p className="text-xs text-gray-400 mt-0.5">{n.timestamp?.toDate?.()?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                {/* New group */}
                <button onClick={() => setShowCreateGroup(true)} title="New group" className="w-9 h-9 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors">
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex bg-gray-100 rounded-lg p-1 gap-1 mb-3">
              {(["all", "direct", "groups"] as const).map(t => (
                <button key={t} onClick={() => setActiveTab(t)} className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-all capitalize ${activeTab === t ? "bg-white shadow text-purple-700" : "text-gray-500 hover:text-gray-700"}`}>{t}</button>
              ))}
            </div>

            {/* Search */}
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input type="text" placeholder="Search chats" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-purple-200" />
            </div>
          </div>

          {/* Chat list */}
          <div className="flex-1 overflow-y-auto">
            {sortedChats.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">No chats found</div>
            ) : sortedChats.map(chat => {
              const unread = getUnreadCount(chat.id);
              const online = isUserOnline(chat);
              const other = !chat.isGroup ? getOtherUser(chat) : null;
              return (
                <button key={chat.id} onClick={() => setSelectedChat(chat)}
                  className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors border-b border-gray-100 relative ${selectedChat?.id === chat.id ? "bg-purple-50" : ""}`}>
                  {selectedChat?.id === chat.id && <div className="absolute right-0 top-2 bottom-2 w-1 bg-purple-600 rounded-l-full" />}
                  <div className="relative shrink-0">
                    {other?.profilePhoto ? (
                      <img src={other.profilePhoto} className="w-10 h-10 rounded-full object-cover" alt="" />
                    ) : (
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${chat.isGroup ? "bg-gradient-to-br from-green-400 to-teal-500" : "bg-gradient-to-br from-purple-400 to-blue-500"}`}>
                        {getChatAvatar(chat)}
                      </div>
                    )}
                    {online && !chat.isGroup && <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />}
                    {chat.isGroup && (
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center shadow">
                        <svg className="w-2.5 h-2.5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <p className={`text-sm truncate ${unread > 0 ? "font-bold text-gray-900" : "font-semibold text-gray-700"}`}>{getChatName(chat)}</p>
                      {unread > 0 && <span className="bg-purple-600 text-white text-xs rounded-full min-w-[20px] h-5 flex items-center justify-center font-bold px-1 ml-2 shrink-0">{unread}</span>}
                    </div>
                    {chat.lastMessage && <p className="text-xs text-gray-400 truncate">{chat.lastMessage}</p>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── CONVERSATION AREA ── */}
        {!selectedChat ? (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-purple-400 to-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
              </div>
              <h3 className="text-xl font-bold text-gray-700 mb-2">Select a conversation</h3>
              <p className="text-gray-400 text-sm">Choose from your chats or create a group</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col bg-gray-50 min-w-0">

            {/* Chat header */}
            <div className="h-16 bg-white border-b border-gray-200 px-5 flex items-center justify-between shrink-0 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="relative">
                  {(() => {
                    const other = !selectedChat.isGroup ? getOtherUser(selectedChat) : null;
                    return other?.profilePhoto ? (
                      <img src={other.profilePhoto} className="w-9 h-9 rounded-full object-cover" alt="" />
                    ) : (
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm ${selectedChat.isGroup ? "bg-gradient-to-br from-green-400 to-teal-500" : "bg-gradient-to-br from-purple-400 to-blue-500"}`}>
                        {getChatAvatar(selectedChat)}
                      </div>
                    );
                  })()}
                  {isUserOnline(selectedChat) && !selectedChat.isGroup && <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full" />}
                </div>
                <div>
                  <p className="font-bold text-gray-800 text-sm">{getChatName(selectedChat)}</p>
                  {typing.length > 0 ? (
                    <p className="text-xs text-purple-600 font-medium animate-pulse">{typing.join(", ")} {typing.length === 1 ? "is" : "are"} typing…</p>
                  ) : selectedChat.isGroup ? (
                    <p className="text-xs text-gray-400">{selectedChat.participants.length} members</p>
                  ) : (
                    <p className="text-xs text-gray-400">{getUserStatus(selectedChat)}</p>
                  )}
                </div>
              </div>

              {/* Call buttons — only for direct chats */}
              {!selectedChat.isGroup && (
                <div className="flex items-center gap-1">
                  <button onClick={initiateCall} title="Start video/audio call" className="w-9 h-9 rounded-lg hover:bg-purple-50 flex items-center justify-center transition-colors group">
                    <svg className="w-5 h-5 text-gray-500 group-hover:text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                  </button>
                </div>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-5 space-y-1">
              {messages.length === 0 ? (
                <div className="text-center py-16 text-gray-400 text-sm">No messages yet. Start the conversation!</div>
              ) : messages.map((m, idx) => {
                const mine = m.senderUid === user?.uid;
                const isSystem = m.senderUid === "system";
                const showAvatar = idx === 0 || messages[idx - 1]?.senderUid !== m.senderUid;
                const isRead = (m.readBy?.length ?? 0) > 1;
                const sender = users.find(u => u.uid === m.senderUid);

                if (isSystem) return (
                  <div key={m.id} className="flex justify-center my-3">
                    <span className="bg-gray-200 text-gray-500 text-xs px-4 py-1.5 rounded-full">{m.text}</span>
                  </div>
                );

                return (
                  <div key={m.id} className={`flex gap-2.5 group ${mine ? "flex-row-reverse" : "flex-row"} ${showAvatar ? "mt-4" : "mt-0.5"}`}>
                    {/* Avatar */}
                    {!mine ? (
                      showAvatar ? (
                        <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 mt-1">
                          {sender?.profilePhoto ? <img src={sender.profilePhoto} className="w-full h-full object-cover" alt="" /> :
                            <div className="w-full h-full bg-gradient-to-br from-purple-400 to-blue-400 flex items-center justify-center text-white text-xs font-bold">{(sender?.name || m.senderName || "?").charAt(0).toUpperCase()}</div>}
                        </div>
                      ) : <div className="w-8 shrink-0" />
                    ) : null}

                    <div className={`max-w-[68%] flex flex-col ${mine ? "items-end" : "items-start"}`}>
                      {selectedChat.isGroup && !mine && showAvatar && (
                        <p className="text-xs text-gray-400 mb-1 px-1">{sender?.name || m.senderName}</p>
                      )}

                      {editingMessageId === m.id && mine ? (
                        <div className="bg-white rounded-xl p-3 shadow-sm w-full">
                          <textarea value={editText} onChange={e => setEditText(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-purple-300 resize-none" rows={2} autoFocus />
                          <div className="flex gap-2 mt-2">
                            <button onClick={saveEditMessage} className="px-3 py-1 bg-purple-600 text-white text-xs rounded-lg hover:bg-purple-700">Save</button>
                            <button onClick={() => { setEditingMessageId(null); setEditText(""); }} className="px-3 py-1 bg-gray-100 text-gray-600 text-xs rounded-lg hover:bg-gray-200">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className={`relative px-3.5 py-2 rounded-2xl text-sm shadow-sm ${mine ? "bg-purple-600 text-white rounded-br-sm" : "bg-white text-gray-800 rounded-bl-sm"}`}>
                            {m.text && <p className="break-words leading-relaxed">{m.text}</p>}
                            {m.imageUrl && <img src={m.imageUrl} className="mt-1 rounded-lg max-h-48 cursor-pointer" alt="Shared" onClick={() => window.open(m.imageUrl, "_blank")} />}
                            {m.fileUrl && !m.imageUrl && (
                              <a href={m.fileUrl} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-2 mt-1 p-2 rounded-lg ${mine ? "bg-purple-700" : "bg-gray-100"}`}>
                                {getFileIcon(m.fileType || "")}
                                <span className="text-sm truncate max-w-[180px]">{m.fileName}</span>
                              </a>
                            )}
                            {m.isEdited && <p className={`text-xs mt-0.5 ${mine ? "text-purple-200" : "text-gray-400"}`}>(edited)</p>}

                            {/* Hover actions */}
                            {mine && (
                              <div className="absolute -top-8 right-0 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                <button onClick={() => { setEditingMessageId(m.id); setEditText(m.text || ""); }} className="p-1.5 bg-gray-700 text-white rounded-lg hover:bg-gray-800">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                </button>
                                <button onClick={() => { if (confirm("Delete this message?")) deleteMessage(m.id); }} className="p-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                              </div>
                            )}
                          </div>

                          <div className={`flex items-center gap-1 mt-1 px-1 ${mine ? "flex-row-reverse" : ""}`}>
                            <p className="text-xs text-gray-400">{m.createdAt?.toDate?.()?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) || "Now"}</p>
                            {mine && <span className={`text-xs font-bold ${isRead ? "text-purple-500" : "text-gray-300"}`}>{isRead ? "✓✓" : m.status === "delivered" ? "✓✓" : "✓"}</span>}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="bg-white border-t border-gray-200 p-4 shrink-0">
              {selectedFile && (
                <div className="mb-2 flex items-center gap-2 bg-purple-50 border border-purple-200 px-3 py-2 rounded-lg">
                  {getFileIcon(selectedFile.type)}
                  <span className="text-sm text-gray-700 flex-1 truncate">{selectedFile.name}</span>
                  <button onClick={() => setSelectedFile(null)} className="text-gray-400 hover:text-gray-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              )}
              <div className="flex items-end gap-2">
                <button onClick={() => fileInputRef.current?.click()} className="w-9 h-9 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors shrink-0" title="Attach file">
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                </button>
                <textarea
                  value={text}
                  onChange={e => { setText(e.target.value); handleTyping(); }}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendText(); } }}
                  placeholder="Type a message…"
                  rows={1}
                  disabled={uploading}
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-purple-200 resize-none bg-gray-50"
                  style={{ minHeight: 42, maxHeight: 120 }}
                />
                <button
                  onClick={sendText}
                  disabled={(!text.trim() && !selectedFile) || uploading}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all ${(text.trim() || selectedFile) && !uploading ? "bg-purple-600 hover:bg-purple-700 text-white shadow-sm" : "bg-gray-100 text-gray-300 cursor-not-allowed"}`}
                >
                  {uploading ? (
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── JITSI CALL — rendered INSIDE the return ── */}
      {jitsiRoom && user && (
        <JitsiCall
          roomName={jitsiRoom}
          displayName={user.displayName || user.email || "User"}
          onClose={() => setJitsiRoom(null)}
        />
      )}
    </>
  );
}