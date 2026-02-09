"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  doc,
  updateDoc,
  deleteDoc,
  setDoc,
  getDoc,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

/* ---------------- TYPES ---------------- */

type User = {
  uid: string;
  name?: string | null;
  email?: string | null;
  avatar?: string;
  online?: boolean;
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

type CallHistory = {
  id: string;
  callerId: string;
  callerName: string;
  receiverId: string;
  receiverName: string;
  type: "video" | "audio";
  status: "completed" | "missed" | "rejected";
  duration?: number;
  timestamp: any;
};

const getUserName = (user?: Partial<User> | null): string =>
  user?.name ??
  user?.email ??
  "User";


export default function TeamsStyleCallsEnhanced({ users }: { users: User[] }) {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeView, setActiveView] = useState<"dial" | "history">("dial");
  const [incomingCall, setIncomingCall] = useState<Call | null>(null);
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [callHistory, setCallHistory] = useState<CallHistory[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callTimer, setCallTimer] = useState(0);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const STUN_SERVERS = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ],
  };

  const getInitial = (name?: string | null) =>
  name?.charAt(0)?.toUpperCase() || "?";

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

  /* ---------------- LOAD CALL HISTORY ---------------- */
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "callHistory"),
      where("participants", "array-contains", user.uid)
    );

    return onSnapshot(q, (snapshot) => {
      const history = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as CallHistory[];
      
      setCallHistory(history.sort((a, b) => 
        b.timestamp?.toMillis() - a.timestamp?.toMillis()
      ));
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

      // Handle answer from receiver
      if (call.answer && peerConnectionRef.current && !peerConnectionRef.current.remoteDescription) {
        await peerConnectionRef.current.setRemoteDescription(
          new RTCSessionDescription(call.answer)
        );
      }

      // Handle ICE candidates
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

      // Handle call ended
      if (call.status === "ended" || call.status === "rejected") {
        endCall();
      }
    });
  }, [activeCall?.id]);

  /* ---------------- INITIATE CALL ---------------- */
  const initiateCall = async (receiverUser: User, type: "video" | "audio") => {
    if (!user) return;

    try {
      // Get local media stream
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

      // Create peer connection
      const peerConnection = new RTCPeerConnection(STUN_SERVERS);
      peerConnectionRef.current = peerConnection;

      // Add tracks to peer connection
      stream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, stream);
      });

      // Handle remote stream
     // Handle remote stream
peerConnection.ontrack = (event) => {
  if (remoteVideoRef.current) {
    remoteVideoRef.current.srcObject = event.streams[0];
  }
};

// Create offer
const offer = await peerConnection.createOffer();
await peerConnection.setLocalDescription(offer);

