"use client";

import MeetChatApp from "@/components/MeetChatAppUpdated";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";

export default function MeetPage() {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    const snap = await getDocs(collection(db, "users"));

    const list = snap.docs.map(doc => ({
      uid: doc.id,
      ...doc.data(),
    }));

    setUsers(list);
  };

  return (
    <div className="h-screen w-screen bg-slate-900">
      <MeetChatApp
        users={users}
        isOpen={true}
        onClose={() => window.close()} // closes tab
      />
    </div>
  );
}
