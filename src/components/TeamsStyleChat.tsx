"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  collection, addDoc, onSnapshot, orderBy, query,
  where, serverTimestamp, doc, setDoc, updateDoc,
  deleteDoc, writeBatch, getDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

type User = {
  uid: string; name?: string|null; email: string|null;
  profilePhoto?: string; avatar?: string;
  online?: boolean; status?: "available"|"busy"|"dnd"|"brb"|"away"|"offline"|"lunch";
};
type Message = {
  id: string; text?: string; imageUrl?: string; fileUrl?: string;
  fileName?: string; fileType?: string; senderUid: string; senderName?: string;
  status?: "sent"|"delivered"|"seen"; createdAt: any; readBy?: string[];
  editedAt?: any; isEdited?: boolean;
};
type Chat = {
  id: string; participants: string[]; lastMessage?: string;
  lastMessageTime?: any; unreadCount?: {[uid:string]:number};
  isGroup?: boolean; groupName?: string; groupAvatar?: string;
  createdBy?: string; createdAt?: any;
  admins?: string[]; // ✅ NEW
};
type Call = {
  id: string; callerId: string; callerName: string; receiverId: string;
  type: "video"|"audio"; status: "ringing"|"accepted"|"rejected"|"ended";
  offer?: any; answer?: any; startTime?: any; endTime?: any;
};

type UserStatus = "available"|"busy"|"dnd"|"brb"|"away"|"offline"|"lunch";

const getUserName = (u?: Partial<User>|null) => u?.name ?? u?.email ?? "User";

const STATUS_CONFIG: Record<UserStatus,{label:string;color:string}> = {
  available: { label:"Available",       color:"#22c55e" },
  busy:      { label:"Busy",            color:"#ef4444" },
  dnd:       { label:"Do not disturb",  color:"#ef4444" },
  brb:       { label:"Be right back",   color:"#f59e0b" },
  away:      { label:"Appear away",     color:"#f59e0b" },
  lunch:     { label:"Out for lunch",   color:"#a855f7" },
  offline:   { label:"Appear offline",  color:"#9ca3af" },
};

const COLORS = [
  ["#e8512a","#f5853f"],["#7c3aed","#a78bfa"],["#0891b2","#22d3ee"],
  ["#059669","#34d399"],["#db2777","#f472b6"],["#1d4ed8","#60a5fa"],
  ["#d97706","#fbbf24"],["#0f766e","#2dd4bf"],
];
const avGrad   = (n:string) => COLORS[(n?.charCodeAt(0)??65)%COLORS.length];
const initials = (n:string) => (n??"").split(" ").slice(0,2).map(w=>w[0]?.toUpperCase()??"").join("");

