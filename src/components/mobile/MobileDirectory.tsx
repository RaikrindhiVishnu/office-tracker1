"use client";

import React, { useState, useEffect } from "react";
import { collection, query, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Search, Mail, Phone, MapPin, Building2, UserCircle2, MessageSquare } from "lucide-react";

const Avatar = ({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) => {
  const initials = name
    .split(" ")
    .map(n => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();
    
  const sizeClass = size === "sm" ? "w-8 h-8 text-xs" : size === "md" ? "w-10 h-10 text-sm" : "w-12 h-12 text-base";
  
  return (
    <div className={`${sizeClass} rounded-full bg-gradient-to-tr from-indigo-500 to-violet-500 text-white flex items-center justify-center font-bold shadow-sm`}>
      {initials}
    </div>
  );
};

export const MobileDirectory = ({ user }: { user: any }) => {
  const [users, setUsers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const snap = await getDocs(query(collection(db, "users")));
        setUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() })));
      } catch (err) {
        console.error("Error fetching directory:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  const filteredUsers = users.filter(u => 
    u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.department?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "online": return "bg-emerald-500 border-white";
      case "away": return "bg-amber-500 border-white";
      case "offline": return "bg-gray-400 border-white";
      default: return "bg-emerald-500 border-white";
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Search Header */}
      <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm sticky top-0 z-10">
        <h2 className="text-sm font-black text-gray-900 mb-3 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-indigo-600" />
          Company Directory
        </h2>
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, email, or department..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xs font-medium"
          />
        </div>
      </div>

      {/* Directory List */}
      <div className="flex flex-col gap-3">
        {loading ? (
          <div className="text-center py-10">
            <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Loading Directory...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-10 bg-white rounded-3xl border border-gray-100 p-6">
            <UserCircle2 className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-bold text-gray-500">No colleagues found</p>
          </div>
        ) : (
          filteredUsers.map((u) => (
            <div key={u.uid} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex items-center justify-between group active:scale-[0.98] transition-all">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Avatar name={u.name || "Unknown"} size="md" />
                  <div className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 ${getStatusColor(u.status || "online")}`} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">{u.name || "Colleague"}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-md">
                      {u.department || "Operations"}
                    </span>
                    {u.designation && (
                      <span className="text-[10px] text-gray-400 truncate max-w-[100px]">{u.designation}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <a href={`mailto:${u.email}`} className="p-2.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl transition-colors">
                  <Mail className="w-4 h-4" />
                </a>
                <button className="p-2.5 bg-gray-50 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
                  <MessageSquare className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
