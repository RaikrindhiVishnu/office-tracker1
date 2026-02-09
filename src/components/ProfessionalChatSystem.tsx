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

type ChatWindow = {
  user: User;
  isOpen: boolean;
  isMinimized: boolean;
  position: { x: number; y: number };
  unreadCount: number;
};

/* ---------------- NOTIFICATION COMPONENT ---------------- */

const ChatNotification = ({ 
  notification, 
  onClose 
}: { 
  notification: {
    id: string;
    title: string;
    body: string;
    senderName: string;
    timestamp: any;
  };
  onClose: () => void;
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 5000); // Auto-dismiss after 5 seconds

    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-right duration-300">
      <div className="bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden min-w-[320px] max-w-[400px]">
        {/* Notification Header */}
        <div className="bg-green-600 text-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.149-.67.149-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521.075-.148.669-1.611.916-2.206.242-.579.487-.501.669-.51l.57-.01c.198 0 .52.074.792.372s1.04 1.016 1.04 2.479 1.065 2.876 1.065 2.876 1.065 5.45-4.436 9.884-9.888 9.884-2.64 0-5.122-1.03-6.988-2.898a9.825 9.825 0 01-2.893-6.994c-.003-5.45 4.437-9.884 9.885-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
              </svg>
            </div>
            <span className="font-semibold text-sm">WhatsApp</span>
          </div>
          <button
            onClick={onClose}
            className="w-6 h-6 rounded-full hover:bg-green-700 flex items-center justify-center transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Notification Body */}
        <div className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-gray-700 font-bold flex-shrink-0">
              {notification.senderName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-800 text-sm">
                {notification.senderName}
              </p>
              <p className="text-gray-600 text-sm mt-1 break-words">
                {notification.body}
              </p>
              <p className="text-xs text-gray-400 mt-2">
                {notification.timestamp?.toDate?.()?.toLocaleTimeString() || 'Just now'}
              </p>
            </div>
          </div>
        </div>

        {/* Notification Actions */}
        <div className="border-t border-gray-100 px-4 py-2 flex gap-2">
          <button className="flex-1 py-2 text-green-600 text-sm font-medium hover:bg-green-50 rounded transition-colors">
            Reply
          </button>
          <button className="flex-1 py-2 text-gray-600 text-sm hover:bg-gray-50 rounded transition-colors">
            View
          </button>
        </div>
      </div>
    </div>
  );
};

/* ---------------- PROFESSIONAL CHAT COMPONENT ---------------- */

