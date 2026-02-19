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
  getDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

/* ---------------- TYPES ---------------- */

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

type Call = {
  id: string;
  callerId: string;
  callerName: string;
  receiverId: string;
  type: "video" | "audio";
  status: "ringing" | "accepted" | "rejected" | "ended";
  offer?: any;
  answer?: any;
  iceCandidates?: any[];
  startTime?: any;
  endTime?: any;
};

const getUserName = (user?: Partial<User> | null): string =>
  user?.name ??
  user?.email ??
  "User";



export default function TeamsStyleChatUpdated({ users }: { users: User[] }) {
  const { user } = useAuth();

  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [typing, setTyping] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [chats, setChats] = useState<Chat[]>([]);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"all" | "direct" | "groups">("all");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  
  // Call states
  const [incomingCall, setIncomingCall] = useState<Call | null>(null);
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callTimer, setCallTimer] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeout = useRef<any>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const timerIntervalRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);

  const STUN_SERVERS = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ],
  };

  const chatId = useMemo(() => {
    return selectedChat?.id || null;
  }, [selectedChat]);

  /* ---------------- UPDATE USER STATUS ---------------- */
  useEffect(() => {
    if (!user) return;

    const updateStatus = async () => {
      await setDoc(doc(db, "userStatus", user.uid), {
        online: true,
        status: "available",
        lastSeen: serverTimestamp(),
      }, { merge: true });
    };

    updateStatus();

    // Update status every 30 seconds
    const interval = setInterval(updateStatus, 30000);

    // Cleanup on unmount
    return () => {
      clearInterval(interval);
      setDoc(doc(db, "userStatus", user.uid), {
        online: false,
        lastSeen: serverTimestamp(),
      }, { merge: true });
    };
  }, [user]);

  /* ---------------- LISTEN FOR USER STATUS UPDATES ---------------- */
  useEffect(() => {
    const unsubscribers: (() => void)[] = [];

    users.forEach((u) => {
      const unsubscribe = onSnapshot(doc(db, "userStatus", u.uid), (snapshot) => {
        if (snapshot.exists()) {
          const statusData = snapshot.data();
          // Update the user in your users array or state
          // This would ideally update the users prop, but since we can't modify props,
          // you might need to maintain a separate state for user statuses
        }
      });
      unsubscribers.push(unsubscribe);
    });

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [users]);

  /* ---------------- LISTEN FOR NOTIFICATIONS ---------------- */
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

  /* ---------------- CLOSE NOTIFICATION DROPDOWN WHEN CLICKING OUTSIDE ---------------- */
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  /* ---------------- CALL TIMER ---------------- */
  useEffect(() => {
    if (activeCall?.status === "accepted") {
      setCallTimer(0);
      timerIntervalRef.current = setInterval(() => {
        setCallTimer((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      setCallTimer(0);
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [activeCall?.status]);

  /* ---------------- LISTEN FOR INCOMING CALLS ---------------- */
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "calls"),
      where("receiverId", "==", user.uid),
      where("status", "==", "ringing")
    );

    return onSnapshot(q, (snapshot) => {
      snapshot.forEach((doc) => {
        const call = { id: doc.id, ...doc.data() } as Call;
        setIncomingCall(call);
      });
    });
  }, [user]);

  /* ---------------- LISTEN FOR CALL UPDATES ---------------- */
  useEffect(() => {
    if (!activeCall) return;

    return onSnapshot(doc(db, "calls", activeCall.id), async (snapshot) => {
      if (!snapshot.exists()) {
        endCall();
        return;
      }

      const call = { id: snapshot.id, ...snapshot.data() } as Call;
      setActiveCall(call);

      if (call.answer && peerConnectionRef.current && !peerConnectionRef.current.remoteDescription) {
        await peerConnectionRef.current.setRemoteDescription(
          new RTCSessionDescription(call.answer)
        );
      }

      if (call.iceCandidates) {
        for (const candidate of call.iceCandidates) {
          if (peerConnectionRef.current && candidate && peerConnectionRef.current.remoteDescription) {
            try {
              await peerConnectionRef.current.addIceCandidate(
                new RTCIceCandidate(candidate)
              );
            } catch (e) {
              console.error("Error adding ice candidate:", e);
            }
          }
        }
      }

      if (call.status === "ended" || call.status === "rejected") {
        endCall();
      }
    });
  }, [activeCall?.id]);

  /* ---------------- AUTO SCROLL ---------------- */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* ---------------- LISTEN TO ALL CHATS ---------------- */
  useEffect(() => {
    if (!user) return;

    const initialChats: Chat[] = users
      .filter((u) => u.uid !== user.uid)
      .map((u) => {
        const tempChatId = [user.uid, u.uid].sort().join("_");
        return {
          id: tempChatId,
          participants: [user.uid, u.uid],
          unreadCount: { [user.uid]: 0 },
          isGroup: false,
        };
      });

    setChats(initialChats);

    const directUnsubscribers: (() => void)[] = [];
    users.forEach((u) => {
      if (u.uid === user.uid) return;
      
      const tempChatId = [user.uid, u.uid].sort().join("_");
      
      const unsubscribe = onSnapshot(
        query(
          collection(db, "chats", tempChatId, "messages"),
          orderBy("createdAt", "desc")
        ),
        (snap) => {
          const unreadCount = snap.docs.filter(
            (doc) => {
              const data = doc.data();
              return data.senderUid !== user.uid && 
                     (!data.readBy || !data.readBy.includes(user.uid));
            }
          ).length;

          setChats((prev) => {
            const existing = prev.find((c) => c.id === tempChatId);
            const lastDoc = snap.docs[0];
            const lastMessage = lastDoc?.data();

            if (existing) {
              return prev.map((c) =>
                c.id === tempChatId
                  ? {
                      ...c,
                      unreadCount: { ...c.unreadCount, [user.uid]: unreadCount },
                      lastMessage: lastMessage?.text || lastMessage?.fileName || "File",
                      lastMessageTime: lastMessage?.createdAt,
                    }
                  : c
              );
            } else {
              return [
                ...prev,
                {
                  id: tempChatId,
                  participants: [user.uid, u.uid],
                  unreadCount: { [user.uid]: unreadCount },
                  lastMessage: lastMessage?.text || lastMessage?.fileName || "File",
                  lastMessageTime: lastMessage?.createdAt,
                  isGroup: false,
                },
              ];
            }
          });
        }
      );

      directUnsubscribers.push(unsubscribe);
    });

    const groupQuery = query(
      collection(db, "groupChats"),
      where("participants", "array-contains", user.uid)
    );

    const groupUnsubscribe = onSnapshot(groupQuery, (snapshot) => {
      snapshot.forEach((groupDoc) => {
        const groupData = groupDoc.data();
        
        const messagesUnsubscribe = onSnapshot(
          query(
            collection(db, "groupChats", groupDoc.id, "messages"),
            orderBy("createdAt", "desc")
          ),
          (messagesSnap) => {
            const unreadCount = messagesSnap.docs.filter(
              (doc) => {
                const data = doc.data();
                return data.senderUid !== user.uid && 
                       (!data.readBy || !data.readBy.includes(user.uid));
              }
            ).length;

            const lastDoc = messagesSnap.docs[0];
            const lastMessage = lastDoc?.data();

            setChats((prev) => {
              const existing = prev.find((c) => c.id === groupDoc.id);
              
              if (existing) {
                return prev.map((c) =>
                  c.id === groupDoc.id
                    ? {
                        ...c,
                        unreadCount: { ...c.unreadCount, [user.uid]: unreadCount },
                        lastMessage: lastMessage?.text || lastMessage?.fileName || "File",
                        lastMessageTime: lastMessage?.createdAt,
                      }
                    : c
                );
              } else {
                return [
                  ...prev,
                  {
                    id: groupDoc.id,
                    participants: groupData.participants,
                    unreadCount: { [user.uid]: unreadCount },
                    lastMessage: lastMessage?.text || lastMessage?.fileName || "File",
                    lastMessageTime: lastMessage?.createdAt,
                    isGroup: true,
                    groupName: groupData.groupName,
                    groupAvatar: groupData.groupAvatar,
                    createdBy: groupData.createdBy,
                    createdAt: groupData.createdAt,
                  },
                ];
              }
            });
          }
        );

        directUnsubscribers.push(messagesUnsubscribe);
      });
    });

    return () => {
      directUnsubscribers.forEach((unsub) => unsub());
      groupUnsubscribe();
    };
  }, [user, users]);

  /* ---------------- LISTEN MESSAGES ---------------- */
  useEffect(() => {
    if (!chatId || !selectedChat) return;

    const collectionPath = selectedChat.isGroup 
      ? `groupChats/${chatId}/messages`
      : `chats/${chatId}/messages`;

    return onSnapshot(
      query(
        collection(db, collectionPath),
        orderBy("createdAt", "asc")
      ),
      (snap) => {
        const data = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }));

        setMessages(data);

        const batch = writeBatch(db);
        data.forEach((m) => {
          if (m.senderUid !== user?.uid) {
            const readBy = m.readBy || [];
            if (!readBy.includes(user!.uid)) {
              batch.update(doc(db, collectionPath, m.id), {
                readBy: [...readBy, user!.uid],
                status: "seen",
              });
            }
          }
        });
        batch.commit();
      }
    );
  }, [chatId, selectedChat, user]);

  /* ---------------- TYPING INDICATOR ---------------- */
  useEffect(() => {
    if (!chatId || !selectedChat) return;

    const typingPath = selectedChat.isGroup
      ? `groupChats/${chatId}/typing`
      : `chats/${chatId}/typing`;

    const q = query(collection(db, typingPath));

    return onSnapshot(q, (snapshot) => {
      const typingUsers: string[] = [];
      snapshot.forEach((doc) => {
        if (doc.id !== user?.uid && doc.data().typing) {
          const typingUser = users.find((u) => u.uid === doc.id);
          if (typingUser) {
           typingUsers.push(
  typingUser.name ?? typingUser.email ?? "User"
);

          }
        }
      });
      setTyping(typingUsers);
    });
  }, [chatId, selectedChat, user, users]);

  const handleTyping = async () => {
    if (!chatId || !user || !selectedChat) return;

    const typingPath = selectedChat.isGroup
      ? `groupChats/${chatId}/typing`
      : `chats/${chatId}/typing`;

    await setDoc(doc(db, typingPath, user.uid), {
      typing: true,
      timestamp: serverTimestamp(),
    });

    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      deleteDoc(doc(db, typingPath, user.uid));
    }, 1500);
  };

  const sendText = async () => {
    if ((!text.trim() && !selectedFile) || !chatId || !user || !selectedChat) return;

    setUploading(true);

    try {
      let fileUrl = "";
      let fileName = "";
      let fileType = "";

      // Upload file if selected
      if (selectedFile) {
        const fileRef = ref(storage, `chat-files/${chatId}/${Date.now()}_${selectedFile.name}`);
        await uploadBytes(fileRef, selectedFile);
        fileUrl = await getDownloadURL(fileRef);
        fileName = selectedFile.name;
        fileType = selectedFile.type;
      }

      const collectionPath = selectedChat.isGroup
        ? `groupChats/${chatId}/messages`
        : `chats/${chatId}/messages`;

      const messageData: any = {
        senderUid: user.uid,
        senderName: getUserName(user),
        status: "sent",
        readBy: [user.uid],
        createdAt: serverTimestamp(),
      };

      if (text.trim()) {
        messageData.text = text;
      }

      if (fileUrl) {
        messageData.fileUrl = fileUrl;
        messageData.fileName = fileName;
        messageData.fileType = fileType;
      }

      await addDoc(collection(db, collectionPath), messageData);

      // Create notifications for other participants
      const otherParticipants = selectedChat.participants.filter((p) => p !== user.uid);
      for (const participantId of otherParticipants) {
        await addDoc(collection(db, "notifications"), {
          fromUid: user.uid,
          fromName: getUserName(user),
          toUid: participantId,
          message: text || fileName || "Sent a file",
          chatId: chatId,
          timestamp: serverTimestamp(),
          read: false,
        });
      }

      const typingPath = selectedChat.isGroup
        ? `groupChats/${chatId}/typing`
        : `chats/${chatId}/typing`;
      
      await deleteDoc(doc(db, typingPath, user.uid));

      setText("");
      setSelectedFile(null);
    } catch (error) {
      console.error("Error sending message:", error);
      alert("Failed to send message");
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const deleteMessage = async (messageId: string) => {
    if (!selectedChat || !chatId) return;

    const collectionPath = selectedChat.isGroup
      ? `groupChats/${chatId}/messages`
      : `chats/${chatId}/messages`;

    await deleteDoc(doc(db, collectionPath, messageId));
  };

  const startEditMessage = (message: Message) => {
    setEditingMessageId(message.id);
    setEditText(message.text || "");
  };

  const saveEditMessage = async () => {
    if (!editingMessageId || !editText.trim() || !selectedChat || !chatId) return;

    const collectionPath = selectedChat.isGroup
      ? `groupChats/${chatId}/messages`
      : `chats/${chatId}/messages`;

    await updateDoc(doc(db, collectionPath, editingMessageId), {
      text: editText,
      isEdited: true,
      editedAt: serverTimestamp(),
    });

    setEditingMessageId(null);
    setEditText("");
  };

  const cancelEdit = () => {
    setEditingMessageId(null);
    setEditText("");
  };

  const markNotificationAsRead = async (notificationId: string) => {
    await updateDoc(doc(db, "notifications", notificationId), {
      read: true,
    });
  };

  const markAllNotificationsAsRead = async () => {
    const batch = writeBatch(db);
    notifications.forEach((notif) => {
      batch.update(doc(db, "notifications", notif.id), { read: true });
    });
    await batch.commit();
  };

  const goToChat = async (notification: Notification) => {
    const chat = chats.find((c) => c.id === notification.chatId);
    if (chat) {
      setSelectedChat(chat);
      await markNotificationAsRead(notification.id);
      setShowNotifications(false);
    }
  };

  const otherUser = useMemo(() => {
  if (!activeCall) return null;

  const otherId =
    activeCall.callerId === user?.uid
      ? activeCall.receiverId
      : activeCall.callerId;

  return users.find(u => u.uid === otherId) ?? null;
}, [users, activeCall, user]);

// NOW you can use it safely
const otherUserName = getUserName(otherUser);
const otherUserInitial = otherUserName.charAt(0).toUpperCase();

  /* ---------------- CALL FUNCTIONS ---------------- */
  const initiateCall = async (type: "video" | "audio") => {
    if (!user || !selectedChat || selectedChat.isGroup) return;

    const receiverId = selectedChat.participants.find((p) => p !== user.uid);
    if (!receiverId) return;

    const receiverUser = users.find((u) => u.uid === receiverId);
    if (!receiverUser) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: type === "video" ? { width: 1280, height: 720 } : false,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      localStreamRef.current = stream;
      if (localVideoRef.current && type === "video") {
        localVideoRef.current.srcObject = stream;
      }

      const peerConnection = new RTCPeerConnection(STUN_SERVERS);
      peerConnectionRef.current = peerConnection;

      stream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, stream);
      });

      peerConnection.ontrack = (event) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      const callDoc = await addDoc(collection(db, "calls"), {
        callerId: user.uid,
          callerName: getUserName(user), 
        receiverId: receiverUser.uid,
        type,
        status: "ringing",
        offer: {
          type: offer.type,
          sdp: offer.sdp,
        },
        iceCandidates: [],
        startTime: serverTimestamp(),
      });

      setActiveCall({
        id: callDoc.id,
        callerId: user.uid,
        callerName: getUserName(user),
        receiverId: receiverUser.uid,
        type,
        status: "ringing",
      });

      peerConnection.onicecandidate = async (event) => {
        if (event.candidate) {
          const callRef = doc(db, "calls", callDoc.id);
          const callSnapshot = await getDoc(callRef);
          
          if (callSnapshot.exists()) {
            const currentCandidates = callSnapshot.data()?.iceCandidates || [];
            
            await updateDoc(callRef, {
              iceCandidates: [
                ...currentCandidates,
                {
                  candidate: event.candidate.candidate,
                  sdpMLineIndex: event.candidate.sdpMLineIndex,
                  sdpMid: event.candidate.sdpMid,
                },
              ],
            });
          }
        }
      };

      peerConnection.onconnectionstatechange = () => {
        if (peerConnection.connectionState === "failed" || 
            peerConnection.connectionState === "disconnected") {
          endCall();
        }
      };

    } catch (error) {
      console.error("Error initiating call:", error);
      alert("Failed to access camera/microphone. Please check permissions.");
    }
  };

  const acceptCall = async () => {
    if (!incomingCall || !user) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: incomingCall.type === "video" ? { width: 1280, height: 720 } : false,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      localStreamRef.current = stream;
      if (localVideoRef.current && incomingCall.type === "video") {
        localVideoRef.current.srcObject = stream;
      }

      const peerConnection = new RTCPeerConnection(STUN_SERVERS);
      peerConnectionRef.current = peerConnection;

      stream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, stream);
      });

      peerConnection.ontrack = (event) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      await peerConnection.setRemoteDescription(
        new RTCSessionDescription(incomingCall.offer)
      );

      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      await updateDoc(doc(db, "calls", incomingCall.id), {
        status: "accepted",
        answer: {
          type: answer.type,
          sdp: answer.sdp,
        },
      });

      setActiveCall(incomingCall);
      setIncomingCall(null);

      peerConnection.onicecandidate = async (event) => {
        if (event.candidate) {
          const callRef = doc(db, "calls", incomingCall.id);
          const callSnapshot = await getDoc(callRef);
          
          if (callSnapshot.exists()) {
            const currentCandidates = callSnapshot.data()?.iceCandidates || [];
            
            await updateDoc(callRef, {
              iceCandidates: [
                ...currentCandidates,
                {
                  candidate: event.candidate.candidate,
                  sdpMLineIndex: event.candidate.sdpMLineIndex,
                  sdpMid: event.candidate.sdpMid,
                },
              ],
            });
          }
        }
      };

      peerConnection.onconnectionstatechange = () => {
        if (peerConnection.connectionState === "failed" || 
            peerConnection.connectionState === "disconnected") {
          endCall();
        }
      };

    } catch (error) {
      console.error("Error accepting call:", error);
      alert("Failed to access camera/microphone. Please check permissions.");
      rejectCall();
    }
  };

  const rejectCall = async () => {
    if (!incomingCall) return;

    await updateDoc(doc(db, "calls", incomingCall.id), {
      status: "rejected",
      endTime: serverTimestamp(),
    });

    await addDoc(collection(db, "callHistory"), {
      callerId: incomingCall.callerId,
      callerName: incomingCall.callerName,
      receiverId: incomingCall.receiverId,
      receiverName: getUserName(user),
      type: incomingCall.type,
      status: "rejected",
      timestamp: serverTimestamp(),
      participants: [incomingCall.callerId, incomingCall.receiverId],
    });

    setIncomingCall(null);
  };

  const endCall = async () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }

    if (activeCall) {
      const callRef = doc(db, "calls", activeCall.id);
      const callSnapshot = await getDoc(callRef);
      
      if (callSnapshot.exists()) {
        await updateDoc(callRef, {
          status: "ended",
          endTime: serverTimestamp(),
        });

        const callData = callSnapshot.data();
        const startTime = callData.startTime?.toMillis();
        const duration = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0;

        await addDoc(collection(db, "callHistory"), {
          callerId: activeCall.callerId,
          callerName: activeCall.callerName,
          receiverId: activeCall.receiverId,
          receiverName: getUserName(users.find(u => u.uid === activeCall.receiverId)),
          type: activeCall.type,
          status: activeCall.status === "accepted" ? "completed" : "missed",
          duration,
          timestamp: serverTimestamp(),
          participants: [activeCall.callerId, activeCall.receiverId],
        });

        await deleteDoc(callRef);
      }
    }

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }

    localStreamRef.current = null;
    peerConnectionRef.current = null;
    setActiveCall(null);
    setIsMuted(false);
    setIsVideoOff(false);
    setCallTimer(0);
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  const formatCallDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
      return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  /* ---------------- CREATE GROUP ---------------- */
  const createGroup = async () => {
    if (!groupName.trim() || selectedMembers.length < 2 || !user) {
      alert("Please enter a group name and select at least 2 members");
      return;
    }

    const allParticipants = [...selectedMembers, user.uid];

    const groupRef = await addDoc(collection(db, "groupChats"), {
      groupName: groupName.trim(),
      participants: allParticipants,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
    });

    await addDoc(collection(db, "groupChats", groupRef.id, "messages"), {
      text: `${getUserName(user)} created the group "${groupName.trim()}"`,
      senderUid: "system",
      senderName: "System",
      createdAt: serverTimestamp(),
      readBy: allParticipants,
    });

    setGroupName("");
    setSelectedMembers([]);
    setShowCreateGroup(false);

    const newGroup: Chat = {
      id: groupRef.id,
      participants: allParticipants,
      isGroup: true,
      groupName: groupName.trim(),
      createdBy: user.uid,
    };
    setSelectedChat(newGroup);
  };

  const toggleMemberSelection = (userId: string) => {
    setSelectedMembers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  /* ---------------- HELPER FUNCTIONS ---------------- */
  const getUnreadCount = (chatId: string) => {
    if (!user) return 0;
    const chat = chats.find((c) => c.id === chatId);
    return chat?.unreadCount?.[user.uid] || 0;
  };

  const getChatName = (chat: Chat) => {
    if (chat.isGroup) {
      return chat.groupName || "Unnamed Group";
    } else {
      const otherUserId = chat.participants.find((p) => p !== user?.uid);
      const otherUser = users.find((u) => u.uid === otherUserId);
      return otherUser?.name || otherUser?.email || "Unknown User";
    }
  };

  const getChatAvatar = (chat: Chat) => {
    if (chat.isGroup) {
      return chat.groupName?.charAt(0).toUpperCase() || "G";
    } else {
      const otherUserId = chat.participants.find((p) => p !== user?.uid);
      const otherUser = users.find((u) => u.uid === otherUserId);
      return (otherUser?.name || otherUser?.email)?.charAt(0).toUpperCase() || "?";
    }
  };

  const isUserOnline = (chat: Chat) => {
    if (chat.isGroup) return false;
    const otherUserId = chat.participants.find((p) => p !== user?.uid);
    const otherUser = users.find((u) => u.uid === otherUserId);
    return otherUser?.online || false;
  };

  const getUserStatus = (chat: Chat): string => {
    if (chat.isGroup) return "";
    const otherUserId = chat.participants.find((p) => p !== user?.uid);
    const otherUser = users.find((u) => u.uid === otherUserId);
    const status = otherUser?.status || "offline";
    
    if (!otherUser?.online) return "Offline";
    
    switch (status) {
      case "available": return "Available";
      case "busy": return "Busy";
      case "dnd": return "Do not disturb";
      case "brb": return "Be right back";
      case "away": return "Away";
      default: return "Offline";
    }
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith("image/")) {
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    } else if (fileType.startsWith("video/")) {
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      );
    } else if (fileType.includes("pdf")) {
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      );
    } else {
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    }
  };

  /* ---------------- FILTER CHATS ---------------- */
  const filteredChats = chats.filter((chat) => {
    if (activeTab === "direct" && chat.isGroup) return false;
    if (activeTab === "groups" && !chat.isGroup) return false;

    if (!searchQuery) return true;

    const query = searchQuery.toLowerCase();

    if (chat.isGroup) {
      return chat.groupName?.toLowerCase().includes(query);
    } else {
      const otherUserId = chat.participants.find((p) => p !== user?.uid);
      const otherUser = users.find((u) => u.uid === otherUserId);
      return (
        otherUser?.name?.toLowerCase().includes(query) ||
        otherUser?.email?.toLowerCase().includes(query)
      );
    }
  });

  const sortedChats = [...filteredChats].sort((a, b) => {
    const hasMessagesA = !!a.lastMessageTime;
    const hasMessagesB = !!b.lastMessageTime;

    if (hasMessagesA && hasMessagesB) {
      const timeA = a.lastMessageTime?.toMillis() || 0;
      const timeB = b.lastMessageTime?.toMillis() || 0;
      return timeB - timeA;
    }

    if (hasMessagesA && !hasMessagesB) return -1;
    if (!hasMessagesA && hasMessagesB) return 1;

    const nameA = getChatName(a).toLowerCase();
    const nameB = getChatName(b).toLowerCase();
    return nameA.localeCompare(nameB);
  });

  return (
    <>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* INCOMING CALL MODAL */}
      {incomingCall && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center animate-fade-in">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 text-center shadow-2xl">
           {(() => {
  const caller = users.find(u => u.uid === incomingCall.callerId);

  return caller?.profilePhoto ? (
    <img
      src={caller.profilePhoto}
      className="w-24 h-24 rounded-full object-cover mx-auto mb-4 animate-pulse"
      alt="Caller"
    />
  ) : (
    <div className="w-24 h-24 bg-gradient-to-br from-purple-400 to-blue-400 rounded-full flex items-center justify-center text-white font-bold text-3xl mx-auto mb-4 animate-pulse">
      {incomingCall.callerName.charAt(0).toUpperCase()}
    </div>
  );
})()}

            <h3 className="text-2xl font-bold text-gray-800 mb-2">
              {incomingCall.callerName}
            </h3>
            <p className="text-gray-600 mb-2">
              Incoming {incomingCall.type} call...
            </p>
            <div className="flex items-center justify-center gap-2 mb-8">
              <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
            </div>
            <div className="flex gap-4 justify-center">
              <button
                onClick={rejectCall}
                className="w-16 h-16 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center transition-all transform hover:scale-110"
              >
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <button
                onClick={acceptCall}
                className="w-16 h-16 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center transition-all transform hover:scale-110"
              >
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ACTIVE CALL INTERFACE */}
      {activeCall && (
        <div className="fixed inset-0 bg-gray-900 z-50 flex flex-col">
          <div className="flex-1 relative bg-gray-800">
            {activeCall.type === "video" ? (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="w-32 h-32 bg-gradient-to-br from-purple-400 to-blue-400 rounded-full flex items-center justify-center text-white font-bold text-5xl mx-auto mb-4">
  {otherUserInitial}
</div>

<p className="text-white text-xl font-semibold">
  {otherUserName}
</p>

                </div>
              </div>
            )}
            
            {activeCall.type === "video" && (
              <div className="absolute top-4 right-4 w-48 h-36 bg-gray-800 rounded-lg overflow-hidden shadow-2xl border-2 border-gray-700">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                {isVideoOff && (
                  <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
                    <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
              </div>
            )}

            <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-sm rounded-lg px-4 py-2">
              <p className="text-white font-medium">
                {activeCall.status === "ringing" ? "Calling..." : formatCallDuration(callTimer)}
              </p>
            </div>
          </div>

          <div className="bg-gray-800 p-6">
            <div className="flex justify-center gap-4">
              <button
                onClick={toggleMute}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all transform hover:scale-110 ${
                  isMuted ? "bg-red-500 hover:bg-red-600" : "bg-gray-700 hover:bg-gray-600"
                }`}
                title={isMuted ? "Unmute" : "Mute"}
              >
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {isMuted ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" clipRule="evenodd" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  )}
                </svg>
              </button>

              {activeCall.type === "video" && (
                <button
                  onClick={toggleVideo}
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-all transform hover:scale-110 ${
                    isVideoOff ? "bg-red-500 hover:bg-red-600" : "bg-gray-700 hover:bg-gray-600"
                  }`}
                  title={isVideoOff ? "Turn on camera" : "Turn off camera"}
                >
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              )}

              <button
                onClick={endCall}
                className="w-14 h-14 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center transition-all transform hover:scale-110"
                title="End call"
              >
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE GROUP MODAL */}
      {showCreateGroup && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-gray-800">Create Group</h3>
              <button
                onClick={() => {
                  setShowCreateGroup(false);
                  setGroupName("");
                  setSelectedMembers([]);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Group Name
              </label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Enter group name"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-purple-300"
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Members ({selectedMembers.length} selected)
              </label>
              <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
                {users
                  .filter((u) => u.uid !== user?.uid)
                  .map((u) => (
                    <button
                      key={u.uid}
                      onClick={() => toggleMemberSelection(u.uid)}
                      className={`w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors ${
                        selectedMembers.includes(u.uid) ? "bg-purple-50" : ""
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                          selectedMembers.includes(u.uid)
                            ? "bg-purple-600 border-purple-600"
                            : "border-gray-300"
                        }`}
                      >
                        {selectedMembers.includes(u.uid) && (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-blue-400 flex items-center justify-center text-white font-bold text-xs">
                        {getUserName(u).charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 text-left">
                        <p className="font-semibold text-gray-800 text-sm">
                          {u.name || u.email}
                        </p>
                      </div>
                    </button>
                  ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowCreateGroup(false);
                  setGroupName("");
                  setSelectedMembers([]);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createGroup}
                disabled={!groupName.trim() || selectedMembers.length < 2}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Create Group
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex h-full">
        {/* CONTACTS LIST - Left Side */}
        <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-gray-200">
            {/* Notification Bell and Create Group */}
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-gray-800">Chats</h2>
              <div className="flex items-center gap-2">
                {/* Notification Bell */}
                <div className="relative" ref={notificationRef}>
                  <button
                    onClick={() => setShowNotifications(!showNotifications)}
                    className="relative w-9 h-9 rounded hover:bg-gray-100 flex items-center justify-center transition-colors"
                  >
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                            <button
                              key={notif.id}
                              onClick={() => goToChat(notif)}
                              className="w-full p-3 hover:bg-gray-50 border-b border-gray-100 text-left transition-colors"
                            >
                              <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-blue-400 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                                  {notif.fromName.charAt(0).toUpperCase()}
                                </div>
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
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Create Group Button */}
                <button
                  onClick={() => setShowCreateGroup(true)}
                  className="w-9 h-9 rounded hover:bg-gray-100 flex items-center justify-center transition-colors"
                  title="Create group"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setActiveTab("all")}
                className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === "all"
                    ? "bg-purple-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setActiveTab("direct")}
                className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === "direct"
                    ? "bg-purple-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Direct
              </button>
              <button
                onClick={() => setActiveTab("groups")}
                className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === "groups"
                    ? "bg-purple-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Groups
              </button>
            </div>
            
            {/* Search */}
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search chats"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-purple-300"
              />
            </div>
          </div>

          {/* Chats List */}
          <div className="flex-1 overflow-y-auto">
            {sortedChats.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <p className="text-sm">No chats found</p>
              </div>
            ) : (
              sortedChats.map((chat) => {
                const unreadCount = getUnreadCount(chat.id);
                const chatName = getChatName(chat);
                const avatar = getChatAvatar(chat);
                const online = isUserOnline(chat);

                return (
                  <button
                    key={chat.id}
                    onClick={() => setSelectedChat(chat)}
                    className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors border-b border-gray-100 ${
                      selectedChat?.id === chat.id ? "bg-purple-50" : ""
                    }`}
                  >
                    <div className="relative">
                      <div className="relative w-10 h-10">
  {(() => {
    if (chat.isGroup) {
      return (
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-teal-400 flex items-center justify-center text-white font-bold text-sm">
          {avatar}
        </div>
      );
    }

    const otherUserId = chat.participants.find((p) => p !== user?.uid);
    const otherUser = users.find((u) => u.uid === otherUserId);

    return otherUser?.profilePhoto ? (
      <img
        src={otherUser.profilePhoto}
        className="w-10 h-10 rounded-full object-cover"
        alt="User"
      />
    ) : (
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-blue-400 flex items-center justify-center text-white font-bold text-sm">
        {(otherUser?.name || otherUser?.email)?.charAt(0).toUpperCase()}
      </div>
    );
  })()}
</div>

                      {online && !chat.isGroup && (
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                      )}
                      {chat.isGroup && (
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center">
                          <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-semibold text-gray-800 text-sm truncate">
                          {chatName}
                        </p>
                        {unreadCount > 0 && (
                          <span className="bg-green-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold ml-2">
                            {unreadCount}
                          </span>
                        )}
                      </div>
                      {chat.lastMessage && (
                        <p className="text-xs text-gray-500 truncate">
                          {chat.lastMessage}
                        </p>
                      )}
                    </div>
                    {selectedChat?.id === chat.id && (
                      <div className="w-1 h-10 bg-purple-600 rounded-l absolute right-0"></div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* CONVERSATION AREA - Right Side */}
        {!selectedChat ? (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-purple-400 to-blue-400 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Select a conversation</h3>
              <p className="text-gray-500 text-sm">Choose from your chats or create a group to start messaging</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col bg-gray-50">
            {/* Conversation Header */}
            <div className="h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full overflow-hidden">
  {(() => {
    if (selectedChat.isGroup) {
      return (
        <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-teal-400 flex items-center justify-center text-white font-bold">
          {getChatAvatar(selectedChat)}
        </div>
      );
    }

    const otherUserId = selectedChat.participants.find((p) => p !== user?.uid);
    const otherUser = users.find((u) => u.uid === otherUserId);

    return otherUser?.profilePhoto ? (
      <img
        src={otherUser.profilePhoto}
        className="w-full h-full object-cover"
        alt="User"
      />
    ) : (
      <div className="w-full h-full bg-gradient-to-br from-purple-400 to-blue-400 flex items-center justify-center text-white font-bold">
        {(otherUser?.name || otherUser?.email)?.charAt(0).toUpperCase()}
      </div>
    );
  })()}
</div>

                  {isUserOnline(selectedChat) && !selectedChat.isGroup && (
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                  )}
                </div>
                <div>
                  <p className="font-semibold text-gray-800">
                    {getChatName(selectedChat)}
                  </p>
                  {typing.length > 0 ? (
                    <p className="text-xs text-purple-600 animate-pulse font-medium">
                      {typing.join(", ")} {typing.length === 1 ? "is" : "are"} typing...
                    </p>
                  ) : selectedChat.isGroup ? (
                    <p className="text-xs text-gray-500">
                      {selectedChat.participants.length} members
                    </p>
                  ) : (
                    <p className="text-xs text-gray-500">
                      {getUserStatus(selectedChat)}
                    </p>
                  )}
                </div>
              </div>

              {!selectedChat.isGroup && (
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => initiateCall("video")}
                    className="w-9 h-9 rounded hover:bg-gray-100 flex items-center justify-center transition-colors" 
                    title="Video call"
                  >
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                  <button 
                    onClick={() => initiateCall("audio")}
                    className="w-9 h-9 rounded hover:bg-gray-100 flex items-center justify-center transition-colors" 
                    title="Audio call"
                  >
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </button>
                </div>
              )}
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6">
              {messages.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500">No messages yet. Start the conversation!</p>
                </div>
              ) : (
                messages.map((m, idx) => {
                  const mine = m.senderUid === user?.uid;
                  const isSystem = m.senderUid === "system";
                  const showAvatar = idx === 0 || messages[idx - 1]?.senderUid !== m.senderUid;
                  const isRead = m.readBy && m.readBy.length > 1;
                  const senderUser = users.find((u) => u.uid === m.senderUid);

                  if (isSystem) {
                    return (
                      <div key={m.id} className="flex justify-center my-4">
                        <div className="bg-gray-200 text-gray-600 text-xs px-4 py-2 rounded-full">
                          {m.text}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={m.id} className={`flex gap-3 mb-4 group ${mine ? "flex-row-reverse" : "flex-row"}`}>
                      {!mine && showAvatar ? (
                        <div className="w-8 h-8 rounded-full overflow-hidden shrink-0">
  {senderUser?.profilePhoto ? (
    <img
      src={senderUser.profilePhoto}
      className="w-full h-full object-cover"
      alt="User"
    />
  ) : (
    <div className="w-full h-full bg-gradient-to-br from-purple-400 to-blue-400 flex items-center justify-center text-white text-xs font-bold">
      {(senderUser?.name || m.senderName || "?").charAt(0).toUpperCase()}
    </div>
  )}
</div>

                      ) : (
                        !mine && <div className="w-8" />
                      )}
                      
                      <div className={`max-w-[70%] ${mine ? "items-end" : "items-start"}`}>
                        {selectedChat.isGroup && !mine && showAvatar && (
                          <p className="text-xs text-gray-500 mb-1 px-1">
                            {senderUser?.name || m.senderName || "Unknown"}
                          </p>
                        )}
                        
                        {editingMessageId === m.id && mine ? (
                          <div className="bg-white p-3 rounded-lg shadow-sm">
                            <textarea
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded text-sm outline-none focus:ring-2 focus:ring-purple-300 resize-none"
                              rows={2}
                              autoFocus
                            />
                            <div className="flex gap-2 mt-2">
                              <button
                                onClick={saveEditMessage}
                                className="px-3 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700"
                              >
                                Save
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="px-3 py-1 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div
                              className={`px-4 py-2 rounded-lg relative ${
                                mine
                                  ? "bg-purple-600 text-white rounded-br-none"
                                  : "bg-white text-gray-800 rounded-bl-none shadow-sm"
                              }`}
                            >
                              {m.text && <p className="break-words text-sm">{m.text}</p>}
                              {m.imageUrl && (
                                <img
                                  src={m.imageUrl}
                                  className="mt-1 rounded max-h-48 cursor-pointer"
                                  alt="Shared"
                                  onClick={() => window.open(m.imageUrl, '_blank')}
                                />
                              )}
                              {m.fileUrl && !m.imageUrl && (
                                <a
                                  href={m.fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`flex items-center gap-2 mt-1 p-2 rounded ${
                                    mine ? "bg-purple-700" : "bg-gray-100"
                                  }`}
                                >
                                  {getFileIcon(m.fileType || "")}
                                  <span className="text-sm truncate">{m.fileName}</span>
                                </a>
                              )}
                              {m.isEdited && (
                                <p className={`text-xs mt-1 ${mine ? "text-purple-200" : "text-gray-400"}`}>
                                  (edited)
                                </p>
                              )}
                              
                              {/* Message actions (Edit/Delete) - only for sender */}
                              {mine && (
                                <div className="absolute top-0 right-0 -mt-8 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                  <button
                                    onClick={() => startEditMessage(m)}
                                    className="p-1 bg-gray-700 text-white rounded hover:bg-gray-800 text-xs"
                                    title="Edit"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (confirm("Delete this message?")) {
                                        deleteMessage(m.id);
                                      }
                                    }}
                                    className="p-1 bg-red-600 text-white rounded hover:bg-red-700 text-xs"
                                    title="Delete"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>
                              )}
                            </div>
                            <div className={`flex items-center gap-1 mt-1 px-1 ${mine ? "justify-end" : "justify-start"}`}>
                              <p className="text-xs text-gray-400">
                                {m.createdAt?.toDate?.()?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || "Now"}
                              </p>
                              {mine && (
                                <span className="text-xs">
                                  {isRead ? (
                                    <span className="text-green-500 font-bold">✓✓</span>
                                  ) : m.status === "delivered" ? (
                                    <span className="text-gray-400">✓✓</span>
                                  ) : (
                                    <span className="text-gray-400">✓</span>
                                  )}
                                </span>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="bg-white border-t border-gray-200 p-4">
              {selectedFile && (
                <div className="mb-2 flex items-center gap-2 bg-gray-100 p-2 rounded">
                  {getFileIcon(selectedFile.type)}
                  <span className="text-sm text-gray-700 flex-1 truncate">{selectedFile.name}</span>
                  <button
                    onClick={() => setSelectedFile(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
              <div className="flex items-end gap-3">
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-9 h-9 rounded hover:bg-gray-100 flex items-center justify-center transition-colors"
                  title="Attach file"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                </button>

                <div className="flex-1">
                  <textarea
                    value={text}
                    onChange={(e) => {
                      setText(e.target.value);
                      handleTyping();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendText();
                      }
                    }}
                    placeholder="Type a message..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-purple-300 resize-none"
                    rows={1}
                    style={{ minHeight: "40px", maxHeight: "120px" }}
                    disabled={uploading}
                  />
                </div>

                <button
                  onClick={sendText}
                  disabled={(!text.trim() && !selectedFile) || uploading}
                  className={`w-9 h-9 rounded flex items-center justify-center transition-colors ${
                    (text.trim() || selectedFile) && !uploading
                      ? "bg-purple-600 text-white hover:bg-purple-700"
                      : "bg-gray-200 text-gray-400 cursor-not-allowed"
                  }`}
                >
                  {uploading ? (
                    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}