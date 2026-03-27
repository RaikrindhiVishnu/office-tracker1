"use client";

// src/hooks/useNotifications.ts + src/components/common/NotificationBell.tsx
// Split into two exports from one file for convenience.
// In your project, split into separate files if preferred.

// ═══════════════════════════════════════════════════════════════
//  HOOK  — src/hooks/useNotifications.ts
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
  doc,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Notification } from "@/types/leave";

interface UseNotificationsReturn {
  notifications : Notification[];
  unreadCount   : number;
  loading       : boolean;
  markAsRead    : (id: string) => Promise<void>;
  markAllRead   : () => Promise<void>;
}

export function useNotifications(uid: string | undefined): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading,       setLoading]       = useState<boolean>(true);

  useEffect(() => {
    if (!uid) { setLoading(false); return; }

    const q = query(
      collection(db, "notifications"),
      where("uid", "==", uid),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        setNotifications(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Notification, "id">) }))
        );
        setLoading(false);
      },
      (err) => {
        console.error("useNotifications:", err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [uid]);

  async function markAsRead(id: string): Promise<void> {
    await updateDoc(doc(db, "notifications", id), { read: true });
  }

  async function markAllRead(): Promise<void> {
    const unread = notifications.filter((n) => !n.read);
    if (!unread.length) return;
    const batch = writeBatch(db);
    unread.forEach((n) => batch.update(doc(db, "notifications", n.id), { read: true }));
    await batch.commit();
  }

  return {
    notifications,
    unreadCount : notifications.filter((n) => !n.read).length,
    loading,
    markAsRead,
    markAllRead,
  };
}

// ═══════════════════════════════════════════════════════════════
//  COMPONENT  — src/components/common/NotificationBell.tsx
// ═══════════════════════════════════════════════════════════════

import { useState as useStateC } from "react";
import { useAuth } from "@/context/AuthContext";

export function NotificationBell(): JSX.Element {
  const { user } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllRead } =
    useNotifications(user?.uid);

  const [open, setOpen] = useStateC<boolean>(false);

  function formatTs(ts: Notification["createdAt"]): string {
    if (!ts?.toDate) return "";
    return ts.toDate().toLocaleString("en-IN", {
      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    });
  }

  return (
    <div style={{ position: "relative", display: "inline-block" }}>

      {/* Bell button */}
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          position   : "relative",
          background : "none",
          border     : "none",
          cursor     : "pointer",
          fontSize   : 22,
          padding    : "4px 8px",
          lineHeight : 1,
        }}
        aria-label="Notifications"
      >
        🔔
        {unreadCount > 0 && (
          <span style={{
            position     : "absolute",
            top          : 0,
            right        : 0,
            background   : "#be123c",
            color        : "#fff",
            borderRadius : "50%",
            width        : 18,
            height       : 18,
            fontSize     : 10,
            fontWeight   : 800,
            display      : "flex",
            alignItems   : "center",
            justifyContent: "center",
            lineHeight   : 1,
          }}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            style={{ position: "fixed", inset: 0, zIndex: 999 }}
            onClick={() => setOpen(false)}
          />
          <div style={{
            position     : "absolute",
            right        : 0,
            top          : "calc(100% + 8px)",
            width        : 340,
            maxHeight    : 420,
            overflowY    : "auto",
            background   : "#fff",
            borderRadius : 16,
            boxShadow    : "0 12px 48px rgba(0,0,0,0.15)",
            border       : "1px solid #e2e8f0",
            zIndex       : 1000,
          }}>

            {/* Header */}
            <div style={{
              display        : "flex",
              alignItems     : "center",
              justifyContent : "space-between",
              padding        : "14px 16px 10px",
              borderBottom   : "1px solid #f1f5f9",
              position       : "sticky",
              top            : 0,
              background     : "#fff",
            }}>
              <span style={{ fontWeight: 800, fontSize: 14, color: "#0f172a" }}>
                Notifications {unreadCount > 0 && `(${unreadCount})`}
              </span>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  style={{ background: "none", border: "none", fontSize: 12, color: "#143d3d", fontWeight: 600, cursor: "pointer" }}
                >
                  Mark all read
                </button>
              )}
            </div>

            {/* Items */}
            {notifications.length === 0 ? (
              <div style={{ padding: "32px 16px", textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
                No notifications yet
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => markAsRead(n.id)}
                  style={{
                    padding    : "12px 16px",
                    borderBottom: "1px solid #f1f5f9",
                    background : n.read ? "#fff" : "#f0fdf4",
                    cursor     : n.read ? "default" : "pointer",
                    transition : "background 0.2s",
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 13, color: "#0f172a" }}>{n.title}</div>
                  <div style={{ fontSize: 12, color: "#475569", marginTop: 3, lineHeight: 1.5 }}>{n.message}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{formatTs(n.createdAt)}</div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}