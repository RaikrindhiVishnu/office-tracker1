"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  collection, addDoc, onSnapshot, query, where,
  serverTimestamp, doc, updateDoc, getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

type User = {
  uid: string; name?: string|null; email?: string|null;
  profilePhoto?: string; avatar?: string; online?: boolean;
};
type Call = {
  id: string; callerId: string; callerName: string; receiverId: string;
  type: "video"|"audio"; status: "ringing"|"accepted"|"rejected"|"ended";
  offer?: any; answer?: any; startTime?: any; endTime?: any;
};
type CallHistory = {
  id: string; callerId: string; callerName: string;
  receiverId: string; receiverName: string;
  type: "video"|"audio"; status: "completed"|"missed"|"rejected";
  duration?: number; timestamp: any; participants: string[];
};

const getUserName = (u?: Partial<User>|null) => u?.name ?? u?.email ?? "User";
const initials = (n:string) => (n??"").split(" ").slice(0,2).map(w=>w[0]?.toUpperCase()??"").join("");
const COLORS = [["#e8512a","#f5853f"],["#7c3aed","#a78bfa"],["#0891b2","#22d3ee"],["#059669","#34d399"],["#db2777","#f472b6"],["#1d4ed8","#60a5fa"]];
const avGrad = (n:string) => COLORS[(n?.charCodeAt(0)??65) % COLORS.length];
const STUN = { iceServers:[{urls:"stun:stun.l.google.com:19302"},{urls:"stun:stun1.l.google.com:19302"}] };

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
*,*::before,*::after{box-sizing:border-box;}
.zcc{font-family:'DM Sans',sans-serif;display:flex;height:100%;background:#f0f2f5;color:#1a1d23;overflow:hidden;}

/* Left panel */
.zcc-panel{width:300px;background:#fff;border-right:1px solid #e8eaf0;display:flex;flex-direction:column;flex-shrink:0;}
.zcc-panel-hd{padding:16px 16px 12px;border-bottom:1px solid #f0f2f5;}
.zcc-title{font-size:17px;font-weight:700;color:#1a1d23;margin-bottom:14px;}
.zcc-tabs{display:flex;background:#f5f6f8;border-radius:10px;padding:3px;gap:3px;margin-bottom:12px;}
.zcc-tab{flex:1;padding:6px 0;border-radius:7px;font-size:12.5px;font-weight:600;cursor:pointer;border:none;background:transparent;color:#6b7280;transition:all .14s;font-family:'DM Sans',sans-serif;}
.zcc-tab.on{background:#fff;color:#e8512a;box-shadow:0 1px 4px rgba(0,0,0,.08);}
.zcc-search-wrap{position:relative;}
.zcc-search{width:100%;padding:7px 10px 7px 32px;background:#f5f6f8;border:1.5px solid transparent;border-radius:8px;font-size:13px;font-family:'DM Sans',sans-serif;outline:none;color:#1a1d23;transition:all .15s;}
.zcc-search:focus{background:#fff;border-color:#e8512a;}
.zcc-search-ico{position:absolute;left:10px;top:50%;transform:translateY(-50%);color:#9aa0ad;pointer-events:none;}

/* Dial list */
.zcc-list{flex:1;overflow-y:auto;padding:6px;}
.zcc-list::-webkit-scrollbar{width:3px;}
.zcc-list::-webkit-scrollbar-thumb{background:#e8eaf0;border-radius:3px;}
.zcc-contact{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:10px;cursor:pointer;transition:background .13s;position:relative;}
.zcc-contact:hover{background:#f9fafb;}
.zcc-contact:hover .zcc-call-btns{opacity:1;}
.zcc-av{width:40px;height:40px;border-radius:11px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;color:#fff;flex-shrink:0;overflow:hidden;}
.zcc-av img{width:100%;height:100%;object-fit:cover;}
.zcc-online-dot{width:10px;height:10px;border-radius:50%;background:#22c55e;border:2px solid #fff;position:absolute;bottom:-1px;right:-1px;}
.zcc-contact-name{font-size:13px;font-weight:600;color:#1a1d23;line-height:1.2;}
.zcc-contact-sub{font-size:11.5px;color:#9aa0ad;margin-top:1px;}
.zcc-call-btns{opacity:0;transition:opacity .14s;display:flex;gap:5px;margin-left:auto;flex-shrink:0;}
.zcc-cta{width:32px;height:32px;border-radius:50%;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s;}
.zcc-cta:hover{transform:scale(1.1);}
.zcc-cta.video{background:#eff6ff;color:#1d4ed8;}
.zcc-cta.video:hover{background:#dbeafe;}
.zcc-cta.audio{background:#f0fdf4;color:#059669;}
.zcc-cta.audio:hover{background:#dcfce7;}

/* History */
.zcc-hist-item{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:10px;}
.zcc-hist-info{flex:1;min-width:0;}
.zcc-hist-name{font-size:13px;font-weight:600;color:#1a1d23;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.zcc-hist-sub{display:flex;align-items:center;gap:5px;font-size:11.5px;color:#6b7280;margin-top:2px;}
.zcc-hist-status-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0;}
.zcc-hist-time{font-size:11px;color:#9aa0ad;text-align:right;flex-shrink:0;}

/* Right panel — idle */
.zcc-right{flex:1;display:flex;align-items:center;justify-content:center;background:#f0f2f5;}
.zcc-right-card{text-align:center;max-width:320px;}
.zcc-right-ico{width:80px;height:80px;border-radius:22px;background:#fff;display:flex;align-items:center;justify-content:center;font-size:36px;margin:0 auto 20px;box-shadow:0 4px 20px rgba(0,0,0,.08);}

/* ── ACTIVE CALL OVERLAY ── */
.zcc-call-ov{position:fixed;inset:0;background:#0d1117;z-index:9999;display:flex;flex-direction:column;}
.zcc-call-main{flex:1;position:relative;background:#161b22;display:flex;align-items:center;justify-content:center;overflow:hidden;}
.zcc-remote-vid{width:100%;height:100%;object-fit:cover;}
.zcc-audio-center{display:flex;flex-direction:column;align-items:center;gap:14px;}
.zcc-audio-av{width:120px;height:120px;border-radius:28px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:44px;color:#fff;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.4);}
.zcc-audio-av img{width:100%;height:100%;object-fit:cover;}
.zcc-audio-name{font-size:22px;font-weight:700;color:#fff;font-family:'DM Sans',sans-serif;}
.zcc-audio-status{font-size:14px;color:rgba(255,255,255,.5);font-family:'DM Sans',sans-serif;}
.zcc-local-pip{position:absolute;bottom:16px;right:16px;width:180px;height:135px;border-radius:14px;overflow:hidden;border:2px solid rgba(255,255,255,.2);box-shadow:0 8px 32px rgba(0,0,0,.4);}
.zcc-call-timer{position:absolute;top:16px;left:16px;background:rgba(0,0,0,.5);backdrop-filter:blur(8px);border-radius:10px;padding:8px 16px;color:#fff;font-size:14px;font-weight:600;font-family:'DM Sans',sans-serif;}
.zcc-call-bar{background:#1a1d23;padding:22px;display:flex;justify-content:center;align-items:center;gap:16px;flex-shrink:0;}
.zcc-cb{width:56px;height:56px;border-radius:50%;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .16s;}
.zcc-cb:hover{transform:scale(1.08);}
.zcc-cb.neutral{background:#2d333b;color:#fff;}
.zcc-cb.neutral:hover{background:#373e47;}
.zcc-cb.red{background:#e8512a;color:#fff;}
.zcc-cb.red:hover{background:#d04420;}
.zcc-cb.active{background:#dc2626;color:#fff;}

/* Incoming call */
.zcc-inc-ov{position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(8px);}
.zcc-inc-card{background:#fff;border-radius:22px;padding:40px;text-align:center;width:340px;box-shadow:0 32px 80px rgba(0,0,0,.28);}
.zcc-inc-av{width:90px;height:90px;border-radius:22px;margin:0 auto 16px;display:flex;align-items:center;justify-content:center;font-size:38px;font-weight:800;color:#fff;overflow:hidden;}
.zcc-inc-av img{width:100%;height:100%;object-fit:cover;}
.zcc-inc-name{font-size:20px;font-weight:700;color:#1a1d23;margin-bottom:4px;}
.zcc-inc-type{font-size:13px;color:#6b7280;margin-bottom:20px;}
.zcc-inc-pulse{display:flex;gap:6px;justify-content:center;margin-bottom:28px;}
.zcc-pulse-dot{width:8px;height:8px;border-radius:50%;background:#e8512a;animation:zcc-pulse .9s infinite;}
.zcc-pulse-dot:nth-child(2){animation-delay:.18s;}
.zcc-pulse-dot:nth-child(3){animation-delay:.36s;}
@keyframes zcc-pulse{0%,100%{opacity:.3;transform:scale(.7)}50%{opacity:1;transform:scale(1)}}
.zcc-inc-actions{display:flex;gap:20px;justify-content:center;}
.zcc-inc-action{display:flex;flex-direction:column;align-items:center;gap:8px;cursor:pointer;}
.zcc-inc-btn{width:62px;height:62px;border-radius:50%;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .16s;}
.zcc-inc-btn:hover{transform:scale(1.08);}
.zcc-inc-btn.decline{background:#fee2e2;}
.zcc-inc-btn.decline:hover{background:#fecaca;}
.zcc-inc-btn.accept{background:#dcfce7;}
.zcc-inc-btn.accept:hover{background:#bbf7d0;}
.zcc-inc-lbl{font-size:12px;font-weight:600;color:#6b7280;}

.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);}
`;

export default function TeamsStyleCalls({ users }: { users: User[] }) {
  const { user } = useAuth();
  const [view, setView]             = useState<"dial"|"history">("dial");
  const [searchQuery, setSearchQuery] = useState("");
  const [incomingCall, setIncomingCall] = useState<Call|null>(null);
  const [activeCall, setActiveCall]   = useState<Call|null>(null);
  const [callHistory, setCallHistory] = useState<CallHistory[]>([]);
  const [isMuted, setIsMuted]         = useState(false);
  const [isVideoOff, setIsVideoOff]   = useState(false);
  const [callTimer, setCallTimer]     = useState(0);

  const localVidRef  = useRef<HTMLVideoElement>(null);
  const remoteVidRef = useRef<HTMLVideoElement>(null);
  const peerRef      = useRef<RTCPeerConnection|null>(null);
  const streamRef    = useRef<MediaStream|null>(null);
  const timerRef     = useRef<any>(null);
  const iceQueue     = useRef<RTCIceCandidateInit[]>([]);

  const otherCallUser = useMemo(() => {
    if (!activeCall) return null;
    return users.find(u=>u.uid===(activeCall.callerId===user?.uid?activeCall.receiverId:activeCall.callerId))??null;
  },[users,activeCall,user]);

  /* ── call timer ── */
  useEffect(() => {
    if (activeCall?.status==="accepted") {
      setCallTimer(0);
      timerRef.current = setInterval(()=>setCallTimer(p=>p+1),1000);
    } else { clearInterval(timerRef.current); setCallTimer(0); }
    return ()=>clearInterval(timerRef.current);
  },[activeCall?.status]);

  /* ── incoming calls ── */
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db,"calls"),where("receiverId","==",user.uid),where("status","==","ringing"));
    return onSnapshot(q, snap=>snap.forEach(d=>setIncomingCall({id:d.id,...d.data()} as Call)));
  },[user]);

  /* ── call history ── */
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db,"callHistory"),where("participants","array-contains",user.uid));
    return onSnapshot(q, snap=>{
      const h = snap.docs.map(d=>({id:d.id,...d.data()} as CallHistory));
      setCallHistory(h.sort((a,b)=>b.timestamp?.toMillis()-a.timestamp?.toMillis()));
    });
  },[user]);

  /* ── active call updates ── */
  useEffect(() => {
    if (!activeCall) return;
    return onSnapshot(doc(db,"calls",activeCall.id), async snap=>{
      if (!snap.exists()) { endCall(); return; }
      const call = {id:snap.id,...snap.data()} as Call;
      setActiveCall(call);
      if (call.answer&&peerRef.current&&!peerRef.current.remoteDescription) {
        await peerRef.current.setRemoteDescription(new RTCSessionDescription(call.answer));
        iceQueue.current.forEach(c=>peerRef.current?.addIceCandidate(new RTCIceCandidate(c)));
        iceQueue.current=[];
      }
      if (call.status==="ended"||call.status==="rejected") endCall();
    });
  },[activeCall?.id]);

  const initiateCall = async (receiver:User, type:"video"|"audio") => {
    if (!user) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video:type==="video"?{width:1280,height:720}:false,
        audio:{echoCancellation:true,noiseSuppression:true},
      });
      streamRef.current = stream;
      if (localVidRef.current&&type==="video") localVidRef.current.srcObject=stream;
      const pc = new RTCPeerConnection(STUN);
      peerRef.current = pc;
      stream.getTracks().forEach(t=>pc.addTrack(t,stream));
      pc.ontrack = e=>{ if(remoteVidRef.current) remoteVidRef.current.srcObject=e.streams[0]; };
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const callDoc = await addDoc(collection(db,"calls"),{callerId:user.uid,callerName:getUserName(user),receiverId:receiver.uid,type,status:"ringing",offer:{type:offer.type,sdp:offer.sdp},startTime:serverTimestamp()});
      const oc = collection(db,"calls",callDoc.id,"offerCandidates");
      const ac = collection(db,"calls",callDoc.id,"answerCandidates");
      pc.onicecandidate = async e=>{ if(e.candidate) await addDoc(oc,e.candidate.toJSON()); };
      onSnapshot(ac, snap=>snap.docChanges().forEach(ch=>{
        if(ch.type==="added"){
          const d=ch.doc.data();
          if(pc.remoteDescription) pc.addIceCandidate(new RTCIceCandidate(d));
          else iceQueue.current.push(d);
        }
      }));
      setActiveCall({id:callDoc.id,callerId:user.uid,callerName:getUserName(user),receiverId:receiver.uid,type,status:"ringing"});
      pc.onconnectionstatechange=()=>{ if(pc.connectionState==="failed"||pc.connectionState==="disconnected") endCall(); };
    } catch(e) { console.error(e); alert("Could not access camera/mic — check browser permissions."); }
  };

  const acceptCall = async () => {
    if (!incomingCall||!user) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video:incomingCall.type==="video"?{width:1280,height:720}:false,
        audio:{echoCancellation:true,noiseSuppression:true},
      });
      streamRef.current = stream;
      if (localVidRef.current&&incomingCall.type==="video") localVidRef.current.srcObject=stream;
      const pc = new RTCPeerConnection(STUN);
      peerRef.current = pc;
      stream.getTracks().forEach(t=>pc.addTrack(t,stream));
      pc.ontrack = e=>{ if(remoteVidRef.current) remoteVidRef.current.srcObject=e.streams[0]; };
      await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await updateDoc(doc(db,"calls",incomingCall.id),{status:"accepted",answer:{type:answer.type,sdp:answer.sdp}});
      const oc = collection(db,"calls",incomingCall.id,"offerCandidates");
      const ac = collection(db,"calls",incomingCall.id,"answerCandidates");
      pc.onicecandidate = async e=>{ if(e.candidate) await addDoc(ac,e.candidate.toJSON()); };
      onSnapshot(oc, snap=>snap.docChanges().forEach(ch=>{
        if(ch.type==="added"){
          const d=ch.doc.data();
          if(pc.remoteDescription) pc.addIceCandidate(new RTCIceCandidate(d));
          else iceQueue.current.push(d);
        }
      }));
      setActiveCall(incomingCall); setIncomingCall(null);
    } catch(e) { console.error(e); alert("Camera/mic access failed."); rejectCall(); }
  };

  const rejectCall = async () => {
    if (!incomingCall) return;
    await updateDoc(doc(db,"calls",incomingCall.id),{status:"rejected",endTime:serverTimestamp()});
    await addDoc(collection(db,"callHistory"),{callerId:incomingCall.callerId,callerName:incomingCall.callerName,receiverId:incomingCall.receiverId,receiverName:getUserName(user),type:incomingCall.type,status:"rejected",timestamp:serverTimestamp(),participants:[incomingCall.callerId,incomingCall.receiverId]});
    setIncomingCall(null);
  };

  const endCall = async () => {
    streamRef.current?.getTracks().forEach(t=>t.stop());
    peerRef.current?.close();
    if (activeCall) {
      const snap = await getDoc(doc(db,"calls",activeCall.id));
      if (snap.exists()) {
        await updateDoc(doc(db,"calls",activeCall.id),{status:"ended",endTime:serverTimestamp()});
        const startMs = snap.data().startTime?.toMillis();
        const duration = startMs?Math.floor((Date.now()-startMs)/1000):0;
        await addDoc(collection(db,"callHistory"),{callerId:activeCall.callerId,callerName:activeCall.callerName,receiverId:activeCall.receiverId,receiverName:getUserName(users.find(u=>u.uid===activeCall.receiverId)),type:activeCall.type,status:activeCall.status==="accepted"?"completed":"missed",duration,timestamp:serverTimestamp(),participants:[activeCall.callerId,activeCall.receiverId]});
      }
    }
    clearInterval(timerRef.current);
    streamRef.current=null; peerRef.current=null;
    setActiveCall(null); setIsMuted(false); setIsVideoOff(false); setCallTimer(0);
  };

  const fmtTime = (s:number) => {
    const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60;
    return h>0?`${h}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`:`${m}:${String(sec).padStart(2,"0")}`;
  };
  const fmtDur = (s?:number) => {
    if (!s||s===0) return "—";
    return fmtTime(s);
  };

  const filteredUsers = users.filter(u=>u.uid!==user?.uid&&(
    u.name?.toLowerCase().includes(searchQuery.toLowerCase())||
    u.email?.toLowerCase().includes(searchQuery.toLowerCase())
  ));

  return (
    <>
      <style>{CSS}</style>

      {/* ── INCOMING CALL ── */}
      {incomingCall&&(
        <div className="zcc-inc-ov">
          <div className="zcc-inc-card">
            {(() => {
              const c = users.find(u=>u.uid===incomingCall.callerId);
              const[g1,g2]=avGrad(incomingCall.callerName);
              return c?.profilePhoto
                ?<div className="zcc-inc-av"><img src={c.profilePhoto} alt=""/></div>
                :<div className="zcc-inc-av" style={{background:`linear-gradient(135deg,${g1},${g2})`}}>{initials(incomingCall.callerName)}</div>;
            })()}
            <div className="zcc-inc-name">{incomingCall.callerName}</div>
            <div className="zcc-inc-type">Incoming {incomingCall.type==="video"?"📹 Video":"📞 Audio"} call</div>
            <div className="zcc-inc-pulse"><div className="zcc-pulse-dot"/><div className="zcc-pulse-dot"/><div className="zcc-pulse-dot"/></div>
            <div className="zcc-inc-actions">
              <div className="zcc-inc-action" onClick={rejectCall}>
                <button className="zcc-inc-btn decline">
                  <svg width="26" height="26" fill="none" stroke="#ef4444" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z"/></svg>
                </button>
                <span className="zcc-inc-lbl">Decline</span>
              </div>
              <div className="zcc-inc-action" onClick={acceptCall}>
                <button className="zcc-inc-btn accept">
                  <svg width="26" height="26" fill="none" stroke="#16a34a" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                </button>
                <span className="zcc-inc-lbl">Accept</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ACTIVE CALL ── */}
      {activeCall&&(
        <div className="zcc-call-ov">
          <div className="zcc-call-main">
            {activeCall.type==="video"
              ?<video ref={remoteVidRef} autoPlay playsInline className="zcc-remote-vid"/>
              :<div className="zcc-audio-center">
                {otherCallUser?.profilePhoto
                  ?<div className="zcc-audio-av"><img src={otherCallUser.profilePhoto} alt=""/></div>
                  :<div className="zcc-audio-av" style={{background:`linear-gradient(135deg,${avGrad(getUserName(otherCallUser))[0]},${avGrad(getUserName(otherCallUser))[1]})`}}>{initials(getUserName(otherCallUser))}</div>
                }
                <div className="zcc-audio-name">{getUserName(otherCallUser)}</div>
                <div className="zcc-audio-status">{activeCall.status==="ringing"?"Calling…":fmtTime(callTimer)}</div>
              </div>
            }
            {activeCall.type==="video"&&(
              <div className="zcc-local-pip">
                <video ref={localVidRef} autoPlay playsInline muted style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                {isVideoOff&&<div style={{position:"absolute",inset:0,background:"#161b22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,color:"rgba(255,255,255,.4)",fontFamily:"'DM Sans',sans-serif"}}>Camera off</div>}
              </div>
            )}
            {/* hidden audio elements for audio call */}
            {activeCall.type==="audio"&&<video ref={localVidRef} autoPlay playsInline muted style={{display:"none"}}/>}
            {activeCall.type==="audio"&&<video ref={remoteVidRef} autoPlay playsInline style={{display:"none"}}/>}
            <div className="zcc-call-timer">{activeCall.status==="ringing"?"Calling…":fmtTime(callTimer)}</div>
          </div>

          <div className="zcc-call-bar">
            {/* Mute */}
            <button className={`zcc-cb ${isMuted?"active":"neutral"}`} title={isMuted?"Unmute":"Mute"}
              onClick={()=>{ streamRef.current?.getAudioTracks().forEach(t=>t.enabled=!t.enabled); setIsMuted(p=>!p); }}>
              {isMuted
                ?<svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6"/><path d="M17 16.95A7 7 0 015 12v-2m14 0v2a7 7 0 01-.11 1.23M12 19v3M8 23h8"/></svg>
                :<svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/></svg>
              }
            </button>

            {/* Camera toggle (video calls only) */}
            {activeCall.type==="video"&&(
              <button className={`zcc-cb ${isVideoOff?"active":"neutral"}`} title={isVideoOff?"Enable camera":"Disable camera"}
                onClick={()=>{ streamRef.current?.getVideoTracks().forEach(t=>t.enabled=!t.enabled); setIsVideoOff(p=>!p); }}>
                {isVideoOff
                  ?<svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M16 16l4.553 2.276A1 1 0 0022 17.382v-6.764a1 1 0 00-1.447-.894L16 12"/><rect x="2" y="6" width="14" height="12" rx="2"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  :<svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                }
              </button>
            )}

            {/* End call */}
            <button className="zcc-cb red" title="End call" onClick={endCall}>
              <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><path d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z"/></svg>
            </button>
          </div>
        </div>
      )}

      {/* ── NORMAL UI ── */}
      <div className="zcc">
        {/* Left panel */}
        <div className="zcc-panel">
          <div className="zcc-panel-hd">
            <div className="zcc-title">Calls</div>
            <div className="zcc-tabs">
              <button className={`zcc-tab${view==="dial"?" on":""}`} onClick={()=>setView("dial")}>Make a Call</button>
              <button className={`zcc-tab${view==="history"?" on":""}`} onClick={()=>setView("history")}>History {callHistory.length>0&&`(${callHistory.length})`}</button>
            </div>
            {view==="dial"&&(
              <div className="zcc-search-wrap">
                <svg className="zcc-search-ico" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                <input className="zcc-search" placeholder="Search contacts" value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}/>
              </div>
            )}
          </div>

          <div className="zcc-list">
            {view==="dial"&&(
              filteredUsers.length===0
                ?<div style={{padding:"32px 12px",textAlign:"center",fontSize:13,color:"#9aa0ad"}}>No contacts found</div>
                :filteredUsers.map(u=>{
                  const[g1,g2]=avGrad(getUserName(u));
                  return(
                    <div key={u.uid} className="zcc-contact">
                      <div style={{position:"relative",flexShrink:0}}>
                        <div className="zcc-av" style={{background:`linear-gradient(135deg,${g1},${g2})`}}>
                          {u.profilePhoto?<img src={u.profilePhoto} alt=""/>:initials(getUserName(u))}
                        </div>
                        {u.online&&<div className="zcc-online-dot"/>}
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div className="zcc-contact-name">{u.name||u.email}</div>
                        <div className="zcc-contact-sub">{u.online?"● Online":"○ Offline"}</div>
                      </div>
                      <div className="zcc-call-btns">
                        <button className="zcc-cta video" title="Video call" onClick={()=>initiateCall(u,"video")}>
                          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                        </button>
                        <button className="zcc-cta audio" title="Audio call" onClick={()=>initiateCall(u,"audio")}>
                          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                        </button>
                      </div>
                    </div>
                  );
                })
            )}

            {view==="history"&&(
              callHistory.length===0
                ?<div style={{padding:"32px 12px",textAlign:"center",fontSize:13,color:"#9aa0ad"}}>No call history yet</div>
                :callHistory.map(c=>{
                  const isOut = c.callerId===user?.uid;
                  const other = isOut?c.receiverName:c.callerName;
                  const hu = users.find(u=>u.name===other||u.email===other);
                  const[g1,g2]=avGrad(other);
                  const statusColor = c.status==="completed"?"#22c55e":c.status==="missed"?"#ef4444":"#f59e0b";
                  return(
                    <div key={c.id} className="zcc-hist-item">
                      <div className="zcc-av" style={{background:`linear-gradient(135deg,${g1},${g2})`}}>
                        {hu?.profilePhoto?<img src={hu.profilePhoto} alt=""/>:initials(other)}
                      </div>
                      <div className="zcc-hist-info">
                        <div className="zcc-hist-name">{other}</div>
                        <div className="zcc-hist-sub">
                          <div className="zcc-hist-status-dot" style={{background:statusColor}}/>
                          <span style={{color:c.status==="missed"?"#ef4444":"inherit"}}>{c.status==="completed"?fmtDur(c.duration):c.status==="missed"?"Missed":"Declined"}</span>
                          <span>·</span>
                          <span>{c.type==="video"?"📹":"📞"}</span>
                          <span>·</span>
                          <span>{isOut?"Outgoing":"Incoming"}</span>
                        </div>
                      </div>
                      <div className="zcc-hist-time">
                        <div>{c.timestamp?.toDate?.()?.toLocaleDateString([],{month:"short",day:"numeric"})}</div>
                        <div>{c.timestamp?.toDate?.()?.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</div>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>

        {/* Right panel */}
        <div className="zcc-right">
          <div className="zcc-right-card">
            <div className="zcc-right-ico">{view==="dial"?"📞":"🕐"}</div>
            <div style={{fontSize:18,fontWeight:700,color:"#1a1d23",marginBottom:8,fontFamily:"'DM Sans',sans-serif"}}>
              {view==="dial"?"Start a call":"Call History"}
            </div>
            <div style={{fontSize:13,color:"#9aa0ad",lineHeight:1.6,fontFamily:"'DM Sans',sans-serif"}}>
              {view==="dial"
                ?"Hover over a contact and click the video 📹 or audio 📞 button to start a free call via WebRTC — no paid service needed."
                :"Your recent calls with duration, type, and status will appear here."
              }
            </div>
            {view==="dial"&&(
              <div style={{display:"flex",gap:10,justifyContent:"center",marginTop:20,flexWrap:"wrap"}}>
                <div style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:"#6b7280",background:"#fff",padding:"6px 12px",borderRadius:20,boxShadow:"0 1px 4px rgba(0,0,0,.06)"}}>
                  <div style={{width:8,height:8,borderRadius:"50%",background:"#22c55e"}}/>Free via WebRTC
                </div>
                <div style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:"#6b7280",background:"#fff",padding:"6px 12px",borderRadius:20,boxShadow:"0 1px 4px rgba(0,0,0,.06)"}}>
                  🔒 Peer-to-peer
                </div>
                <div style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:"#6b7280",background:"#fff",padding:"6px 12px",borderRadius:20,boxShadow:"0 1px 4px rgba(0,0,0,.06)"}}>
                  📹 Video + Audio
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}