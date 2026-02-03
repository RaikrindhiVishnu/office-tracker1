"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  addDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import MeetPanel from "@/components/MeetPanel";
import CallHistory from "@/components/CallHistory";

/* ---------------- TYPES ---------------- */

type User = {
  uid: string;
  name?: string;
  email: string;
  avatar?: string;
  online?: boolean;
};

type Message = {
  id: string;
  text?: string;
  imageUrl?: string;
  audioUrl?: string;
  senderUid: string;
  status?: "sent" | "delivered" | "seen";
  edited?: boolean;
  deleted?: boolean;
  reactions?: { [uid: string]: string };
  replyTo?: string;
  createdAt: any;
};

/* ---------------- THEME COLOR ---------------- */
const PRIMARY = "emerald"; // Change to: blue, violet, purple, indigo, teal, cyan, sky, rose, pink

/* ---------------- COMPONENT ---------------- */

export default function MeetChatApp({ users }: { users: User[] }) {
  const { user } = useAuth();

  // View states
  const [view, setView] = useState<"meet" | "chat">("meet");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  
  // Message states
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [typing, setTyping] = useState(false);
  
  // UI states
  const [showMenu, setShowMenu] = useState<string | null>(null);
  const [fullImage, setFullImage] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const fileRef = useRef<HTMLInputElement>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const typingTimeout = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const chatId = useMemo(() => {
    if (!user || !selectedUser) return null;
    return [user.uid, selectedUser.uid].sort().join("_");
  }, [user, selectedUser]);

  /* ---------------- AUTO SCROLL ---------------- */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* ---------------- PRESENCE ---------------- */
  useEffect(() => {
    if (!user) return;

    const ref = doc(db, "presence", user.uid);
    setDoc(ref, { online: true, lastSeen: serverTimestamp() });

    return () => {
      setDoc(ref, { online: false, lastSeen: serverTimestamp() });
    };
  }, [user]);

  /* ---------------- LISTEN MESSAGES ---------------- */
  useEffect(() => {
    if (!chatId) return;

    return onSnapshot(
      query(
        collection(db, "chats", chatId, "messages"),
        orderBy("createdAt", "asc")
      ),
      (snap) => {
        const data = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }));

        setMessages(data);

        data.forEach((m) => {
          if (m.senderUid !== user?.uid && m.status !== "seen") {
            updateDoc(doc(db, "chats", chatId, "messages", m.id), {
              status: "seen",
            });
          }
        });
      }
    );
  }, [chatId, user]);

  /* ---------------- TYPING INDICATOR ---------------- */
  useEffect(() => {
    if (!chatId || !selectedUser) return;

    return onSnapshot(
      doc(db, "chats", chatId, "typing", selectedUser.uid),
      (snap) => setTyping(snap.exists())
    );
  }, [chatId, selectedUser]);

  const handleTyping = async () => {
    if (!chatId || !user) return;

    await setDoc(doc(db, "chats", chatId, "typing", user.uid), {
      typing: true,
    });

    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      deleteDoc(doc(db, "chats", chatId!, "typing", user.uid));
    }, 1500);
  };

  /* ---------------- SEND MESSAGE ---------------- */
  const sendText = async () => {
    if (!text.trim() || !chatId || !user) return;

    if (editingId) {
      await updateDoc(doc(db, "chats", chatId, "messages", editingId), {
        text,
        edited: true,
      });
      setEditingId(null);
    } else {
      await addDoc(collection(db, "chats", chatId, "messages"), {
        text,
        senderUid: user.uid,
        status: "sent",
        replyTo: replyingTo?.id || null,
        createdAt: serverTimestamp(),
      });
    }

    setText("");
    setReplyingTo(null);
  };

  const deleteMessage = async (id: string) => {
    await updateDoc(doc(db, "chats", chatId!, "messages", id), {
      deleted: true,
      text: "",
      imageUrl: "",
      audioUrl: "",
    });
  };

  const addReaction = async (messageId: string, emoji: string) => {
    const message = messages.find((m) => m.id === messageId);
    const reactions = message?.reactions || {};
    reactions[user!.uid] = emoji;

    await updateDoc(doc(db, "chats", chatId!, "messages", messageId), {
      reactions,
    });
  };

  /* ---------------- IMAGE ---------------- */
  const sendImage = async (file: File) => {
    const url = URL.createObjectURL(file);
    await addDoc(collection(db, "chats", chatId!, "messages"), {
      imageUrl: url,
      senderUid: user!.uid,
      status: "sent",
      createdAt: serverTimestamp(),
    });
  };

  /* ---------------- VOICE ---------------- */
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder.current = new MediaRecorder(stream);
      audioChunks.current = [];

      mediaRecorder.current.ondataavailable = (e) =>
        audioChunks.current.push(e.data);

      mediaRecorder.current.onstop = async () => {
        const blob = new Blob(audioChunks.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);

        await addDoc(collection(db, "chats", chatId!, "messages"), {
          audioUrl: url,
          senderUid: user!.uid,
          status: "sent",
          createdAt: serverTimestamp(),
        });
      };

      mediaRecorder.current.start();
      setRecording(true);
    } catch (err) {
      console.error("Mic access denied", err);
    }
  };

  const stopRecording = () => {
    mediaRecorder.current?.stop();
    setRecording(false);
  };

  /* ---------------- FILTERED USERS ---------------- */
  const filteredUsers = users.filter(
    (u) =>
      u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  /* ---------------- RENDER ---------------- */

  return (
    <div className="h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-7xl h-[calc(100vh-2rem)] bg-white rounded-3xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col">
        
        {/* ============ MEET VIEW ============ */}
        {view === "meet" && (
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className={`flex items-center justify-between px-8 py-6 border-b border-gray-100 bg-gradient-to-r from-${PRIMARY}-50 to-white`}>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Meet & Chat</h1>
                <p className="text-sm text-gray-500">Connect with your team</p>
              </div>

              <button
                onClick={() => setView("chat")}
                className={`px-6 py-3 bg-${PRIMARY}-600 text-white rounded-full font-semibold shadow-lg hover:bg-${PRIMARY}-700 transition-all duration-300 hover:scale-105 flex items-center gap-2`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Open Chat
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8 space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-gradient-to-br from-blue-50 to-white p-6 rounded-2xl border border-blue-100">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-gray-800">Video Calls</h3>
                  </div>
                  <MeetPanel users={users} />
                </div>

                <div className="bg-gradient-to-br from-purple-50 to-white p-6 rounded-2xl border border-purple-100">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-gray-800">Recent Calls</h3>
                  </div>
                  <CallHistory />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============ CHAT VIEW ============ */}
        {view === "chat" && (
          <div className="flex h-full">
            {/* LEFT SIDEBAR - User List (Always Visible) */}
            <div className="w-full md:w-96 border-r border-gray-100 flex flex-col bg-white">
              {/* Sidebar Header */}
              <div className="px-6 py-5 border-b border-gray-100 space-y-4">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setView("meet")}
                    className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    <span className="font-semibold">Back to Meet</span>
                  </button>
                </div>

                <h2 className="text-xl font-bold text-gray-800">Chats</h2>

                {/* Search */}
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search conversations..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-gray-100 rounded-full text-sm outline-none focus:ring-2 focus:ring-emerald-300 transition-all"
                  />
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>

              {/* User List */}
              <div className="flex-1 overflow-y-auto">
                {filteredUsers.map((u) => (
                  <button
                    key={u.uid}
                    onClick={() => setSelectedUser(u)}
                    className={`w-full px-6 py-4 flex items-center gap-4 transition-all duration-200 border-b border-gray-50 ${
                      selectedUser?.uid === u.uid
                        ? `bg-${PRIMARY}-50 border-l-4 border-l-${PRIMARY}-600`
                        : "hover:bg-gray-50 border-l-4 border-l-transparent"
                    }`}
                  >
                    <div className="relative">
                      <div className="w-14 h-14 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center text-gray-700 font-bold text-lg shadow-sm">
                        {(u.name || u.email).charAt(0).toUpperCase()}
                      </div>
                      {u.online && (
                        <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 border-2 border-white rounded-full"></div>
                      )}
                    </div>

                    <div className="flex-1 text-left min-w-0">
                      <p className="font-semibold text-gray-800 truncate">
                        {u.name || u.email}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {u.online ? "Active now" : "Offline"}
                      </p>
                    </div>

                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))}
              </div>
            </div>

            {/* RIGHT - Chat Window */}
            <div className="flex-1 flex flex-col bg-gradient-to-b from-gray-50 to-white">
              {!selectedUser ? (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                  <div className={`w-32 h-32 rounded-full bg-${PRIMARY}-50 flex items-center justify-center mb-6`}>
                    <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <p className="text-xl font-semibold text-gray-600">Select a conversation</p>
                  <p className="text-sm text-gray-400 mt-2">Choose a contact from the left to start chatting</p>
                </div>
              ) : (
                <>
                  {/* Chat Header */}
                  <div className="px-6 py-4 bg-white border-b border-gray-100 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className="w-12 h-12 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center text-gray-700 font-bold shadow-sm">
                          {(selectedUser.name || selectedUser.email)
                            .charAt(0)
                            .toUpperCase()}
                        </div>
                        {selectedUser.online && (
                          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                        )}
                      </div>

                      <div>
                        <p className="font-bold text-gray-800">
                          {selectedUser.name || selectedUser.email}
                        </p>
                        {typing ? (
                          <p className={`text-xs text-${PRIMARY}-600 font-medium animate-pulse`}>
                            typing...
                          </p>
                        ) : (
                          <p className="text-xs text-gray-500">
                            {selectedUser.online ? "Active now" : "Offline"}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button className={`w-10 h-10 rounded-full hover:bg-${PRIMARY}-50 flex items-center justify-center transition-all`}>
                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                      <button className={`w-10 h-10 rounded-full hover:bg-${PRIMARY}-50 flex items-center justify-center transition-all`}>
                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                      </button>
                      <button className={`w-10 h-10 rounded-full hover:bg-${PRIMARY}-50 flex items-center justify-center transition-all`}>
                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Messages Area */}
                  <div
                    className="flex-1 overflow-y-auto px-6 py-6 space-y-4"
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                    }}
                  >
                    {messages.map((m, idx) => {
                      const mine = m.senderUid === user?.uid;
                      const showAvatar =
                        idx === messages.length - 1 ||
                        messages[idx + 1]?.senderUid !== m.senderUid;

                      return (
                        <div
                          key={m.id}
                          className={`flex items-end gap-2 ${
                            mine ? "flex-row-reverse" : "flex-row"
                          } group`}
                        >
                          {/* Avatar */}
                          <div className="w-8 h-8 flex-shrink-0">
                            {!mine && showAvatar && (
                              <div className="w-8 h-8 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center text-gray-700 text-xs font-bold">
                                {(selectedUser.name || selectedUser.email)
                                  .charAt(0)
                                  .toUpperCase()}
                              </div>
                            )}
                          </div>

                          {/* Message Bubble */}
                          <div className={`flex flex-col ${mine ? "items-end" : "items-start"} max-w-[70%]`}>
                            {/* Reply reference */}
                            {m.replyTo && (
                              <div className={`text-xs px-3 py-1 rounded-lg mb-1 ${mine ? `bg-${PRIMARY}-100 text-${PRIMARY}-800` : "bg-gray-200 text-gray-600"}`}>
                                <svg className="w-3 h-3 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                </svg>
                                Replying to message
                              </div>
                            )}

                            <div
                              className={`relative px-4 py-3 rounded-2xl shadow-md transition-all duration-200 ${
                                mine
                                  ? `bg-${PRIMARY}-600 text-white ${
                                      showAvatar ? "rounded-br-sm" : ""
                                    }`
                                  : `bg-white text-gray-800 ${
                                      showAvatar ? "rounded-bl-sm" : ""
                                    }`
                              }`}
                              onContextMenu={(e) => {
                                e.preventDefault();
                                setShowMenu(m.id);
                              }}
                            >
                              {m.deleted ? (
                                <i className="text-xs opacity-60 flex items-center gap-1">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                  </svg>
                                  This message was deleted
                                </i>
                              ) : (
                                <>
                                  {m.text && (
                                    <p className="leading-relaxed break-words">
                                      {m.text}
                                    </p>
                                  )}

                                  {m.imageUrl && (
                                    <img
                                      src={m.imageUrl}
                                      onClick={() => setFullImage(m.imageUrl!)}
                                      className="mt-2 rounded-xl max-h-64 cursor-pointer hover:opacity-90 transition-opacity"
                                      alt="Shared"
                                    />
                                  )}

                                  {m.audioUrl && (
                                    <audio controls className="mt-2 w-full">
                                      <source src={m.audioUrl} />
                                    </audio>
                                  )}

                                  {m.edited && (
                                    <span className="text-[9px] opacity-60 ml-2">
                                      (edited)
                                    </span>
                                  )}
                                </>
                              )}

                              {/* Reactions */}
                              {m.reactions &&
                                Object.keys(m.reactions).length > 0 && (
                                  <div className="flex gap-1 mt-1 flex-wrap">
                                    {Object.entries(m.reactions).map(
                                      ([uid, emoji]) => (
                                        <span
                                          key={uid}
                                          className="text-xs bg-white bg-opacity-20 px-2 py-0.5 rounded-full"
                                        >
                                          {emoji}
                                        </span>
                                      )
                                    )}
                                  </div>
                                )}

                              {/* Status for sent messages */}
                              {mine && !m.deleted && (
                                <div className="text-[9px] mt-1 opacity-70 text-right flex items-center justify-end gap-1">
                                  <span>
                                    {m.status === "sent" && (
                                      <svg className="w-3 h-3 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                      </svg>
                                    )}
                                    {m.status === "delivered" && (
                                      <>
                                        <svg className="w-3 h-3 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        <svg className="w-3 h-3 inline -ml-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                      </>
                                    )}
                                    {m.status === "seen" && (
                                      <>
                                        <svg className="w-3 h-3 inline text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        <svg className="w-3 h-3 inline -ml-1.5 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                      </>
                                    )}
                                  </span>
                                </div>
                              )}

                              {/* Message Menu */}
                              {showMenu === m.id && (
                                <div
                                  className={`absolute ${
                                    mine ? "left-0" : "right-0"
                                  } top-0 -translate-y-full mb-2 bg-white border border-gray-200 rounded-xl shadow-2xl p-2 z-10 min-w-[180px]`}
                                >
                                  <button
                                    onClick={() => {
                                      setReplyingTo(m);
                                      setShowMenu(null);
                                    }}
                                    className="w-full px-3 py-2 text-left hover:bg-gray-50 rounded-lg text-sm flex items-center gap-2"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                    </svg>
                                    Reply
                                  </button>
                                  <button
                                    onClick={() => {
                                      addReaction(m.id, "❤️");
                                      setShowMenu(null);
                                    }}
                                    className="w-full px-3 py-2 text-left hover:bg-gray-50 rounded-lg text-sm flex items-center gap-2"
                                  >
                                    ❤️ React
                                  </button>
                                  {mine && (
                                    <>
                                      <button
                                        onClick={() => {
                                          setEditingId(m.id);
                                          setText(m.text || "");
                                          setShowMenu(null);
                                        }}
                                        className="w-full px-3 py-2 text-left hover:bg-gray-50 rounded-lg text-sm flex items-center gap-2"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                        Edit
                                      </button>
                                      <button
                                        onClick={() => {
                                          deleteMessage(m.id);
                                          setShowMenu(null);
                                        }}
                                        className="w-full px-3 py-2 text-left hover:bg-red-50 rounded-lg text-sm flex items-center gap-2 text-red-600"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                        Delete
                                      </button>
                                    </>
                                  )}
                                  <button
                                    onClick={() => setShowMenu(null)}
                                    className="w-full px-3 py-2 text-left hover:bg-gray-50 rounded-lg text-sm text-gray-500 flex items-center gap-2"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                    Close
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Quick reactions on hover */}
                            <div className={`hidden group-hover:flex gap-1 mt-1 ${mine ? "flex-row-reverse" : "flex-row"}`}>
                              {["❤️", "👍", "😂", "😮", "😢"].map((emoji) => (
                                <button
                                  key={emoji}
                                  onClick={() => addReaction(m.id, emoji)}
                                  className="w-7 h-7 bg-white border border-gray-200 rounded-full hover:scale-125 transition-transform shadow-sm"
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Reply Bar */}
                  {replyingTo && (
                    <div className="px-6 py-2 bg-gray-100 border-t border-gray-200 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm">
                        <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                        </svg>
                        <span className="text-gray-600">
                          Replying to:{" "}
                          <strong>{replyingTo.text?.slice(0, 30)}...</strong>
                        </span>
                      </div>
                      <button
                        onClick={() => setReplyingTo(null)}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )}

                  {/* Input Bar */}
                  <div className="px-6 py-4 bg-white border-t border-gray-100 flex items-center gap-3 shadow-lg">
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="w-10 h-10 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-all"
                      title="Attach image"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                    </button>

                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={(e) =>
                        e.target.files && sendImage(e.target.files[0])
                      }
                    />

                    <button
                      className="w-10 h-10 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-all"
                      title="Emoji"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </button>

                    <input
                      value={text}
                      onChange={(e) => {
                        setText(e.target.value);
                        handleTyping();
                      }}
                      placeholder={
                        editingId
                          ? "Edit your message..."
                          : "Type a message..."
                      }
                      className="flex-1 bg-gray-100 rounded-full px-5 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-300 transition-all"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          sendText();
                        }
                      }}
                    />

                    <button
                      onMouseDown={startRecording}
                      onMouseUp={stopRecording}
                      onTouchStart={startRecording}
                      onTouchEnd={stopRecording}
                      className={`w-10 h-10 flex items-center justify-center rounded-full transition-all ${
                        recording
                          ? "bg-red-100 text-red-600 scale-110 animate-pulse"
                          : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                      }`}
                      title="Hold to record"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      </svg>
                    </button>

                    <button
                      onClick={sendText}
                      disabled={!text.trim()}
                      className={`w-10 h-10 flex items-center justify-center rounded-full transition-all duration-200 ${
                        text.trim()
                          ? `bg-${PRIMARY}-600 text-white shadow-lg hover:bg-${PRIMARY}-700 hover:scale-105`
                          : "bg-gray-200 text-gray-400 cursor-not-allowed"
                      }`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ============ FULL IMAGE MODAL ============ */}
        {fullImage && (
          <div
            onClick={() => setFullImage(null)}
            className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center z-50 backdrop-blur-sm animate-fade-in"
          >
            <button
              className="absolute top-6 right-6 w-12 h-12 bg-white rounded-full flex items-center justify-center text-gray-800 hover:bg-gray-100 transition-all shadow-2xl"
              onClick={() => setFullImage(null)}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <img
              src={fullImage}
              className="max-h-[90vh] max-w-[90vw] rounded-2xl shadow-2xl"
              alt="Full size"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}

        {/* Click outside to close menu */}
        {showMenu && (
          <div
            className="fixed inset-0 z-0"
            onClick={() => setShowMenu(null)}
          />
        )}
      </div>
    </div>
  );
}