const ProfessionalChatPopup = ({ 
  chatWindow, 
  onClose, 
  onMinimize, 
  onPositionChange,
  allUsers 
}: { 
  chatWindow: ChatWindow; 
  onClose: () => void; 
  onMinimize: () => void; 
  onPositionChange: (position: { x: number; y: number }) => void;
  allUsers: User[];
}) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [typing, setTyping] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showUserSearch, setShowUserSearch] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const typingTimeout = useRef<any>(null);

  const chatId = useMemo(() => {
    if (!user || !chatWindow.user) return null;
    return [user.uid, chatWindow.user.uid].sort().join("_");
  }, [user, chatWindow.user]);

  /* ---------------- AUTO SCROLL ---------------- */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
    if (!chatId || !chatWindow.user) return;

    return onSnapshot(
      doc(db, "chats", chatId, "typing", chatWindow.user.uid),
      (snap) => setTyping(snap.exists())
    );
  }, [chatId, chatWindow.user]);

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

  const sendText = async () => {
    if (!text.trim() || !chatId || !user) return;

    await addDoc(collection(db, "chats", chatId, "messages"), {
      text,
      senderUid: user.uid,
      status: "sent",
      createdAt: serverTimestamp(),
    });

    setText("");
  };

  const sendImage = async (file: File) => {
    const url = URL.createObjectURL(file);
    await addDoc(collection(db, "chats", chatId!, "messages"), {
      imageUrl: url,
      senderUid: user!.uid,
      status: "sent",
      createdAt: serverTimestamp(),
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({
      x: e.clientX - chatWindow.position.x,
      y: e.clientY - chatWindow.position.y,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    
    const newPosition = {
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    };
    
    // Keep within viewport bounds
    const boundedPosition = {
      x: Math.max(0, Math.min(window.innerWidth - 320, newPosition.x)),
      y: Math.max(0, Math.min(window.innerHeight - 480, newPosition.y)),
    };
    
    onPositionChange(boundedPosition);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const filteredUsers = allUsers.filter(
    (u) =>
      u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const emojis = ["😀", "😂", "❤️", "👍", "😎", "🔥", "💯", "🎉", "🤔", "😊"];

  if (chatWindow.isMinimized) {
    return (
      <div
        className="fixed bg-white border border-gray-200 rounded-lg shadow-lg z-50 flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-gray-50 transition-colors"
        style={{
          right: `${chatWindow.position.x}px`,
          bottom: `${chatWindow.position.y}px`,
          width: "280px",
        }}
        onClick={() => onMinimize()}
      >
        <div className="relative">
          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-700 text-sm font-bold">
            {(chatWindow.user.name || chatWindow.user.email).charAt(0).toUpperCase()}
          </div>
          {chatWindow.user.online && (
            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full"></div>
          )}
        </div>
        <div className="flex-1 text-left">
          <p className="font-semibold text-gray-800 text-sm truncate">
            {chatWindow.user.name || chatWindow.user.email}
          </p>
          <p className="text-xs text-gray-500 truncate">
            {chatWindow.user.online ? "Active now" : "Offline"}
          </p>
        </div>
        {chatWindow.unreadCount > 0 && (
          <div className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {chatWindow.unreadCount}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="fixed bg-white border border-gray-200 rounded-lg shadow-2xl z-50 flex flex-col"
      style={{
        right: `${chatWindow.position.x}px`,
        bottom: `${chatWindow.position.y}px`,
        width: "320px",
        height: chatWindow.isMinimized ? "auto" : "480px",
      }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Header */}
      <div
        className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-3 rounded-t-lg flex items-center justify-between cursor-move"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-sm">
              {(chatWindow.user.name || chatWindow.user.email).charAt(0).toUpperCase()}
            </div>
            {chatWindow.user.online && (
              <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 border-2 border-white rounded-full"></div>
            )}
          </div>
          <div>
            <p className="font-semibold text-sm">
              {chatWindow.user.name || chatWindow.user.email}
            </p>
            {typing ? (
              <p className="text-xs opacity-90 animate-pulse">typing...</p>
            ) : (
              <p className="text-xs opacity-75">
                {chatWindow.user.online ? "Active now" : "Offline"}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onMinimize}
            className="w-6 h-6 rounded hover:bg-white/20 flex items-center justify-center transition-colors"
            title="Minimize"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          <button
            onClick={onClose}
            className="w-6 h-6 rounded hover:bg-white/20 flex items-center justify-center transition-colors"
            title="Close"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-3 bg-gray-50" style={{ height: "320px" }}>
        {messages.map((m, idx) => {
          const mine = m.senderUid === user?.uid;
          const showAvatar = idx === 0 || messages[idx - 1]?.senderUid !== m.senderUid;

          return (
            <div key={m.id} className={`flex gap-2 mb-3 ${mine ? "flex-row-reverse" : "flex-row"}`}>
              {!mine && showAvatar && (
                <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-gray-700 text-xs font-bold shrink-0">
                  {(chatWindow.user.name || chatWindow.user.email).charAt(0).toUpperCase()}
                </div>
              )}
              <div className={`max-w-[70%] ${mine ? "items-end" : "items-start"}`}>
                <div
                  className={`px-3 py-2 rounded-lg text-sm ${
                    mine
                      ? "bg-blue-600 text-white rounded-br-none"
                      : "bg-white text-gray-800 rounded-bl-none border border-gray-200"
                  }`}
                >
                  {m.deleted ? (
                    <i className="text-xs opacity-60">Message deleted</i>
                  ) : (
                    <>
                      {m.text && <p className="break-words">{m.text}</p>}
                      {m.imageUrl && (
                        <img
                          src={m.imageUrl}
                          className="mt-1 rounded max-h-32 cursor-pointer"
                          alt="Shared"
                        />
                      )}
                    </>
                  )}
                </div>
                {mine && (
                  <div className="text-xs text-gray-500 mt-1 text-right">
                    {m.status === "seen" ? "✓✓" : m.status === "delivered" ? "✓✓" : "✓"}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 bg-white border-t border-gray-200 rounded-b-lg">
        {/* User Search */}
        {showUserSearch && (
          <div className="mb-3 p-2 bg-gray-50 rounded-lg border border-gray-200">
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="max-h-32 overflow-y-auto mt-2">
              {filteredUsers.map((u) => (
                <button
                  key={u.uid}
                  onClick={() => {
                    // Add user to group chat or forward message
                    setShowUserSearch(false);
                  }}
                  className="w-full text-left px-2 py-1 hover:bg-gray-100 rounded text-sm flex items-center gap-2"
                >
                  <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-xs">
                    {(u.name || u.email).charAt(0).toUpperCase()}
                  </div>
                  <span className="truncate">{u.name || u.email}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Attach Menu */}
        {showAttachMenu && (
          <div className="absolute bottom-16 left-3 bg-white border border-gray-200 rounded-lg shadow-lg p-2 z-10">
            <button
              onClick={() => {
                fileRef.current?.click();
                setShowAttachMenu(false);
              }}
              className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded text-sm flex items-center gap-2"
            >
              📎 Attach file
            </button>
            <button
              onClick={() => {
                setShowUserSearch(true);
                setShowAttachMenu(false);
              }}
              className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded text-sm flex items-center gap-2"
            >
              👥 Add to chat
            </button>
          </div>
        )}

        {/* Emoji Picker */}
        {showEmojiPicker && (
          <div className="absolute bottom-16 left-3 bg-white border border-gray-200 rounded-lg shadow-lg p-2 z-10">
            <div className="grid grid-cols-5 gap-1">
              {emojis.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    setText(text + emoji);
                    setShowEmojiPicker(false);
                  }}
                  className="w-8 h-8 hover:bg-gray-100 rounded flex items-center justify-center text-lg"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAttachMenu(!showAttachMenu)}
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
          >
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>
          
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
          >
            😊
          </button>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => e.target.files && sendImage(e.target.files[0])}
          />

          <input
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              handleTyping();
            }}
            placeholder="Type a message..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendText();
              }
            }}
          />

          <button
            onClick={sendText}
            disabled={!text.trim()}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
              text.trim()
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
            }`}
          >
            <svg className="w-4 h-4 rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

/* ---------------- SINGLE CHAT VIEW ---------------- */

const SingleChatView = ({ 
  user, 
  onBack, 
  allUsers, 
  onUserSelect,
  onNewNotification 
}: { 
  user: User; 
  onBack: () => void; 
  allUsers: User[]; 
  onUserSelect: (user: User) => void;
  onNewNotification?: (notification: {
    id: string;
    title: string;
    body: string;
    senderName: string;
    timestamp: any;
  }) => void;
}) => {
  const { user: currentUser } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [typing, setTyping] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showUserSearch, setShowUserSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const typingTimeout = useRef<any>(null);

  const chatId = useMemo(() => {
    if (!currentUser || !user) return null;
    return [currentUser.uid, user.uid].sort().join("_");
  }, [currentUser, user]);

  /* ---------------- AUTO SCROLL ---------------- */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

        // Check for new messages from other users and show notification
        data.forEach((m) => {
          if (m.senderUid !== currentUser?.uid && m.status !== "seen") {
            updateDoc(doc(db, "chats", chatId, "messages", m.id), {
              status: "seen",
            });

            // Show notification for new message
            if (m.text && onNewNotification) {
              const newNotification = {
                id: `${m.id}-${Date.now()}`,
                title: "New Message",
                body: m.text,
                senderName: user.name || user.email,
                timestamp: m.createdAt,
              };
              
              onNewNotification(newNotification);
            }
          }
        });

        setMessages(data);
      }
    );
  }, [chatId, currentUser, user, onNewNotification]);

  /* ---------------- TYPING INDICATOR ---------------- */
  useEffect(() => {
    if (!chatId || !user) return;

    return onSnapshot(
      doc(db, "chats", chatId, "typing", user.uid),
      (snap) => setTyping(snap.exists())
    );
  }, [chatId, user]);

  const handleTyping = async () => {
    if (!chatId || !currentUser) return;

    await setDoc(doc(db, "chats", chatId, "typing", currentUser.uid), {
      typing: true,
    });

    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      deleteDoc(doc(db, "chats", chatId!, "typing", currentUser.uid));
    }, 1500);
  };

  const sendText = async () => {
    if (!text.trim() || !chatId || !currentUser) return;

    await addDoc(collection(db, "chats", chatId, "messages"), {
      text,
      senderUid: currentUser.uid,
      status: "sent",
      createdAt: serverTimestamp(),
    });

    setText("");
  };

  const sendImage = async (file: File) => {
    const url = URL.createObjectURL(file);
    await addDoc(collection(db, "chats", chatId!, "messages"), {
      imageUrl: url,
      senderUid: currentUser!.uid,
      status: "sent",
      createdAt: serverTimestamp(),
    });
  };

  const emojis = ["😀", "😂", "❤️", "👍", "😎", "🔥", "💯", "🎉", "🤔", "😊"];

  const filteredUsers = allUsers.filter(
    (u) =>
      u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      {/* Chat Header */}
      <div className="bg-green-600 text-white px-4 py-3 rounded-t-lg flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-8 h-8 rounded-full hover:bg-green-700 flex items-center justify-center transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-bold">
              {(user.name || user.email).charAt(0).toUpperCase()}
            </div>
            {user.online && (
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 border-2 border-white rounded-full"></div>
            )}
          </div>
          <div>
            <p className="font-semibold text-sm">
              {user.name || user.email}
            </p>
            {typing ? (
              <p className="text-xs opacity-90 animate-pulse">typing...</p>
            ) : (
              <p className="text-xs opacity-75">
                {user.online ? "Active now" : "Offline"}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowUserSearch(true)}
            className="w-8 h-8 rounded-full hover:bg-green-700 flex items-center justify-center transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50" style={{ height: "380px" }}>
        {messages.map((m, idx) => {
          const mine = m.senderUid === currentUser?.uid;
          const showAvatar = idx === 0 || messages[idx - 1]?.senderUid !== m.senderUid;

          return (
            <div key={m.id} className={`flex gap-2 mb-3 ${mine ? "flex-row-reverse" : "flex-row"}`}>
              {!mine && showAvatar && (
                <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-gray-700 text-xs font-bold shrink-0">
                  {(user.name || user.email).charAt(0).toUpperCase()}
                </div>
              )}
              <div className={`max-w-[70%] ${mine ? "items-end" : "items-start"}`}>
                <div
                  className={`px-3 py-2 rounded-lg text-sm ${
                    mine
                      ? "bg-green-600 text-white rounded-br-none"
                      : "bg-white text-gray-800 rounded-bl-none border border-gray-200"
                  }`}
                >
                  {m.deleted ? (
                    <i className="text-xs opacity-60">Message deleted</i>
                  ) : (
                    <>
                      {m.text && <p className="break-words">{m.text}</p>}
                      {m.imageUrl && (
                        <img
                          src={m.imageUrl}
                          className="mt-1 rounded max-h-32 cursor-pointer"
                          alt="Shared"
                        />
                      )}
                    </>
                  )}
                </div>
                {mine && (
                  <div className="text-xs text-gray-500 mt-1 text-right">
                    {m.status === "seen" ? "✓✓" : m.status === "delivered" ? "✓✓" : "✓"}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 bg-white border-t border-gray-200 rounded-b-lg">
        {/* User Search */}
        {showUserSearch && (
          <div className="mb-3 p-2 bg-gray-50 rounded-lg border border-gray-200">
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <div className="max-h-32 overflow-y-auto mt-2">
              {filteredUsers.map((u) => (
                <button
                  key={u.uid}
                  onClick={() => {
                    onUserSelect(u);
                    setShowUserSearch(false);
                  }}
                  className="w-full text-left px-2 py-1 hover:bg-gray-100 rounded text-sm flex items-center gap-2"
                >
                  <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-xs">
                    {(u.name || u.email).charAt(0).toUpperCase()}
                  </div>
                  <span className="truncate">{u.name || u.email}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Attach Menu */}
        {showAttachMenu && (
          <div className="absolute bottom-16 left-3 bg-white border border-gray-200 rounded-lg shadow-lg p-2 z-10">
            <button
              onClick={() => {
                fileRef.current?.click();
                setShowAttachMenu(false);
              }}
              className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded text-sm flex items-center gap-2"
            >
              📎 Attach file
            </button>
            <button
              onClick={() => {
                setShowUserSearch(true);
                setShowAttachMenu(false);
              }}
              className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded text-sm flex items-center gap-2"
            >
              👥 Add to chat
            </button>
          </div>
        )}

        {/* Emoji Picker */}
        {showEmojiPicker && (
          <div className="absolute bottom-16 left-3 bg-white border border-gray-200 rounded-lg shadow-lg p-2 z-10">
            <div className="grid grid-cols-5 gap-1">
              {emojis.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    setText(text + emoji);
                    setShowEmojiPicker(false);
                  }}
                  className="w-8 h-8 hover:bg-gray-100 rounded flex items-center justify-center text-lg"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAttachMenu(!showAttachMenu)}
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
          >
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>
          
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
          >
            😊
          </button>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => e.target.files && sendImage(e.target.files[0])}
          />

          <input
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              handleTyping();
            }}
            placeholder="Type a message..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendText();
              }
            }}
          />

          <button
            onClick={sendText}
            disabled={!text.trim()}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
              text.trim()
                ? "bg-green-600 text-white hover:bg-green-700"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
            }`}
          >
            <svg className="w-4 h-4 rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </>
  );
};

/* ---------------- MAIN CHAT MANAGER ---------------- */

export default function ProfessionalChatSystem({ users, onClose }: { users: User[]; onClose?: () => void }) {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showUserList, setShowUserList] = useState(true); // Start with user list visible
  const [notifications, setNotifications] = useState<{
    id: string;
    title: string;
    body: string;
    senderName: string;
    timestamp: any;
  }[]>([]);

  const openChat = (user: User) => {
    setSelectedUser(user);
    setShowUserList(false); // Hide user list when chat opens
  };

  const closeChat = () => {
    setSelectedUser(null);
    setShowUserList(true);
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const updateChatPosition = () => {
    // Not needed for single interface
  };

  return (
    <>
      {/* WhatsApp-style Notifications */}
      {notifications.map((notification) => (
        <ChatNotification
          key={notification.id}
          notification={notification}
          onClose={() => removeNotification(notification.id)}
        />
      ))}

      {/* WhatsApp-style Interface */}
      <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center">
        <div className="bg-white w-full max-w-md h-[600px] rounded-lg shadow-2xl flex flex-col">
          {!selectedUser ? (
            <>
              {/* User List View */}
              {/* Header */}
              <div className="bg-green-600 text-white px-4 py-3 rounded-t-lg flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.149-.67.149-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521.075-.148.669-1.611.916-2.206.242-.579.487-.501.669-.51l.57-.01c.198 0 .52.074.792.372s1.04 1.016 1.04 2.479 1.065 2.876 1.065 2.876 1.065 5.45-4.436 9.884-9.888 9.884-2.64 0-5.122-1.03-6.988-2.898a9.825 9.825 0 01-2.893-6.994c-.003-5.45 4.437-9.884 9.885-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                  </svg>
                  <h2 className="text-lg font-semibold">chat</h2>
                </div>
                <button
                  onClick={() => onClose ? onClose() : setShowUserList(false)}
                  className="w-8 h-8 rounded-full hover:bg-green-700 flex items-center justify-center transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Search */}
              <div className="px-4 py-3 bg-white border-b border-gray-200">
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search or start new chat"
                    className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-300"
                  />
                </div>
              </div>

              {/* User List */}
              <div className="flex-1 overflow-y-auto">
                {users.map((user) => (
                  <button
                    key={user.uid}
                    onClick={() => openChat(user)}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors border-b border-gray-100"
                  >
                    <div className="relative">
                      <div className="w-12 h-12 rounded-full bg-gray-300 flex items-center justify-center text-gray-700 font-bold">
                        {(user.name || user.email).charAt(0).toUpperCase()}
                      </div>
                      {user.online && (
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                      )}
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-semibold text-gray-800">
                        {user.name || user.email}
                      </p>
                      <p className="text-sm text-gray-500">
                        {user.online ? "Online" : "Offline"}
                      </p>
                    </div>
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              {/* Chat View */}
              <SingleChatView 
                user={selectedUser} 
                onBack={() => setSelectedUser(null)}
                allUsers={users}
                onUserSelect={openChat}
                onNewNotification={(notification) => {
                  setNotifications(prev => [...prev, notification]);
                }}
              />
            </>
          )}
        </div>
      </div>

      {/* Chat Launcher Button */}
      <div className="fixed bottom-4 right-4 z-40">
        <button
          className="w-14 h-14 bg-green-600 text-white rounded-full shadow-lg hover:bg-green-700 transition-all duration-200 hover:scale-105 flex items-center justify-center"
          onClick={() => setShowUserList(true)}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </button>
      </div>
    </>
  );
}
