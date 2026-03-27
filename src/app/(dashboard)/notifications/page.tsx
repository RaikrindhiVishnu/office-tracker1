"use client";

import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
  doc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

type Notification = {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  isRead: boolean;
  createdAt: any;
};

export default function NotificationsPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "notifications"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Notification[];

      setNotifications(data);
    });

    return () => unsubscribe();
  }, [user]);

  // Mark as read
  const markAsRead = async (id: string) => {
    await updateDoc(doc(db, "notifications", id), {
      isRead: true,
    });
  };

  return (
    <div style={{ padding: "24px" }}>
      <h1 style={{ fontSize: "24px", fontWeight: "bold" }}>
        🔔 Notifications
      </h1>

      <div style={{ marginTop: "20px" }}>
        {notifications.length === 0 && (
          <p>No notifications found</p>
        )}

        {notifications.map((n) => (
          <div
            key={n.id}
            onClick={() => markAsRead(n.id)}
            style={{
              padding: "16px",
              marginBottom: "12px",
              borderRadius: "10px",
              background: n.isRead ? "#f3f4f6" : "#e0f2fe",
              cursor: "pointer",
              border: "1px solid #ddd",
            }}
          >
            <h3 style={{ margin: 0 }}>{n.title}</h3>
            <p style={{ margin: "4px 0" }}>{n.message}</p>

            <small style={{ color: "#666" }}>
              {n.createdAt?.toDate?.().toLocaleString?.() || ""}
            </small>

            {!n.isRead && (
              <span
                style={{
                  color: "red",
                  fontSize: "12px",
                  marginLeft: "10px",
                }}
              >
                ● Unread
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}