// Create call document
const callDoc = await addDoc(collection(db, "calls"), {
  callerId: user.uid,
  callerName: getUserName(user), // ✅ PUT IT HERE
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
        callerName: getUserName(user), // ✅ FIXED: Use getUserName instead of user.email
        receiverId: receiverUser.uid,
        type,
        status: "ringing",
      });

      // Handle ICE candidates
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

      // Handle connection state
      peerConnection.onconnectionstatechange = () => {
        console.log("Connection state:", peerConnection.connectionState);
       if (peerConnection.connectionState === "failed") {
  endCall();
}
      };

    } catch (error) {
      console.error("Error initiating call:", error);
      alert("Failed to access camera/microphone. Please check permissions.");
    }
  };

  /* ---------------- ACCEPT CALL ---------------- */
  const acceptCall = async () => {
    if (!incomingCall || !user) return;

    try {
      // Get local media stream
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

      // Create peer connection
      const peerConnection = new RTCPeerConnection(STUN_SERVERS);
      peerConnectionRef.current = peerConnection;

      // Add tracks to peer connection
      stream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, stream);
      });

      // Handle remote stream
      peerConnection.ontrack = (event) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      // Set remote description (offer from caller)
      await peerConnection.setRemoteDescription(
        new RTCSessionDescription(incomingCall.offer)
      );

      // Create answer
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      // Update call document with answer
      await updateDoc(doc(db, "calls", incomingCall.id), {
        status: "accepted",
        answer: {
          type: answer.type,
          sdp: answer.sdp,
        },
      });

      setActiveCall(incomingCall);
      setIncomingCall(null);

      // Handle ICE candidates
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

      // Handle connection state
      peerConnection.onconnectionstatechange = () => {
        console.log("Connection state:", peerConnection.connectionState);
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

  /* ---------------- REJECT CALL ---------------- */
  const rejectCall = async () => {
    if (!incomingCall) return;

    await updateDoc(doc(db, "calls", incomingCall.id), {
      status: "rejected",
      endTime: serverTimestamp(),
    });

    // Save to history
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

  /* ---------------- END CALL ---------------- */
  const endCall = async () => {
    // Stop all tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }

    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }

    // Update call document
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

        // Save to history
        await addDoc(collection(db, "callHistory"), {
          callerId: activeCall.callerId,
          callerName: activeCall.callerName,
          receiverId: activeCall.receiverId,
          receiverName:
  getUserName(
    users.find(u => u.uid === activeCall.receiverId)
  ),

          type: activeCall.type,
          status: activeCall.status === "accepted" ? "completed" : "missed",
          duration,
          timestamp: serverTimestamp(),
          participants: [activeCall.callerId, activeCall.receiverId],
        });

        // Delete call document after saving to history
        await deleteDoc(callRef);
      }
    }

    // Clear timer
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }

    // Reset states
    localStreamRef.current = null;
    peerConnectionRef.current = null;
    setActiveCall(null);
    setIsMuted(false);
    setIsVideoOff(false);
    setCallTimer(0);
  };

  /* ---------------- TOGGLE MUTE ---------------- */
  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  /* ---------------- TOGGLE VIDEO ---------------- */
  const toggleVideo = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  /* ---------------- FORMAT TIME ---------------- */
  const formatCallDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
      return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  const filteredUsers = users.filter(
    (u) =>
      u.uid !== user?.uid &&
      (u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchQuery.toLowerCase())
)
  );

  return (
    <>
      {/* INCOMING CALL MODAL */}
      {incomingCall && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center animate-fade-in">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 text-center shadow-2xl">
            <div className="w-24 h-24 bg-gradient-to-br from-purple-400 to-blue-400 rounded-full flex items-center justify-center text-white font-bold text-3xl mx-auto mb-4 animate-pulse">
              {incomingCall.callerName.charAt(0).toUpperCase()}
            </div>
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
          {/* Remote Video */}
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
                    {users
  .find(u => u.uid === (activeCall.callerId === user?.uid 
      ? activeCall.receiverId 
      : activeCall.callerId))
  ?.email?.charAt(0)?.toUpperCase() || "?"
}
                  </div>
                  <p className="text-white text-xl font-semibold">
                    {users.find(u => u.uid === (activeCall.callerId === user?.uid ? activeCall.receiverId : activeCall.callerId))?.email || "Unknown"}
                  </p>
                </div>
              </div>
            )}
            
            {/* Local Video (Picture-in-Picture) */}
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

            {/* Call Info */}
            <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-sm rounded-lg px-4 py-2">
              <p className="text-white font-medium">
                {activeCall.status === "ringing" ? "Calling..." : formatCallDuration(callTimer)}
              </p>
            </div>
          </div>

          {/* Call Controls */}
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

      {/* NORMAL CALLS INTERFACE */}
      {!activeCall && (
        <div className="flex h-full">
          {/* LEFT PANEL - Call Options */}
          <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Calls</h2>
              
              {/* Tab Buttons */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setActiveView("dial")}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                    activeView === "dial"
                      ? "bg-purple-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Make a call
                </button>
                <button
                  onClick={() => setActiveView("history")}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                    activeView === "history"
                      ? "bg-purple-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  History ({callHistory.length})
                </button>
              </div>

              {activeView === "dial" && (
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search to call"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-purple-300"
                  />
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {activeView === "dial" ? (
                <div className="p-2">
                  {filteredUsers.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      <p className="text-sm">No contacts found</p>
                    </div>
                  ) : (
                    filteredUsers.map((u) => (
                      <div
                        key={u.uid}
                        className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors group"
                      >
                        <div className="relative">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-blue-400 flex items-center justify-center text-white font-bold text-sm">
                            {getInitial(u.name || u.email)}
                          </div>
                          {u.online && (
                            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-gray-800 text-sm">
                            {u.name || u.email}
                          </p>
                          <p className="text-xs text-gray-500">
                            {u.online ? "Available" : "Away"}
                          </p>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => initiateCall(u, "video")}
                            className="w-8 h-8 rounded-full bg-purple-600 hover:bg-purple-700 flex items-center justify-center transition-colors"
                            title="Video call"
                          >
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => initiateCall(u, "audio")}
                            className="w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-700 flex items-center justify-center transition-colors"
                            title="Audio call"
                          >
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div className="p-2">
                  {callHistory.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      <p className="text-sm">No call history</p>
                    </div>
                  ) : (
                    callHistory.map((call) => {
                      const isOutgoing = call.callerId === user?.uid;
                      const otherPersonName = isOutgoing ? call.receiverName : call.callerName;
                      
                      return (
                        <div
                          key={call.id}
                          className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors"
                        >
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-blue-400 flex items-center justify-center text-white font-bold text-sm">
                            {(otherPersonName?.charAt(0) ?? "?")
.toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-800 text-sm truncate">
                              {otherPersonName}
                            </p>
                            <div className="flex items-center gap-1 text-xs text-gray-500">
                              <svg className={`w-3 h-3 ${isOutgoing ? '' : 'rotate-180'} ${
                                call.status === "missed" ? "text-red-500" : ""
                              }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                              </svg>
                              <span className={call.status === "missed" ? "text-red-500" : ""}>
                                {call.status === "completed" 
                                  ? formatCallDuration(call.duration || 0)
                                  : call.status === "missed"
                                  ? "Missed"
                                  : "Rejected"
                                }
                              </span>
                              <span>•</span>
                              <span>{call.type}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-xs text-gray-400">
                              {call.timestamp?.toDate?.()?.toLocaleDateString()}
                            </span>
                            <p className="text-xs text-gray-400">
                              {call.timestamp?.toDate?.()?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT PANEL - Call Interface / Info */}
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center max-w-md px-4">
              <div className="w-24 h-24 bg-gradient-to-br from-purple-400 to-blue-400 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </div>
              <h3 className="text-2xl font-semibold text-gray-800 mb-3">
                {activeView === "dial" ? "Start a call" : "Call History"}
              </h3>
              <p className="text-gray-500">
                {activeView === "dial" 
                  ? "Select a contact to start a video or audio call"
                  : "View your recent call activity and details"
                }
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}