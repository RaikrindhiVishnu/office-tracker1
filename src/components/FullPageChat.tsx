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
  getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

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

type Notification = {
  id: string;
  title: string;
  body: string;
  senderName: string;
  timestamp: any;
  read: boolean;
};

/* ---------------- NOTIFICATION COMPONENT ---------------- */

const WhatsAppNotification = ({ notification, onClose }: { notification: Notification; onClose: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed top-4 right-4 z-50 animate-slide-in bg-white rounded-2xl shadow-2xl border border-gray-200 w-80 overflow-hidden">
      <div className="bg-green-600 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.149-.67.149-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
            </svg>
          </div>
          <span className="text-white font-semibold">WhatsApp</span>
        </div>
        <button
          onClick={onClose}
          className="text-white hover:bg-green-700 rounded-full p-1 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-gray-600 font-bold">
            {notification.senderName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <p className="font-semibold text-gray-800">{notification.senderName}</p>
            <p className="text-sm text-gray-600 mt-1">{notification.body}</p>
            <p className="text-xs text-gray-400 mt-2">
              {notification.timestamp?.toDate?.()?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || 'Just now'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ---------------- MAIN COMPONENT ---------------- */

export default function FullPageChat({ users, onClose }: { users: User[]; onClose?: () => void }) {
  const { user } = useAuth();
  
  // View states
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showUserList, setShowUserList] = useState(true);
  
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
  const [notifications, setNotifications] = useState<Notification[]>([]);

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

        // Check for new messages from other users and show notification
        data.forEach((m) => {
          if (m.senderUid !== user?.uid && m.status !== "seen") {
            updateDoc(doc(db, "chats", chatId, "messages", m.id), {
              status: "seen",
            });

            // Show notification for new message
            if (m.text && selectedUser && selectedUser.uid === m.senderUid) {
              const newNotification: Notification = {
                id: `${m.id}-${Date.now()}`,
                title: "New Message",
                body: m.text,
                senderName: selectedUser.name || selectedUser.email,
                timestamp: m.createdAt,
                read: false,
              };
              
              setNotifications(prev => [...prev, newNotification]);
            }
          }
        });
      }
    );
  }, [chatId, user, selectedUser]);

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

      // Send notification to receiver if they're not in chat
      if (selectedUser) {
        const notificationRef = doc(db, "notifications", selectedUser.uid);
        const notificationData = {
          type: "message",
          senderUid: user.uid,
          senderName: user.email?.split("@")[0] || "Unknown",
          message: text,
          chatId: chatId,
          createdAt: serverTimestamp(),
          read: false,
        };

        // Check if receiver is online
        const receiverPresence = await getDoc(doc(db, "presence", selectedUser.uid));
        if (!receiverPresence.exists() || !receiverPresence.data().online) {
          await setDoc(notificationRef, {
            [`${Date.now()}`]: notificationData
          }, { merge: true });
        }
      }
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

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  /* ---------------- RENDER ---------------- */
  return (
    <div className="h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex">
      {/* NOTIFICATIONS */}
      {notifications.map((notification) => (
        <WhatsAppNotification
          key={notification.id}
          notification={notification}
          onClose={() => removeNotification(notification.id)}
        />
      ))}

      {/* USER LIST SIDEBAR */}
      {(showUserList || !selectedUser) && (
        <div className="w-full md:w-96 bg-white border-r border-gray-200 flex flex-col">
          {/* Header */}
          <div className="px-6 py-5 border-b border-gray-100 space-y-4">
            <div className="flex items-center justify-between">
              {onClose && (
                <button
                  onClick={onClose}
                  className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  <span className="font-semibold">Back to Meet</span>
                </button>
              )}
              <h2 className="text-xl font-bold text-gray-800">chat</h2>
              <div className="w-20"></div> {/* Spacer for centering */}
            </div>

            {/* Search */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search or start new chat"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-100 rounded-full text-sm outline-none focus:ring-2 focus:ring-green-300 transition-all"
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
                onClick={() => {
                  setSelectedUser(u);
                  setShowUserList(false);
                }}
                className={`w-full px-6 py-4 flex items-center gap-4 transition-all duration-200 border-b border-gray-50 hover:bg-gray-50`}
              >
                <div className="relative">
                  <div className="w-14 h-14 rounded-full bg-gray-200 flex items-center justify-center text-gray-700 font-bold text-lg">
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
              </button>
            ))}
          </div>
        </div>
      )}

      {/* CHAT WINDOW */}
      {selectedUser && !showUserList && (
        <div className="flex-1 flex flex-col">
          {/* Chat Header */}
          <div className="px-6 py-4 bg-white border-b border-gray-100 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowUserList(true)}
                className="md:hidden text-gray-600 hover:text-gray-800"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              
              <div className="relative">
                <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-gray-700 font-bold">
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
                  <p className="text-xs text-green-600 font-medium animate-pulse">
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
              <button className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center transition-all">
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </button>
              <button className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center transition-all">
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
              <button className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center transition-all">
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
                      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-700 text-xs font-bold">
                        {(selectedUser.name || selectedUser.email)
                          .charAt(0)
                          .toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Message Bubble */}
                  <div className={`flex flex-col ${mine ? "items-end" : "items-start"} max-w-[70%]`}>
                    <div
                      className={`relative px-4 py-3 rounded-2xl shadow-md transition-all duration-200 ${
                        mine
                          ? "bg-green-600 text-white"
                          : "bg-white text-gray-800"
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
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

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

            <input
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                handleTyping();
              }}
              placeholder="Type a message..."
              className="flex-1 bg-gray-100 rounded-full px-5 py-3 text-sm outline-none focus:ring-2 focus:ring-green-300 transition-all"
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
                  ? "bg-green-600 text-white shadow-lg hover:bg-green-700 hover:scale-105"
                  : "bg-gray-300 text-gray-500 cursor-not-allowed"
              }`}
            >
              <svg
                className="w-5 h-5 rotate-90"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* FULL IMAGE MODAL */}
      {fullImage && (
        <div
          onClick={() => setFullImage(null)}
          className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center z-50 backdrop-blur-sm"
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
    </div>
  );
}