// ── ICE / TURN config ─────────────────────────────────────────────────────────
const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    {
      urls: "turn:global.relay.metered.ca:80",
      username: "12806757bb1fc0f96b5f0f13",
      credential: "MZ14/Tt0GfozoWP4",
    },
    {
      urls: "turn:global.relay.metered.ca:443",
      username: "12806757bb1fc0f96b5f0f13",
      credential: "MZ14/Tt0GfozoWP4",
    },
  ],
};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
.zc{font-family:'DM Sans',sans-serif;display:flex;height:100%;background:#f0f2f5;color:#1a1d23;overflow:hidden;}
.zc-sb{width:68px;background:#1e2230;display:flex;flex-direction:column;align-items:center;padding:14px 0 10px;gap:2px;flex-shrink:0;}
.zc-sb-logo{width:38px;height:38px;background:linear-gradient(135deg,#e8512a,#f5853f);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:900;color:#fff;margin-bottom:12px;letter-spacing:-.3px;}
.zc-sb-ico{width:44px;height:44px;border-radius:10px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .15s;color:rgba(255,255,255,.38);position:relative;flex-shrink:0;}
.zc-sb-ico:hover{background:rgba(255,255,255,.07);color:rgba(255,255,255,.75);}
.zc-sb-ico.on{background:rgba(232,81,42,.16);color:#e8512a;}
.zc-sb-ico.on::before{content:'';position:absolute;left:0;top:50%;transform:translateY(-50%);width:3px;height:56%;border-radius:0 2px 2px 0;background:#e8512a;}
.zc-sb-badge{position:absolute;top:5px;right:5px;min-width:16px;height:16px;border-radius:8px;background:#e8512a;border:2px solid #1e2230;font-size:9px;font-weight:800;color:#fff;display:flex;align-items:center;justify-content:center;padding:0 2px;}
.zc-sb-spacer{flex:1;}
.zc-sb-av-wrap{position:relative;cursor:pointer;margin-top:8px;}
.zc-sb-av{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:12px;overflow:hidden;}
.zc-sb-av img{width:100%;height:100%;object-fit:cover;}
.zc-sb-status{width:11px;height:11px;border-radius:50%;border:2px solid #1e2230;position:absolute;bottom:-1px;right:-1px;}
.zc-panel{width:292px;background:#fff;border-right:1px solid #e8eaf0;display:flex;flex-direction:column;flex-shrink:0;}
.zc-panel-hd{padding:14px 14px 10px;}
.zc-panel-title-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;}
.zc-panel-title{font-size:15px;font-weight:700;color:#1a1d23;}
.zc-icon-btn{width:30px;height:30px;border-radius:7px;border:none;background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#6b7280;transition:all .13s;}
.zc-icon-btn:hover{background:#f5f6f8;color:#1a1d23;}
.zc-search-wrap{position:relative;margin-bottom:10px;}
.zc-search-ico{position:absolute;left:9px;top:50%;transform:translateY(-50%);color:#9aa0ad;pointer-events:none;}
.zc-search{width:100%;padding:7px 10px 7px 30px;background:#f5f6f8;border:1.5px solid transparent;border-radius:8px;font-size:13px;font-family:'DM Sans',sans-serif;outline:none;color:#1a1d23;transition:all .15s;}
.zc-search:focus{background:#fff;border-color:#e8512a;}
.zc-tabs{display:flex;gap:3px;}
.zc-tab{flex:1;padding:5px 6px;border-radius:7px;font-size:11.5px;font-weight:600;cursor:pointer;border:none;background:transparent;color:#9aa0ad;transition:all .14s;font-family:'DM Sans',sans-serif;}
.zc-tab:hover{background:#f5f6f8;color:#1a1d23;}
.zc-tab.on{background:#fff3ef;color:#e8512a;}
.zc-chat-list{flex:1;overflow-y:auto;}
.zc-chat-list::-webkit-scrollbar{width:3px;}
.zc-chat-list::-webkit-scrollbar-thumb{background:#e8eaf0;border-radius:3px;}
.zc-group-divider{display:flex;align-items:center;gap:7px;padding:8px 14px 4px;cursor:pointer;user-select:none;transition:background .12s;}
.zc-group-divider:hover{background:#f9fafb;}
.zc-group-label{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;flex:1;}
.zc-group-count{font-size:10px;font-weight:700;padding:1px 6px;border-radius:10px;}
.zc-group-arrow{font-size:8px;color:#9aa0ad;transition:transform .18s;}
.zc-group-arrow.open{transform:rotate(90deg);}
.zc-chat-item{display:flex;align-items:center;gap:10px;padding:8px 14px;cursor:pointer;transition:background .12s;position:relative;border-left:3px solid transparent;}
.zc-chat-item:hover{background:#f8f9fb;}
.zc-chat-item.on{background:#fff3ef;border-left-color:#e8512a;}
.zc-av{display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;flex-shrink:0;overflow:hidden;position:relative;}
.zc-av img{width:100%;height:100%;object-fit:cover;}
.zc-sdot{border-radius:50%;border:2px solid #fff;position:absolute;bottom:-2px;right:-2px;}
.zc-chat-meta{flex:1;min-width:0;}
.zc-chat-name{font-size:13px;font-weight:600;color:#1a1d23;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:flex;align-items:center;gap:4px;}
.zc-chat-preview{font-size:11.5px;color:#9aa0ad;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:1px;}
.zc-unread{min-width:18px;height:18px;border-radius:9px;background:#e8512a;color:#fff;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;padding:0 4px;flex-shrink:0;}
.zc-main{flex:1;display:flex;flex-direction:column;min-width:0;overflow:hidden;background:#f0f2f5;}
.zc-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#9aa0ad;gap:12px;}
.zc-empty-ico{width:72px;height:72px;border-radius:20px;background:#fff;display:flex;align-items:center;justify-content:center;font-size:32px;box-shadow:0 4px 16px rgba(0,0,0,.08);}
.zc-conv-hd{height:56px;background:#fff;border-bottom:1px solid #e8eaf0;padding:0 14px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;}
.zc-conv-hd-left{display:flex;align-items:center;gap:9px;}
.zc-conv-name{font-size:14px;font-weight:700;color:#1a1d23;}
.zc-conv-sub{font-size:11.5px;color:#9aa0ad;margin-top:1px;}
.zc-hd-btn{width:32px;height:32px;border-radius:8px;background:transparent;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#6b7280;transition:all .14s;position:relative;}
.zc-hd-btn:hover{background:#f5f6f8;color:#1a1d23;}
.zc-msgs{flex:1;overflow-y:auto;padding:14px 20px;display:flex;flex-direction:column;gap:2px;}
.zc-msgs::-webkit-scrollbar{width:4px;}
.zc-msgs::-webkit-scrollbar-thumb{background:#d1d5db;border-radius:4px;}
.zc-sys-msg{text-align:center;margin:10px 0;}
.zc-sys-pill{display:inline-block;background:#e8eaf0;color:#6b7280;font-size:11px;font-weight:600;padding:3px 12px;border-radius:20px;}
.zc-msg-row{display:flex;gap:8px;margin-bottom:2px;}
.zc-msg-row.mine{flex-direction:row-reverse;}
.zc-msg-av-ph{width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff;}
.zc-msg-content{max-width:68%;display:flex;flex-direction:column;}
.zc-msg-sender{font-size:10.5px;font-weight:600;color:#6b7280;margin-bottom:2px;padding:0 4px;}
.zc-bubble{padding:9px 13px;border-radius:12px;font-size:13.5px;line-height:1.55;word-break:break-word;position:relative;}
.zc-bubble.them{background:#fff;color:#1a1d23;border-radius:4px 12px 12px 12px;box-shadow:0 1px 3px rgba(0,0,0,.07);}
.zc-bubble.mine{background:#e8512a;color:#fff;border-radius:12px 4px 12px 12px;}
.zc-bfile{display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:10px;text-decoration:none;}
.zc-bfile.them{background:#f5f6f8;color:#1a1d23;}
.zc-bfile.mine{background:rgba(0,0,0,.15);color:#fff;}
.zc-msg-meta{display:flex;align-items:center;gap:4px;margin-top:3px;padding:0 4px;}
.zc-msg-time{font-size:10.5px;color:#9aa0ad;}
.zc-msg-actions{opacity:0;position:absolute;top:-30px;right:0;display:flex;gap:3px;background:#fff;border:1px solid #e8eaf0;border-radius:7px;padding:3px 5px;box-shadow:0 2px 10px rgba(0,0,0,.12);z-index:10;}
.zc-bubble:hover .zc-msg-actions{opacity:1;}
.zc-act-btn{width:22px;height:22px;border-radius:5px;border:none;background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#6b7280;transition:all .13s;}
.zc-act-btn:hover{background:#f5f6f8;color:#e8512a;}
.zc-edit-wrap{background:#fff;border:1px solid #e8eaf0;border-radius:10px;padding:10px;box-shadow:0 2px 8px rgba(0,0,0,.07);}
.zc-edit-ta{width:100%;padding:7px 10px;border:1.5px solid #e8eaf0;border-radius:7px;font-size:13px;font-family:'DM Sans',sans-serif;outline:none;resize:none;color:#1a1d23;min-height:60px;transition:border-color .14s;}
.zc-edit-ta:focus{border-color:#e8512a;}
.zc-edit-btns{display:flex;gap:6px;margin-top:7px;justify-content:flex-end;}
.zc-input-area{background:#fff;border-top:1px solid #e8eaf0;padding:10px 14px 12px;}
.zc-file-prev{display:flex;align-items:center;gap:8px;padding:6px 10px;background:#f5f6f8;border-radius:8px;margin-bottom:8px;font-size:12.5px;color:#1a1d23;}
.zc-input-row{display:flex;align-items:flex-end;gap:8px;}
.zc-input-box{flex:1;padding:9px 13px;background:#f5f6f8;border:1.5px solid transparent;border-radius:10px;font-size:13.5px;font-family:'DM Sans',sans-serif;outline:none;resize:none;min-height:40px;max-height:120px;color:#1a1d23;transition:all .15s;}
.zc-input-box:focus{background:#fff;border-color:#e8512a;}
.zc-input-box::placeholder{color:#b0b7c3;}
.zc-inp-btn{width:36px;height:36px;border-radius:9px;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s;flex-shrink:0;}
.zc-inp-btn.attach{background:#f5f6f8;color:#6b7280;}
.zc-inp-btn.attach:hover{background:#e8eaf0;color:#1a1d23;}
.zc-inp-btn.send{background:#e8512a;color:#fff;}
.zc-inp-btn.send:hover:not(:disabled){background:#d04420;}
.zc-inp-btn.send:disabled{background:#e8eaf0;color:#b0b7c3;cursor:not-allowed;}
.zc-dd{position:fixed;background:#fff;border:1px solid #e8eaf0;border-radius:13px;box-shadow:0 8px 32px rgba(0,0,0,.13);z-index:9000;overflow:hidden;animation:zcpop .16s cubic-bezier(.34,1.4,.64,1);}
@keyframes zcpop{from{opacity:0;transform:scale(.94) translateY(-4px)}to{opacity:1;transform:none}}
.zc-prof-hd{padding:14px;border-bottom:1px solid #f0f2f5;display:flex;align-items:center;gap:10px;}
.zc-prof-name{font-size:13.5px;font-weight:700;color:#1a1d23;}
.zc-prof-email{font-size:11.5px;color:#6b7280;margin-top:1px;}
.zc-prof-link{font-size:11.5px;color:#e8512a;font-weight:600;cursor:pointer;margin-top:3px;}
.zc-ds{padding:5px 0;}
.zc-ds+.zc-ds{border-top:1px solid #f0f2f5;}
.zc-di{display:flex;align-items:center;gap:10px;padding:9px 14px;cursor:pointer;transition:background .12s;font-size:13px;color:#1a1d23;font-weight:500;}
.zc-di:hover{background:#f8f9fb;}
.zc-di.act{background:#fff3ef;}
.zc-di.red{color:#ef4444;}
.zc-di.red:hover{background:#fff1f2;}
.zc-sdot2{width:10px;height:10px;border-radius:50%;flex-shrink:0;}
.zc-dtitle{padding:10px 14px 4px;font-size:10.5px;font-weight:700;color:#9aa0ad;text-transform:uppercase;letter-spacing:.5px;}
.zc-notif-hd{padding:12px 14px;border-bottom:1px solid #f0f2f5;display:flex;align-items:center;justify-content:space-between;}
.zc-notif-body{max-height:300px;overflow-y:auto;}
.zc-notif-body::-webkit-scrollbar{width:3px;}
.zc-notif-body::-webkit-scrollbar-thumb{background:#e8eaf0;border-radius:3px;}
.zc-ni{display:flex;align-items:flex-start;gap:9px;padding:10px 14px;border-bottom:1px solid #f9fafb;cursor:pointer;transition:background .12s;}
.zc-ni:hover{background:#f8f9fb;}

/* ── Active call overlay ── */
.zc-call-ov{position:fixed;inset:0;background:#0d1117;z-index:9999;display:flex;flex-direction:column;}
.zc-call-main{flex:1;position:relative;background:#161b22;display:flex;align-items:center;justify-content:center;}
.zc-call-audio-center{display:flex;flex-direction:column;align-items:center;gap:12px;}
.zc-call-badge{position:absolute;top:16px;left:16px;background:rgba(0,0,0,.5);backdrop-filter:blur(8px);border-radius:10px;padding:8px 16px;color:#fff;font-size:14px;font-weight:600;}
.zc-call-bar{background:#1a1d23;padding:20px;display:flex;justify-content:center;gap:14px;flex-shrink:0;}
.zc-cbtn{width:54px;height:54px;border-radius:50%;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .18s;}
.zc-cbtn:hover{transform:scale(1.08);}
.zc-cbtn.neu{background:#2d333b;color:#fff;}
.zc-cbtn.neu:hover{background:#373e47;}
.zc-cbtn.end{background:#e8512a;color:#fff;}
.zc-cbtn.act{background:#dc2626;color:#fff;}

/* ── Incoming call ── */
.zc-incoming{position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(6px);}
.zc-inc-card{background:#fff;border-radius:20px;padding:32px 36px;text-align:center;width:320px;box-shadow:0 24px 64px rgba(0,0,0,.24);}
.zc-inc-av{width:80px;height:80px;border-radius:20px;margin:0 auto 12px;display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:800;color:#fff;overflow:hidden;}
.zc-inc-av img{width:100%;height:100%;object-fit:cover;}
.zc-inc-dots{display:flex;gap:5px;justify-content:center;margin:12px 0 24px;}
.zc-inc-dot{width:7px;height:7px;border-radius:50%;background:#e8512a;animation:zc-bounce .8s infinite;}
.zc-inc-dot:nth-child(2){animation-delay:.15s;}
.zc-inc-dot:nth-child(3){animation-delay:.3s;}
@keyframes zc-bounce{0%,80%,100%{transform:scale(.6)}40%{transform:scale(1)}}
.zc-inc-btns{display:flex;gap:14px;justify-content:center;}
.zc-inc-btn{width:58px;height:58px;border-radius:50%;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .16s;}
.zc-inc-btn:hover{transform:scale(1.1);}
.zc-inc-btn.rej{background:#fee2e2;}
.zc-inc-btn.rej:hover{background:#fecaca;}
.zc-inc-btn.acc{background:#dcfce7;}
.zc-inc-btn.acc:hover{background:#bbf7d0;}
.zc-mbk{position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:500;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);}
.zc-modal{background:#fff;border-radius:16px;width:400px;max-width:94vw;max-height:88vh;overflow-y:auto;padding:22px;box-shadow:0 20px 60px rgba(0,0,0,.18);}
.zc-mlbl{font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px;margin-top:12px;}
.zc-mi{width:100%;padding:8px 11px;border:1.5px solid #e8eaf0;border-radius:8px;font-size:13.5px;font-family:'DM Sans',sans-serif;outline:none;color:#1a1d23;transition:border-color .14s;background:#f9fafb;}
.zc-mi:focus{border-color:#e8512a;background:#fff;}
.zc-mlist{max-height:200px;overflow-y:auto;border:1.5px solid #e8eaf0;border-radius:8px;}
.zc-mitm{display:flex;align-items:center;gap:9px;padding:8px 11px;cursor:pointer;transition:background .12s;border-bottom:1px solid #f0f2f5;}
.zc-mitm:last-child{border-bottom:none;}
.zc-mitm:hover{background:#f9fafb;}
.zc-mitm.sel{background:#fff3ef;}
.zc-chk{width:15px;height:15px;border-radius:4px;border:2px solid #d1d5db;display:flex;align-items:center;justify-content:center;transition:all .12px;flex-shrink:0;}
.zc-chk.on{background:#e8512a;border-color:#e8512a;}
.zc-mfooter{display:flex;gap:7px;margin-top:16px;justify-content:flex-end;}
.zc-btn{padding:7px 18px;border-radius:8px;font-size:13px;font-weight:600;font-family:'DM Sans',sans-serif;border:none;cursor:pointer;transition:all .14s;}
.zc-btn.ghost{background:#f5f6f8;color:#6b7280;}
.zc-btn.ghost:hover{background:#e8eaf0;}
.zc-btn.primary{background:#e8512a;color:#fff;}
.zc-btn.primary:hover{background:#d04420;}
.zc-btn.primary:disabled{background:#e8eaf0;color:#b0b7c3;cursor:not-allowed;}
.zc-btn.danger{background:#fee2e2;color:#ef4444;}
.zc-btn.danger:hover{background:#fecaca;}
.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);}

/* ── Group Settings Modal extras ── */
.zc-gs-member{display:flex;align-items:center;gap:9px;padding:8px 11px;border-bottom:1px solid #f0f2f5;background:#fff;}
.zc-gs-member:last-child{border-bottom:none;}
.zc-gs-mbtn{padding:3px 8px;border-radius:5px;font-size:11px;font-weight:600;border:1.5px solid;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all .12s;}
.zc-gs-mbtn.admin{border-color:#f59e0b;color:#f59e0b;background:transparent;}
.zc-gs-mbtn.admin:hover{background:#fef3c7;}
.zc-gs-mbtn.remove{border-color:#ef4444;color:#ef4444;background:transparent;}
.zc-gs-mbtn.remove:hover{background:#fee2e2;}
.zc-gs-add-list{max-height:140px;overflow-y:auto;border:1.5px solid #e8eaf0;border-radius:8px;}
.zc-gs-add-item{display:flex;align-items:center;gap:9px;padding:7px 11px;cursor:pointer;transition:background .12s;border-bottom:1px solid #f0f2f5;font-size:13px;}
.zc-gs-add-item:last-child{border-bottom:none;}
.zc-gs-add-item:hover{background:#f0fdf4;}
.zc-gs-add-item span{flex:1;font-weight:500;color:#1a1d23;}
.zc-gs-avatar-btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:8px;border:1.5px dashed #d1d5db;border-radius:8px;background:#f9fafb;cursor:pointer;font-size:12.5px;color:#6b7280;font-family:'DM Sans',sans-serif;font-weight:600;transition:all .14s;margin-top:8px;}
.zc-gs-avatar-btn:hover{border-color:#e8512a;color:#e8512a;background:#fff3ef;}
`;

export default function TeamsStyleChat({ users }: { users: User[] }) {
  const { user } = useAuth();
  const [tab,setTab]                   = useState<"chats"|"calls">("chats");
  const [activeTab,setActiveTab]       = useState<"all"|"direct"|"groups">("all");
  const [selectedChat,setSelectedChat] = useState<Chat|null>(null);
  const [messages,setMessages]         = useState<Message[]>([]);
  const [text,setText]                 = useState("");
  const [typing,setTyping]             = useState<string[]>([]);
  const [searchQuery,setSearchQuery]   = useState("");
  const [chats,setChats]               = useState<Chat[]>([]);
  const [showCreateGroup,setShowCreateGroup] = useState(false);
  const [groupName,setGroupName]       = useState("");
  const [selectedMembers,setSelectedMembers] = useState<string[]>([]);
  const [notifications,setNotifications]     = useState<any[]>([]);
  const [showDots,setShowDots]         = useState(false);
  const [myStatus,setMyStatus]         = useState<UserStatus>("available");
  const [collapsedGroups,setCollapsedGroups] = useState<Set<string>>(new Set());
  const [editingMsgId,setEditingMsgId] = useState<string|null>(null);
  const [editText,setEditText]         = useState("");
  const [selectedFile,setSelectedFile] = useState<File|null>(null);
  const [uploading,setUploading]       = useState(false);
  const [incomingCall,setIncomingCall] = useState<Call|null>(null);
  const [activeCall,setActiveCall]     = useState<Call|null>(null);
  const [isMuted,setIsMuted]           = useState(false);
  const [isVideoOff,setIsVideoOff]     = useState(false);
  const [callTimer,setCallTimer]       = useState(0);
  const [userStatuses,setUserStatuses] = useState<Record<string,{status:UserStatus;online:boolean}>>({});

  // ── NEW: Group Settings state ─────────────────────────────────────────────
  const [showGroupSettings,setShowGroupSettings] = useState(false);
  const [groupData,setGroupData]       = useState<any>(null);
  const avatarFileRef                  = useRef<HTMLInputElement>(null);

  const msgsEnd   = useRef<HTMLDivElement>(null);
  const typingRef = useRef<any>(null);
  const peerRef   = useRef<RTCPeerConnection|null>(null);
  const streamRef = useRef<MediaStream|null>(null);
  const timerRef  = useRef<any>(null);
  const fileRef   = useRef<HTMLInputElement>(null);
  const iceQueue  = useRef<RTCIceCandidateInit[]>([]);
  const dotsRef   = useRef<HTMLDivElement>(null);

  const localVideoRef  = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localAudioRef  = useRef<HTMLAudioElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const callTypeRef    = useRef<"video"|"audio">("audio");

  const chatId = useMemo(()=>selectedChat?.id||null,[selectedChat]);

  // ── Derived admin check ───────────────────────────────────────────────────
  const isAdmin = groupData?.admins?.includes(user?.uid);

  // ── Ringtone helpers ──────────────────────────────────────────────────────
  const ringCtxRef  = useRef<AudioContext|null>(null);
  const ringLoopRef = useRef<ReturnType<typeof setInterval>|null>(null);

  useEffect(()=>{
    const unlock = () => {
      if(!ringCtxRef.current){
        ringCtxRef.current = new (window.AudioContext||(window as any).webkitAudioContext)();
      }
      if(ringCtxRef.current.state==="suspended") ringCtxRef.current.resume().catch(()=>{});
      document.removeEventListener("click", unlock);
      document.removeEventListener("keydown", unlock);
      document.removeEventListener("touchstart", unlock);
    };
    document.addEventListener("click", unlock);
    document.addEventListener("keydown", unlock);
    document.addEventListener("touchstart", unlock);
    return()=>{
      document.removeEventListener("click", unlock);
      document.removeEventListener("keydown", unlock);
      document.removeEventListener("touchstart", unlock);
    };
  },[]);

  const stopRing = () => {
    if(ringLoopRef.current){clearInterval(ringLoopRef.current);ringLoopRef.current=null;}
  };

  const playRingCycle = (ctx: AudioContext) => {
    if(ctx.state==="suspended") ctx.resume().catch(()=>{});
    const now = ctx.currentTime;
    [[0, 0.4],[0.5, 0.9]].forEach(([start, end])=>{
      [440, 480].forEach(freq=>{
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = "sine"; osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, now + start);
        gain.gain.linearRampToValueAtTime(0.3, now + start + 0.02);
        gain.gain.setValueAtTime(0.3, now + end - 0.02);
        gain.gain.linearRampToValueAtTime(0, now + end);
        osc.start(now + start); osc.stop(now + end);
      });
    });
  };

  const startRing = () => {
    stopRing();
    try {
      if(!ringCtxRef.current)
        ringCtxRef.current = new (window.AudioContext||(window as any).webkitAudioContext)();
      const ctx = ringCtxRef.current;
      const doPlay = () => playRingCycle(ctx);
      ctx.resume().then(doPlay).catch(doPlay);
      ringLoopRef.current = setInterval(()=>{
        if(ringCtxRef.current) playRingCycle(ringCtxRef.current);
      }, 3000);
    } catch(e){ /* AudioContext unavailable */ }
  };

  useEffect(()=>{
    if(incomingCall){ startRing(); } else { stopRing(); }
    return()=>stopRing();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[!!incomingCall]);

  useEffect(()=>{
    if(activeCall?.status==="ringing"&&activeCall.callerId===user?.uid){ startRing(); }
    else { stopRing(); }
    return()=>stopRing();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[activeCall?.status]);

  useEffect(()=>{
    const h=(e:MouseEvent)=>{
      if(dotsRef.current&&!dotsRef.current.contains(e.target as Node)) setShowDots(false);
    };
    document.addEventListener("mousedown",h);
    return()=>document.removeEventListener("mousedown",h);
  },[]);

  useEffect(()=>{
    if(!user)return;
    const upd=()=>setDoc(doc(db,"userStatus",user.uid),{online:true,status:myStatus,lastSeen:serverTimestamp()},{merge:true});
    upd(); const iv=setInterval(upd,30000);
    return()=>{clearInterval(iv);setDoc(doc(db,"userStatus",user.uid),{online:false,lastSeen:serverTimestamp()},{merge:true});};
  },[user,myStatus]);

  useEffect(()=>{
    const subs=users.map(u=>onSnapshot(doc(db,"userStatus",u.uid),snap=>{
      if(snap.exists()) setUserStatuses(p=>({...p,[u.uid]:{status:snap.data().status||"offline",online:snap.data().online||false}}));
    }));
    return()=>subs.forEach(s=>s());
  },[users]);

  useEffect(()=>{
    if(!user)return;
    const q=query(collection(db,"notifications"),where("toUid","==",user.uid),where("read","==",false),orderBy("timestamp","desc"));
    return onSnapshot(q,snap=>setNotifications(snap.docs.map(d=>({id:d.id,...d.data()}))));
  },[user]);

  useEffect(()=>{
    if(activeCall?.status==="accepted"){
      setCallTimer(0); timerRef.current=setInterval(()=>setCallTimer(p=>p+1),1000);
    } else { clearInterval(timerRef.current); setCallTimer(0); }
    return()=>clearInterval(timerRef.current);
  },[activeCall?.status]);

  useEffect(()=>{
    if(!user)return;
    const q=query(collection(db,"calls"),where("receiverId","==",user.uid),where("status","==","ringing"));
    return onSnapshot(q,snap=>snap.forEach(d=>setIncomingCall({id:d.id,...d.data()} as Call)));
  },[user]);

  useEffect(()=>{
    if(!activeCall?.id)return;
    return onSnapshot(doc(db,"calls",activeCall.id),async snap=>{
      if(!snap.exists()){endCall();return;}
      const call={id:snap.id,...snap.data()} as Call;
      if(call.answer&&peerRef.current&&!peerRef.current.remoteDescription){
        await peerRef.current.setRemoteDescription(new RTCSessionDescription(call.answer));
        for(const c of iceQueue.current)
          await peerRef.current.addIceCandidate(new RTCIceCandidate(c)).catch(console.error);
        iceQueue.current=[];
      }
      if(call.status==="ended"||call.status==="rejected"){ endCall(); return; }
      setActiveCall(prev=>{
        if(!prev) return call;
        if(prev.status!==call.status||prev.answer!==call.answer) return call;
        return prev;
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[activeCall?.id]);

  useEffect(()=>{msgsEnd.current?.scrollIntoView({behavior:"smooth"});},[messages]);

  useEffect(()=>{
    if(!user)return;
    const init=users.filter(u=>u.uid!==user.uid).map(u=>{
      const id=[user.uid,u.uid].sort().join("_");
      return{id,participants:[user.uid,u.uid],unreadCount:{[user.uid]:0},isGroup:false} as Chat;
    });
    setChats(init);
    const subs:(()=>void)[]=[];
    users.forEach(u=>{
      if(u.uid===user.uid)return;
      const id=[user.uid,u.uid].sort().join("_");
      subs.push(onSnapshot(query(collection(db,"chats",id,"messages"),orderBy("createdAt","desc")),snap=>{
        const unread=snap.docs.filter(d=>{const dd=d.data();return dd.senderUid!==user.uid&&(!dd.readBy||!dd.readBy.includes(user.uid));}).length;
        const last=snap.docs[0]?.data();
        setChats(prev=>prev.map(c=>c.id===id?{...c,unreadCount:{...c.unreadCount,[user.uid]:unread},lastMessage:last?.text||last?.fileName||"File",lastMessageTime:last?.createdAt}:c));
      }));
    });
    const gu=onSnapshot(query(collection(db,"groupChats"),where("participants","array-contains",user.uid)),snap=>{
      snap.forEach(gDoc=>{
        const gd=gDoc.data();
        subs.push(onSnapshot(query(collection(db,"groupChats",gDoc.id,"messages"),orderBy("createdAt","desc")),mSnap=>{
          const unread=mSnap.docs.filter(d=>{const dd=d.data();return dd.senderUid!==user.uid&&(!dd.readBy||!dd.readBy.includes(user.uid));}).length;
          const last=mSnap.docs[0]?.data();
          setChats(prev=>{
            const ex=prev.find(c=>c.id===gDoc.id);
            if(ex) return prev.map(c=>c.id===gDoc.id?{...c,unreadCount:{...c.unreadCount,[user.uid]:unread},lastMessage:last?.text||last?.fileName||"File",lastMessageTime:last?.createdAt}:c);
            return[...prev,{id:gDoc.id,participants:gd.participants,unreadCount:{[user.uid]:unread},lastMessage:last?.text||last?.fileName||"File",lastMessageTime:last?.createdAt,isGroup:true,groupName:gd.groupName,groupAvatar:gd.groupAvatar,createdBy:gd.createdBy,admins:gd.admins}];
          });
        }));
      });
    });
    return()=>{subs.forEach(s=>s());gu();};
  },[user,users]);

  useEffect(()=>{
    if(!chatId||!selectedChat)return;
    const path=selectedChat.isGroup?`groupChats/${chatId}/messages`:`chats/${chatId}/messages`;
    return onSnapshot(query(collection(db,path),orderBy("createdAt","asc")),snap=>{
      const data=snap.docs.map(d=>({id:d.id,...d.data()} as Message));
      setMessages(data);
      const batch=writeBatch(db);
      data.forEach(m=>{if(m.senderUid!==user?.uid&&(!m.readBy||!m.readBy.includes(user!.uid))) batch.update(doc(db,path,m.id),{readBy:[...(m.readBy||[]),user!.uid],status:"seen"});});
      batch.commit();
    });
  },[chatId,selectedChat,user]);

  useEffect(()=>{
    if(!chatId||!selectedChat)return;
    const tp=selectedChat.isGroup?`groupChats/${chatId}/typing`:`chats/${chatId}/typing`;
    return onSnapshot(query(collection(db,tp)),snap=>{
      const t:string[]=[];
      snap.forEach(d=>{if(d.id!==user?.uid&&d.data().typing){const u2=users.find(u=>u.uid===d.id);if(u2)t.push(u2.name??u2.email??"User");}});
      setTyping(t);
    });
  },[chatId,selectedChat,user,users]);

  // ── NEW: Listen to live group data ────────────────────────────────────────
  useEffect(()=>{
    if(!selectedChat?.isGroup) return;
    const unsub = onSnapshot(doc(db,"groupChats",selectedChat.id),(snap)=>{
      if(snap.exists()) setGroupData({id:snap.id,...snap.data()});
    });
    return()=>unsub();
  },[selectedChat]);

  const handleTyping=async()=>{
    if(!chatId||!user||!selectedChat)return;
    const tp=selectedChat.isGroup?`groupChats/${chatId}/typing`:`chats/${chatId}/typing`;
    await setDoc(doc(db,tp,user.uid),{typing:true,timestamp:serverTimestamp()});
    clearTimeout(typingRef.current);
    typingRef.current=setTimeout(()=>deleteDoc(doc(db,tp,user.uid)),1500);
  };

  const sendText=async()=>{
    if((!text.trim()&&!selectedFile)||!chatId||!user||!selectedChat)return;
    setUploading(true);
    try{
      let fu="",fn="",ft="";
      if(selectedFile){const r=ref(storage,`chat-files/${chatId}/${Date.now()}_${selectedFile.name}`);await uploadBytes(r,selectedFile);fu=await getDownloadURL(r);fn=selectedFile.name;ft=selectedFile.type;}
      const path=selectedChat.isGroup?`groupChats/${chatId}/messages`:`chats/${chatId}/messages`;
      const msg:any={senderUid:user.uid,senderName:getUserName(user),status:"sent",readBy:[user.uid],createdAt:serverTimestamp()};
      if(text.trim())msg.text=text;if(fu){msg.fileUrl=fu;msg.fileName=fn;msg.fileType=ft;}
      await addDoc(collection(db,path),msg);
      const others=selectedChat.participants.filter(p=>p!==user.uid);
      for(const pid of others) await addDoc(collection(db,"notifications"),{fromUid:user.uid,fromName:getUserName(user),toUid:pid,message:text||fn||"Sent a file",chatId,timestamp:serverTimestamp(),read:false});
      const tp=selectedChat.isGroup?`groupChats/${chatId}/typing`:`chats/${chatId}/typing`;
      await deleteDoc(doc(db,tp,user.uid));
      setText("");setSelectedFile(null);
    }catch(e){console.error(e);}finally{setUploading(false);}
  };

  const deleteMsg=async(id:string)=>{
    if(!selectedChat||!chatId)return;
    await deleteDoc(doc(db,selectedChat.isGroup?`groupChats/${chatId}/messages`:`chats/${chatId}/messages`,id));
  };
  const saveEdit=async()=>{
    if(!editingMsgId||!editText.trim()||!selectedChat||!chatId)return;
    await updateDoc(doc(db,selectedChat.isGroup?`groupChats/${chatId}/messages`:`chats/${chatId}/messages`,editingMsgId),{text:editText,isEdited:true,editedAt:serverTimestamp()});
    setEditingMsgId(null);setEditText("");
  };

  const changeStatus=async(s:UserStatus)=>{
    setMyStatus(s);
    if(user) await updateDoc(doc(db,"userStatus",user.uid),{status:s,online:s!=="offline"});
  };

  const markAllRead=async()=>{
    const b=writeBatch(db);
    notifications.forEach(n=>b.update(doc(db,"notifications",n.id),{read:true}));
    await b.commit();
  };

  // ── Group Management Functions ─────────────────────────────────────────────

  const addMember=async(uid:string)=>{
    if(!groupData)return;
    await updateDoc(doc(db,"groupChats",groupData.id),{
      participants:[...groupData.participants,uid],
    });
  };

  const removeMember=async(uid:string)=>{
    if(!groupData)return;
    await updateDoc(doc(db,"groupChats",groupData.id),{
      participants:groupData.participants.filter((u:string)=>u!==uid),
      admins:groupData.admins?.filter((a:string)=>a!==uid),
    });
  };

  const toggleAdmin=async(uid:string)=>{
    if(!groupData)return;
    const isAlreadyAdmin=groupData.admins?.includes(uid);
    await updateDoc(doc(db,"groupChats",groupData.id),{
      admins:isAlreadyAdmin
        ?groupData.admins.filter((a:string)=>a!==uid)
        :[...(groupData.admins||[]),uid],
    });
  };

  const renameGroup=async(newName:string)=>{
    if(!groupData||!newName.trim())return;
    await updateDoc(doc(db,"groupChats",groupData.id),{groupName:newName.trim()});
  };

  const changeGroupAvatar=async(file:File)=>{
    if(!groupData)return;
    const storageRef=ref(storage,`group-avatar/${groupData.id}`);
    await uploadBytes(storageRef,file);
    const url=await getDownloadURL(storageRef);
    await updateDoc(doc(db,"groupChats",groupData.id),{groupAvatar:url});
  };

  const leaveGroup=async()=>{
    if(!groupData||!user)return;
    if(!confirm("Leave this group?"))return;
    await updateDoc(doc(db,"groupChats",groupData.id),{
      participants:groupData.participants.filter((u:string)=>u!==user.uid),
      admins:groupData.admins?.filter((a:string)=>a!==user.uid),
    });
    setShowGroupSettings(false);
    setSelectedChat(null);
  };

  const deleteGroup=async()=>{
    if(!groupData)return;
    if(!confirm("Delete this group for everyone?"))return;
    await deleteDoc(doc(db,"groupChats",groupData.id));
    setShowGroupSettings(false);
    setSelectedChat(null);
  };

  // ── Build ontrack handler ─────────────────────────────────────────────────
  const buildOnTrack = (pc: RTCPeerConnection) => {
    pc.ontrack = (e) => {
      const remoteStream = e.streams[0];
      if(callTypeRef.current === "video"){
        if(remoteVideoRef.current){
          remoteVideoRef.current.srcObject = remoteStream;
          remoteVideoRef.current.muted = false;
          remoteVideoRef.current.play().catch(err=>console.warn("remote video autoplay:", err));
        }
      } else {
        if(remoteAudioRef.current){
          remoteAudioRef.current.srcObject = remoteStream;
          remoteAudioRef.current.muted = false;
          remoteAudioRef.current.play().catch(err=>console.warn("remote audio autoplay:", err));
        }
      }
    };
  };

  const attachLocalStream = (stream: MediaStream, type: "video"|"audio") => {
    if(type === "video" && localVideoRef.current) localVideoRef.current.srcObject = stream;
    if(type === "audio" && localAudioRef.current) localAudioRef.current.srcObject = stream;
  };

  const initiateCall=async(type:"video"|"audio")=>{
    if(!user||!selectedChat||selectedChat.isGroup)return;
    const rid=selectedChat.participants.find(p=>p!==user.uid);if(!rid)return;
    const recv=users.find(u=>u.uid===rid);if(!recv)return;
    callTypeRef.current = type;
    try{
      const stream=await navigator.mediaDevices.getUserMedia({
        video:type==="video"?{width:1280,height:720,facingMode:"user"}:false,
        audio:{echoCancellation:true,noiseSuppression:true,sampleRate:48000},
      });
      streamRef.current=stream;
      attachLocalStream(stream,type);
      const pc=new RTCPeerConnection(ICE_SERVERS);
      peerRef.current=pc;
      stream.getTracks().forEach(t=>pc.addTrack(t,stream));
      buildOnTrack(pc);
      const offer=await pc.createOffer({offerToReceiveAudio:true,offerToReceiveVideo:type==="video"});
      await pc.setLocalDescription(offer);
      const cd=await addDoc(collection(db,"calls"),{callerId:user.uid,callerName:getUserName(user),receiverId:rid,type,status:"ringing",offer:{type:offer.type,sdp:offer.sdp},startTime:serverTimestamp()});
      const oc=collection(db,"calls",cd.id,"offerCandidates");
      const ac=collection(db,"calls",cd.id,"answerCandidates");
      pc.onicecandidate=async e=>{if(e.candidate)await addDoc(oc,e.candidate.toJSON());};
      onSnapshot(ac,snap=>snap.docChanges().forEach(ch=>{
        if(ch.type==="added"){const d=ch.doc.data();if(pc.remoteDescription)pc.addIceCandidate(new RTCIceCandidate(d)).catch(console.error);else iceQueue.current.push(d);}
      }));
      pc.onconnectionstatechange=()=>{if(pc.connectionState==="failed"||pc.connectionState==="disconnected")endCall();};
      setActiveCall({id:cd.id,callerId:user.uid,callerName:getUserName(user),receiverId:rid,type,status:"ringing"});
    }catch(e){console.error(e);alert("Camera/mic access failed.");}
  };

  const acceptCall=async()=>{
    if(!incomingCall||!user)return;
    callTypeRef.current = incomingCall.type;
    try{
      const stream=await navigator.mediaDevices.getUserMedia({
        video:incomingCall.type==="video"?{width:1280,height:720,facingMode:"user"}:false,
        audio:{echoCancellation:true,noiseSuppression:true,sampleRate:48000},
      });
      streamRef.current=stream;
      attachLocalStream(stream,incomingCall.type);
      const pc=new RTCPeerConnection(ICE_SERVERS);
      peerRef.current=pc;
      stream.getTracks().forEach(t=>pc.addTrack(t,stream));
      buildOnTrack(pc);
      for(const c of iceQueue.current)
        await pc.addIceCandidate(new RTCIceCandidate(c)).catch(console.error);
      iceQueue.current=[];
      await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));
      const answer=await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await updateDoc(doc(db,"calls",incomingCall.id),{status:"accepted",answer:{type:answer.type,sdp:answer.sdp}});
      const oc=collection(db,"calls",incomingCall.id,"offerCandidates");
      const ac=collection(db,"calls",incomingCall.id,"answerCandidates");
      pc.onicecandidate=async e=>{if(e.candidate)await addDoc(ac,e.candidate.toJSON());};
      onSnapshot(oc,snap=>snap.docChanges().forEach(ch=>{
        if(ch.type==="added"){const d=ch.doc.data();if(pc.remoteDescription)pc.addIceCandidate(new RTCIceCandidate(d)).catch(console.error);else iceQueue.current.push(d);}
      }));
      pc.onconnectionstatechange=()=>{if(pc.connectionState==="failed"||pc.connectionState==="disconnected")endCall();};
      setActiveCall({...incomingCall,status:"accepted"});
      setIncomingCall(null);
      stopRing();
    }catch(e){console.error(e);rejectCall();}
  };

  const rejectCall=async()=>{
    if(!incomingCall)return;
    stopRing();
    await updateDoc(doc(db,"calls",incomingCall.id),{status:"rejected",endTime:serverTimestamp()});
    await addDoc(collection(db,"callHistory"),{callerId:incomingCall.callerId,callerName:incomingCall.callerName,receiverId:incomingCall.receiverId,receiverName:getUserName(user),type:incomingCall.type,status:"rejected",timestamp:serverTimestamp(),participants:[incomingCall.callerId,incomingCall.receiverId]});
    setIncomingCall(null);
  };

  const endCall=async()=>{
    stopRing();
    streamRef.current?.getTracks().forEach(t=>t.stop());
    peerRef.current?.close();
    if(localVideoRef.current)  localVideoRef.current.srcObject  = null;
    if(remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if(localAudioRef.current)  localAudioRef.current.srcObject  = null;
    if(remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    if(activeCall){
      try{
        const snap=await getDoc(doc(db,"calls",activeCall.id));
        if(snap.exists()){
          const data=snap.data();
          if(data.status!=="ended"&&data.status!=="rejected")
            await updateDoc(doc(db,"calls",activeCall.id),{status:"ended",endTime:serverTimestamp()});
          const dur=data.startTime?.toMillis()?Math.floor((Date.now()-data.startTime.toMillis())/1000):0;
          await addDoc(collection(db,"callHistory"),{callerId:activeCall.callerId,callerName:activeCall.callerName,receiverId:activeCall.receiverId,receiverName:getUserName(users.find(u=>u.uid===activeCall.receiverId)),type:activeCall.type,status:activeCall.status==="accepted"?"completed":"missed",duration:dur,timestamp:serverTimestamp(),participants:[activeCall.callerId,activeCall.receiverId]});
        }
      }catch(e){console.error(e);}
    }
    clearInterval(timerRef.current);
    streamRef.current=null; peerRef.current=null;
    setActiveCall(null); setIsMuted(false); setIsVideoOff(false); setCallTimer(0);
  };

  const fmtT=(s:number)=>{const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60;return h>0?`${h}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`:`${m}:${String(sec).padStart(2,"0")}`;};

  // ── UPDATED: createGroup now adds admins field ────────────────────────────
  const createGroup=async()=>{
    if(!groupName.trim()||selectedMembers.length<2||!user)return;
    const all=[...selectedMembers,user.uid];
    const gr=await addDoc(collection(db,"groupChats"),{
      groupName:groupName.trim(),
      participants:all,
      createdBy:user.uid,
      admins:[user.uid], // ✅ creator is admin
      createdAt:serverTimestamp(),
    });
    await addDoc(collection(db,"groupChats",gr.id,"messages"),{text:`${getUserName(user)} created "${groupName.trim()}"`,senderUid:"system",senderName:"System",createdAt:serverTimestamp(),readBy:all});
    setGroupName("");setSelectedMembers([]);setShowCreateGroup(false);
    setSelectedChat({id:gr.id,participants:all,isGroup:true,groupName:groupName.trim(),createdBy:user.uid,admins:[user.uid]});
  };

  const getChatName=(c:Chat)=>{if(c.isGroup)return c.groupName||"Group";const ou=users.find(u=>u.uid===c.participants.find(p=>p!==user?.uid));return ou?.name||ou?.email||"Unknown";};
  const getChatOU=(c:Chat)=>users.find(u=>u.uid===c.participants.find(p=>p!==user?.uid));
  const getUnread=(id:string)=>(!user?0:chats.find(c=>c.id===id)?.unreadCount?.[user.uid]||0);
  const getOUSt=(c:Chat):UserStatus=>{if(c.isGroup)return"offline";const ou=getChatOU(c);if(!ou)return"offline";return userStatuses[ou.uid]?.status||"offline";};

  const filteredChats=chats.filter(c=>{
    if(activeTab==="direct"&&c.isGroup)return false;
    if(activeTab==="groups"&&!c.isGroup)return false;
    if(!searchQuery)return true;
    const q=searchQuery.toLowerCase();
    if(c.isGroup)return c.groupName?.toLowerCase().includes(q);
    const ou=getChatOU(c);return ou?.name?.toLowerCase().includes(q)||ou?.email?.toLowerCase().includes(q);
  }).sort((a,b)=>{
    if(a.lastMessageTime&&b.lastMessageTime) return(b.lastMessageTime?.toMillis()||0)-(a.lastMessageTime?.toMillis()||0);
    if(a.lastMessageTime)return-1;if(b.lastMessageTime)return 1;
    return getChatName(a).localeCompare(getChatName(b));
  });

  const availGroups=useMemo(()=>{
    const G=[
      {key:"available",label:"Available",      color:"#22c55e",items:[] as Chat[]},
      {key:"busy",     label:"Busy",            color:"#ef4444",items:[] as Chat[]},
      {key:"lunch",    label:"Out for Lunch 🍽️",color:"#a855f7",items:[] as Chat[]},
      {key:"brb",      label:"Be Right Back",   color:"#f59e0b",items:[] as Chat[]},
      {key:"away",     label:"Away",            color:"#f59e0b",items:[] as Chat[]},
      {key:"dnd",      label:"Do Not Disturb",  color:"#ef4444",items:[] as Chat[]},
      {key:"offline",  label:"Offline",         color:"#9ca3af",items:[] as Chat[]},
      {key:"groups",   label:"Group Chats",     color:"#0891b2",items:[] as Chat[]},
    ];
    filteredChats.forEach(c=>{
      if(c.isGroup){G[7].items.push(c);return;}
      const st=getOUSt(c);
      const g=G.find(g=>g.key===st)||G[6];
      g.items.push(c);
    });
    return G.filter(g=>g.items.length>0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[filteredChats,userStatuses]);

  const toggleGrp=(key:string)=>setCollapsedGroups(p=>{const n=new Set(p);n.has(key)?n.delete(key):n.add(key);return n;});
  const otherCallUser=useMemo(()=>{
    if(!activeCall)return null;
    return users.find(u=>u.uid===(activeCall.callerId===user?.uid?activeCall.receiverId:activeCall.callerId))??null;
  },[users,activeCall,user]);

  // ── JSX ───────────────────────────────────────────────────────────────────
  return(
    <>
      <style>{CSS}</style>
      <input ref={fileRef} type="file" className="sr-only" onChange={e=>e.target.files?.[0]&&setSelectedFile(e.target.files[0])}/>
      {/* Hidden avatar file input for group settings */}
      <input ref={avatarFileRef} type="file" accept="image/*" className="sr-only" onChange={e=>{if(e.target.files?.[0])changeGroupAvatar(e.target.files[0]);}}/>

      {/* ── HIDDEN AUDIO ELEMENTS ── */}
      <audio ref={localAudioRef}  autoPlay muted style={{display:"none"}}/>
      <audio ref={remoteAudioRef} autoPlay       style={{display:"none"}}/>

      {/* ── INCOMING CALL ── */}
      {incomingCall&&(
        <div className="zc-incoming">
          <div className="zc-inc-card">
            {(()=>{const c=users.find(u=>u.uid===incomingCall.callerId);const[g1,g2]=avGrad(incomingCall.callerName);
              return c?.profilePhoto?<div className="zc-inc-av"><img src={c.profilePhoto} alt=""/></div>:<div className="zc-inc-av" style={{background:`linear-gradient(135deg,${g1},${g2})`}}>{initials(incomingCall.callerName)}</div>;})()}
            <div style={{fontSize:19,fontWeight:700,color:"#1a1d23",marginBottom:3}}>{incomingCall.callerName}</div>
            <div style={{fontSize:12.5,color:"#6b7280"}}>Incoming {incomingCall.type} call</div>
            <div className="zc-inc-dots"><div className="zc-inc-dot"/><div className="zc-inc-dot"/><div className="zc-inc-dot"/></div>
            <div className="zc-inc-btns">
              <button className="zc-inc-btn rej" onClick={rejectCall}><svg width="26" height="26" fill="none" stroke="#ef4444" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z"/></svg></button>
              <button className="zc-inc-btn acc" onClick={acceptCall}><svg width="26" height="26" fill="none" stroke="#16a34a" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg></button>
            </div>
          </div>
        </div>
      )}

      {/* ── ACTIVE CALL ── */}
      {activeCall&&(
        <div className="zc-call-ov">
          <div className="zc-call-main">
            {activeCall.type==="video"
              ? <video ref={remoteVideoRef} autoPlay playsInline style={{width:"100%",height:"100%",objectFit:"cover"}}/>
              : <div className="zc-call-audio-center">
                  {otherCallUser?.profilePhoto
                    ?<div style={{width:120,height:120,borderRadius:28,overflow:"hidden"}}><img src={otherCallUser.profilePhoto} style={{width:"100%",height:"100%",objectFit:"cover"}} alt=""/></div>
                    :<div style={{width:120,height:120,borderRadius:28,background:`linear-gradient(135deg,${avGrad(getUserName(otherCallUser))[0]},${avGrad(getUserName(otherCallUser))[1]})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:44,fontWeight:800,color:"#fff"}}>{initials(getUserName(otherCallUser))}</div>
                  }
                  <div style={{color:"#fff",fontSize:22,fontWeight:700,fontFamily:"'DM Sans',sans-serif"}}>{getUserName(otherCallUser)}</div>
                  <div style={{color:"rgba(255,255,255,.45)",fontSize:14,fontFamily:"'DM Sans',sans-serif"}}>{activeCall.status==="ringing"?"Calling…":fmtT(callTimer)}</div>
                </div>
            }
            {activeCall.type==="video"&&(
              <div style={{position:"absolute",bottom:16,right:16,width:180,height:135,borderRadius:12,overflow:"hidden",border:"2px solid rgba(255,255,255,.2)"}}>
                <video ref={localVideoRef} autoPlay playsInline muted style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                {isVideoOff&&<div style={{position:"absolute",inset:0,background:"#161b22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,color:"rgba(255,255,255,.4)",fontFamily:"'DM Sans',sans-serif"}}>Camera off</div>}
              </div>
            )}
            <div className="zc-call-badge">{activeCall.status==="ringing"?"Calling…":fmtT(callTimer)}</div>
          </div>
          <div className="zc-call-bar">
            <button className={`zc-cbtn ${isMuted?"act":"neu"}`} onClick={()=>{streamRef.current?.getAudioTracks().forEach(t=>t.enabled=!t.enabled);setIsMuted(p=>!p);}}>
              {isMuted
                ?<svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6"/><path d="M17 16.95A7 7 0 015 12v-2m14 0v2a7 7 0 01-.11 1.23M12 19v3M8 23h8"/></svg>
                :<svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/></svg>
              }
            </button>
            {activeCall.type==="video"&&(
              <button className={`zc-cbtn ${isVideoOff?"act":"neu"}`} onClick={()=>{streamRef.current?.getVideoTracks().forEach(t=>t.enabled=!t.enabled);setIsVideoOff(p=>!p);}}>
                {isVideoOff
                  ?<svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M16 16l4.553 2.276A1 1 0 0022 17.382v-6.764a1 1 0 00-1.447-.894L16 12"/><rect x="2" y="6" width="14" height="12" rx="2"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  :<svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                }
              </button>
            )}
            <button className="zc-cbtn end" onClick={endCall}><svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><path d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z"/></svg></button>
          </div>
        </div>
      )}

      {/* ── CREATE GROUP MODAL ── */}
      {showCreateGroup&&(
        <div className="zc-mbk" onClick={e=>e.target===e.currentTarget&&setShowCreateGroup(false)}>
          <div className="zc-modal">
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
              <div style={{fontSize:15,fontWeight:700,color:"#1a1d23"}}>Create Group Chat</div>
              <button style={{background:"none",border:"none",cursor:"pointer",color:"#9aa0ad",fontSize:20}} onClick={()=>setShowCreateGroup(false)}>×</button>
            </div>
            <div className="zc-mlbl">Group Name</div>
            <input className="zc-mi" placeholder="e.g. Project Alpha" value={groupName} onChange={e=>setGroupName(e.target.value)}/>
            <div className="zc-mlbl">Members ({selectedMembers.length} selected)</div>
            <div className="zc-mlist">
              {users.filter(u=>u.uid!==user?.uid).map(u=>{const sel=selectedMembers.includes(u.uid);const[g1,g2]=avGrad(getUserName(u));
                return(<div key={u.uid} className={`zc-mitm${sel?" sel":""}`} onClick={()=>setSelectedMembers(p=>sel?p.filter(x=>x!==u.uid):[...p,u.uid])}>
                  <div className={`zc-chk${sel?" on":""}`}>{sel&&<svg width="9" height="7" fill="none" stroke="#fff" strokeWidth="2.5" viewBox="0 0 10 8"><path d="M1 4l3 3 5-6"/></svg>}</div>
                  <div className="zc-av" style={{background:`linear-gradient(135deg,${g1},${g2})`,width:28,height:28,borderRadius:8,fontSize:10}}>{initials(getUserName(u))}</div>
                  <div style={{fontSize:13,fontWeight:600,color:"#1a1d23"}}>{u.name||u.email}</div>
                </div>);})}
            </div>
            <div className="zc-mfooter">
              <button className="zc-btn ghost" onClick={()=>{setShowCreateGroup(false);setGroupName("");setSelectedMembers([]);}}>Cancel</button>
              <button className="zc-btn primary" disabled={!groupName.trim()||selectedMembers.length<2} onClick={createGroup}>Create Group</button>
            </div>
          </div>
        </div>
      )}

      {/* ── GROUP SETTINGS MODAL ── */}
      {showGroupSettings&&groupData&&(
        <div className="zc-mbk" onClick={e=>e.target===e.currentTarget&&setShowGroupSettings(false)}>
          <div className="zc-modal">
            {/* Header */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
              <div style={{fontSize:15,fontWeight:700,color:"#1a1d23"}}>Group Settings</div>
              <button style={{background:"none",border:"none",cursor:"pointer",color:"#9aa0ad",fontSize:20,lineHeight:1}} onClick={()=>setShowGroupSettings(false)}>×</button>
            </div>

            {/* Group Avatar */}
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",margin:"12px 0 4px"}}>
              <div style={{position:"relative",cursor:"pointer"}} onClick={()=>avatarFileRef.current?.click()}>
                <div className="zc-av" style={{
                  background:groupData.groupAvatar?"transparent":`linear-gradient(135deg,#0891b2,#22d3ee)`,
                  width:64,height:64,borderRadius:16,fontSize:22,
                }}>
                  {groupData.groupAvatar?<img src={groupData.groupAvatar} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:initials(groupData.groupName||"G")}
                </div>
                {isAdmin&&<div style={{position:"absolute",bottom:-4,right:-4,width:20,height:20,borderRadius:"50%",background:"#e8512a",border:"2px solid #fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:"#fff"}}>✏️</div>}
              </div>
            </div>

            {/* Group Name */}
            <div className="zc-mlbl">Group Name</div>
            {isAdmin
              ?<input className="zc-mi" defaultValue={groupData.groupName} onBlur={e=>renameGroup(e.target.value)} placeholder="Group name"/>
              :<div style={{fontSize:14,fontWeight:600,color:"#1a1d23",padding:"8px 0"}}>{groupData.groupName}</div>
            }

            {/* Members */}
            <div className="zc-mlbl" style={{marginTop:14}}>
              Members ({groupData.participants?.length||0})
            </div>
            <div className="zc-mlist">
              {(groupData.participants||[]).map((uid:string)=>{
                const u=users.find(x=>x.uid===uid);
                const uName=u?.name||u?.email||"Unknown";
                const isUserAdmin=groupData.admins?.includes(uid);
                const isSelf=uid===user?.uid;
                const[g1,g2]=avGrad(uName);
                return(
                  <div key={uid} className="zc-gs-member">
                    <div className="zc-av" style={{background:`linear-gradient(135deg,${g1},${g2})`,width:32,height:32,borderRadius:9,fontSize:11,flexShrink:0}}>
                      {u?.profilePhoto?<img src={u.profilePhoto} alt=""/>:initials(uName)}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:600,color:"#1a1d23",display:"flex",alignItems:"center",gap:5}}>
                        {uName}{isSelf&&<span style={{fontSize:10,color:"#9aa0ad"}}>(you)</span>}
                      </div>
                      {isUserAdmin&&<div style={{fontSize:10.5,color:"#f59e0b",fontWeight:700,marginTop:1}}>👑 Admin</div>}
                    </div>
                    {isAdmin&&!isSelf&&(
                      <div style={{display:"flex",gap:5,flexShrink:0}}>
                        <button
                          className="zc-gs-mbtn admin"
                          onClick={()=>toggleAdmin(uid)}
                          title={isUserAdmin?"Remove admin":"Make admin"}
                        >
                          {isUserAdmin?"- Admin":"+ Admin"}
                        </button>
                        <button
                          className="zc-gs-mbtn remove"
                          onClick={()=>removeMember(uid)}
                          title="Remove from group"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Add Member — admins only */}
            {isAdmin&&(()=>{
              const nonMembers=users.filter(u=>!(groupData.participants||[]).includes(u.uid));
              if(nonMembers.length===0)return null;
              return(
                <>
                  <div className="zc-mlbl" style={{marginTop:14}}>Add Member</div>
                  <div className="zc-gs-add-list">
                    {nonMembers.map(u=>{
                      const uName=getUserName(u);const[g1,g2]=avGrad(uName);
                      return(
                        <div key={u.uid} className="zc-gs-add-item" onClick={()=>addMember(u.uid)}>
                          <div className="zc-av" style={{background:`linear-gradient(135deg,${g1},${g2})`,width:28,height:28,borderRadius:8,fontSize:10,flexShrink:0}}>
                            {u.profilePhoto?<img src={u.profilePhoto} alt=""/>:initials(uName)}
                          </div>
                          <span>{uName}</span>
                          <span style={{fontSize:18,color:"#22c55e"}}>➕</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}

            {/* Footer actions */}
            <div className="zc-mfooter" style={{justifyContent:"space-between"}}>
              <button className="zc-btn danger" onClick={leaveGroup}>
                🚪 Leave Group
              </button>
              {isAdmin&&(
                <button className="zc-btn primary" onClick={deleteGroup} style={{background:"#ef4444"}}>
                  🗑 Delete Group
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MAIN LAYOUT ── */}
      <div className="zc">
        {/* <div className="zc-sb">
          <div className={`zc-sb-ico${tab==="chats"?" on":""}`} onClick={()=>setTab("chats")} title="Chats">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
          </div>
          <div className={`zc-sb-ico${tab==="calls"?" on":""}`} onClick={()=>setTab("calls")} title="Calls">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
          </div>
        </div> */}

        {/* ── CHATS TAB ── */}
        {tab==="chats"&&(
          <>
            <div className="zc-panel">
              <div className="zc-panel-hd">
                <div className="zc-panel-title-row">
                  <div className="zc-panel-title">Chats</div>
                  <button className="zc-icon-btn" onClick={()=>setShowCreateGroup(true)} title="New group">
                    <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4"/></svg>
                  </button>
                </div>
                <div className="zc-search-wrap">
                  <svg className="zc-search-ico" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                  <input className="zc-search" placeholder="Search chats" value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}/>
                </div>
                <div className="zc-tabs">
                  {(["all","direct","groups"] as const).map(t=>(
                    <button key={t} className={`zc-tab${activeTab===t?" on":""}`} onClick={()=>setActiveTab(t)}>{t.charAt(0).toUpperCase()+t.slice(1)}</button>
                  ))}
                </div>
              </div>
              <div className="zc-chat-list">
                {availGroups.length===0&&<div style={{padding:"28px 14px",textAlign:"center",fontSize:13,color:"#9aa0ad"}}>No chats found</div>}
                {availGroups.map(group=>{
                  const collapsed=collapsedGroups.has(group.key);
                  return(
                    <div key={group.key}>
                      <div className="zc-group-divider" onClick={()=>toggleGrp(group.key)}>
                        <div style={{width:8,height:8,borderRadius:"50%",background:group.color,flexShrink:0}}/>
                        <div className="zc-group-label" style={{color:group.color}}>{group.label}</div>
                        <div className="zc-group-count" style={{background:group.color+"20",color:group.color}}>{group.items.length}</div>
                        <div className={`zc-group-arrow${collapsed?"":" open"}`}>▶</div>
                      </div>
                      {!collapsed&&group.items.map(c=>{
                        const ou=getChatOU(c);const name=getChatName(c);const unread=getUnread(c.id);
                        const st=getOUSt(c);const stCfg=STATUS_CONFIG[st];const[g1,g2]=avGrad(name);
                        return(
                          <div key={c.id} className={`zc-chat-item${selectedChat?.id===c.id?" on":""}`} onClick={()=>setSelectedChat(c)}>
                            <div style={{position:"relative",flexShrink:0}}>
                              <div className="zc-av" style={{background:c.isGroup?`linear-gradient(135deg,#0891b2,#22d3ee)`:`linear-gradient(135deg,${g1},${g2})`,width:38,height:38,borderRadius:10,fontSize:13}}>
                                {c.groupAvatar?<img src={c.groupAvatar} alt=""/>:ou?.profilePhoto?<img src={ou.profilePhoto} alt=""/>:initials(name)}
                              </div>
                              {!c.isGroup&&<div className="zc-sdot" style={{width:10,height:10,background:stCfg.color,border:"2px solid #fff",bottom:-2,right:-2}}/>}
                            </div>
                            <div className="zc-chat-meta">
                              <div className="zc-chat-name">
                                {name}
                                {!c.isGroup&&st==="available"&&<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>}
                              </div>
                              {c.lastMessage&&<div className="zc-chat-preview">{c.lastMessage}</div>}
                            </div>
                            {unread>0&&<div className="zc-unread">{unread>9?"9+":unread}</div>}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── CONVERSATION AREA ── */}
            {!selectedChat
              ?<div className="zc-main">
                <div className="zc-empty">
                  <div className="zc-empty-ico">💬</div>
                  <div style={{fontSize:16,fontWeight:700,color:"#374151"}}>Select a conversation</div>
                  <div style={{fontSize:13,color:"#9aa0ad"}}>Choose a chat or create a group</div>
                </div>
              </div>
              :<div className="zc-main">
                <div className="zc-conv-hd">
                  <div className="zc-conv-hd-left">
                    {(()=>{
                      const ou=getChatOU(selectedChat);const name=getChatName(selectedChat);
                      const st=getOUSt(selectedChat);const stCfg=STATUS_CONFIG[st];const[g1,g2]=avGrad(name);
                      return(<>
                        <div style={{position:"relative"}}>
                          <div className="zc-av" style={{background:selectedChat.isGroup?`linear-gradient(135deg,#0891b2,#22d3ee)`:`linear-gradient(135deg,${g1},${g2})`,width:36,height:36,borderRadius:10,fontSize:12}}>
                            {selectedChat.groupAvatar?<img src={selectedChat.groupAvatar} alt=""/>:ou?.profilePhoto?<img src={ou.profilePhoto} alt=""/>:initials(name)}
                          </div>
                          {!selectedChat.isGroup&&<div className="zc-sdot" style={{width:10,height:10,background:stCfg.color,border:"2px solid #fff",bottom:-2,right:-2}}/>}
                        </div>
                        <div>
                          <div className="zc-conv-name">{name}</div>
                          <div className="zc-conv-sub" style={{color:typing.length>0?"#e8512a":stCfg.color}}>
                            {typing.length>0?`${typing.join(", ")} ${typing.length===1?"is":"are"} typing…`:selectedChat.isGroup?`${selectedChat.participants.length} members`:stCfg.label}
                          </div>
                        </div>
                      </>);
                    })()}
                  </div>
                  <div style={{display:"flex",gap:2,alignItems:"center"}}>
                    {!selectedChat.isGroup&&(
                      <>
                        <button className="zc-hd-btn" title="Audio call" onClick={()=>initiateCall("audio")}><svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg></button>
                        <button className="zc-hd-btn" title="Video call" onClick={()=>initiateCall("video")}><svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg></button>
                      </>
                    )}
                    {/* ── GROUP SETTINGS BUTTON ── */}
                    {selectedChat.isGroup&&(
                      <button className="zc-hd-btn" title="Group settings" onClick={()=>setShowGroupSettings(true)}>
                        <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                          <circle cx="9" cy="7" r="4"/>
                          <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
                        </svg>
                      </button>
                    )}
                    <div ref={dotsRef} style={{position:"relative"}}>
                      <button className="zc-hd-btn" title="More" onClick={()=>setShowDots(p=>!p)}>
                        <svg width="17" height="17" fill="currentColor" viewBox="0 0 24 24"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
                      </button>
                      {showDots&&(
                        <div className="zc-dd" style={{width:185,top:38,right:0}}>
                          <div className="zc-ds">
                            {[{e:"🔍",l:"Search in chat"},{e:"📌",l:"Pin conversation"},{e:"🔕",l:"Mute notifications"},{e:"📁",l:"View files"},{e:"👤",l:"View profile"},
                              ...(selectedChat.isGroup?[{e:"⚙️",l:"Group settings",fn:()=>setShowGroupSettings(true)}]:[])].map(item=>(
                              <div key={item.l} className="zc-di" onClick={()=>{setShowDots(false);(item as any).fn?.();}}><span style={{fontSize:13}}>{item.e}</span>{item.l}</div>
                            ))}
                            <div className="zc-di red" onClick={()=>{setShowDots(false);setSelectedChat(null);}}><span style={{fontSize:13}}>🚪</span>Close chat</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── MESSAGES ── */}
                <div className="zc-msgs">
                  {messages.length===0&&<div style={{textAlign:"center",padding:"32px 0",fontSize:13,color:"#9aa0ad"}}>No messages yet — say hello! 👋</div>}
                  {messages.map((m,i)=>{
                    const mine=m.senderUid===user?.uid;const isSystem=m.senderUid==="system";
                    const showAv=i===0||messages[i-1]?.senderUid!==m.senderUid;
                    const isRead=(m.readBy?.length||0)>1;
                    const su=users.find(u=>u.uid===m.senderUid);const[sg1,sg2]=avGrad(m.senderName||"?");
                    if(isSystem)return<div key={m.id} className="zc-sys-msg"><span className="zc-sys-pill">{m.text}</span></div>;
                    return(
                      <div key={m.id} className={`zc-msg-row${mine?" mine":""}`} style={{alignItems:"flex-end"}}>
                        {!mine&&(showAv
                          ?<div style={{width:30,height:30,borderRadius:8,flexShrink:0,overflow:"hidden"}}><div className="zc-msg-av-ph" style={{background:`linear-gradient(135deg,${sg1},${sg2})`}}>{su?.profilePhoto?<img src={su.profilePhoto} style={{width:"100%",height:"100%",objectFit:"cover"}} alt=""/>:initials(m.senderName||"?")}</div></div>
                          :<div style={{width:30,flexShrink:0}}/>
                        )}
                        <div className="zc-msg-content" style={{alignItems:mine?"flex-end":"flex-start"}}>
                          {selectedChat.isGroup&&!mine&&showAv&&<div className="zc-msg-sender">{su?.name||m.senderName}</div>}
                          {editingMsgId===m.id&&mine
                            ?<div className="zc-edit-wrap">
                              <textarea className="zc-edit-ta" value={editText} onChange={e=>setEditText(e.target.value)} autoFocus rows={2}/>
                              <div className="zc-edit-btns">
                                <button className="zc-btn ghost" style={{padding:"4px 12px",fontSize:12}} onClick={()=>{setEditingMsgId(null);setEditText("");}}>Cancel</button>
                                <button className="zc-btn primary" style={{padding:"4px 12px",fontSize:12}} onClick={saveEdit}>Save</button>
                              </div>
                            </div>
                            :<div className={`zc-bubble ${mine?"mine":"them"}`}>
                              {mine&&<div className="zc-msg-actions">
                                <button className="zc-act-btn" onClick={()=>{setEditingMsgId(m.id);setEditText(m.text||"");}}>✏️</button>
                                <button className="zc-act-btn" style={{color:"#ef4444"}} onClick={()=>confirm("Delete?")&&deleteMsg(m.id)}>🗑️</button>
                              </div>}
                              {m.text&&<p style={{margin:0}}>{m.text}</p>}
                              {m.imageUrl&&<img src={m.imageUrl} style={{maxHeight:180,borderRadius:8,marginTop:m.text?6:0,cursor:"pointer"}} onClick={()=>window.open(m.imageUrl,"_blank")} alt=""/>}
                              {m.fileUrl&&!m.imageUrl&&<a href={m.fileUrl} target="_blank" rel="noopener noreferrer" className={`zc-bfile ${mine?"mine":"them"}`}><svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg><span style={{fontSize:12.5}}>{m.fileName}</span></a>}
                              {m.isEdited&&<span style={{fontSize:10,opacity:.6,display:"block",marginTop:2}}>(edited)</span>}
                            </div>
                          }
                          <div className="zc-msg-meta">
                            <span className="zc-msg-time">{m.createdAt?.toDate?.()?.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})||"Now"}</span>
                            {mine&&<span style={{fontSize:11,color:isRead?"#22c55e":"#9aa0ad"}}>{isRead?"✓✓":m.status==="delivered"?"✓✓":"✓"}</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={msgsEnd}/>
                </div>

                {/* ── INPUT ── */}
                <div className="zc-input-area">
                  {selectedFile&&(
                    <div className="zc-file-prev">
                      <svg width="13" height="13" fill="none" stroke="#6b7280" strokeWidth="2" viewBox="0 0 24 24"><path d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>
                      <span style={{flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{selectedFile.name}</span>
                      <button style={{background:"none",border:"none",cursor:"pointer",color:"#9aa0ad",fontSize:16,lineHeight:1}} onClick={()=>setSelectedFile(null)}>×</button>
                    </div>
                  )}
                  <div className="zc-input-row">
                    <button className="zc-inp-btn attach" onClick={()=>fileRef.current?.click()}>
                      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>
                    </button>
                    <textarea className="zc-input-box" placeholder="Type a message…" value={text} rows={1} disabled={uploading}
                      onChange={e=>{setText(e.target.value);handleTyping();}}
                      onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendText();}}}
                    />
                    <button className="zc-inp-btn send" disabled={(!text.trim()&&!selectedFile)||uploading} onClick={sendText}>
                      {uploading
                        ?<svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{animation:"spin 1s linear infinite"}}><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity=".25"/><path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg>
                        :<svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                      }
                    </button>
                  </div>
                </div>
              </div>
            }
          </>
        )}

        {/* ── CALLS TAB ── */}
        {tab==="calls"&&(
          <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",background:"#f0f2f5"}}>
            <div style={{textAlign:"center",color:"#9aa0ad"}}>
              <div style={{width:72,height:72,borderRadius:20,background:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,margin:"0 auto 16px",boxShadow:"0 4px 16px rgba(0,0,0,.08)"}}>📞</div>
              <div style={{fontSize:16,fontWeight:700,color:"#374151",marginBottom:6}}>Calls</div>
              <div style={{fontSize:13}}>Use the Calls module for call history and dialer</div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}