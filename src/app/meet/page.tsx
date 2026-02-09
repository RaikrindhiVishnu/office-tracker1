"use client";

import MeetChatApp from "@/components/MeetChatAppUpdated";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";

/* ================= TYPES ================= */

type User = {
  uid: string;
  email: string;
  name?: string;
  profilePhoto?: string;
};

/* ================= PAGE ================= */

export default function MeetPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const snap = await getDocs(collection(db, "users"));

      const list: User[] = snap.docs.map((doc) => {
        const data = doc.data() as Partial<User>;

        return {
          uid: doc.id,
          email: data.email ?? "", // prevents TS crash
          name: data.name ?? "Unknown User",
          profilePhoto: data.profilePhoto ?? "",
        };
      });

      setUsers(list);
    } catch (error) {
      console.error("Failed to load users:", error);
    } finally {
      setLoading(false);
    }
  };

  /* ================= UI ================= */

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-900 text-white">
        Loading meeting users...
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-slate-900">
      <MeetChatApp
        users={users}
        isOpen={true}
        onClose={() => window.close()}
      />
    </div>
  );
}
