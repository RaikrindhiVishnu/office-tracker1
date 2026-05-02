"use client";
import { useState, useEffect, useRef } from "react";
import {
  subscribeNotifications,
  markAllRead,
  type AppNotification,
  type NotifRole
} from "@/lib/notifications";
import { FaBell, FaBellSlash } from "react-icons/fa";

const PRIORITY_COLOR: Record<string, string> = {
  high: "#dc2626",
  medium: "#d97706",
  low: "#64748b",
};

function timeAgo(ts: any): string {
  if (!ts?.toDate) return "";
  const diff = Date.now() - ts.toDate().getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

interface Props {
  role: NotifRole;
  uid: string;            // current user's uid (for readBy tracking)
  accentColor?: string;   // e.g. "#4f46e5" for sales, "#0891b2" for HR
}

export default function NotificationBell({ role, uid, accentColor = "#4f46e5" }: Props) {
  const [notifs, setNotifs]   = useState<AppNotification[]>([]);
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = subscribeNotifications(role, (data) => {
      setNotifs(data);
      setLoading(false);
    });
    return unsub;
  }, [role]);

  // Close on outside click
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  const unread = notifs.filter(n => !n.readBy?.includes(uid)).length;

  const handleOpen = () => {
    setOpen(o => !o);
  };

  const handleMarkAllRead = async () => {
    await markAllRead(notifs, uid);
  };

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      {/* Bell button */}
      <button
        onClick={handleOpen}
        style={{
          position: "relative",
          width: 38, height: 38,
          borderRadius: 10,
          background: open ? accentColor + "14" : "#f8fafc",
          border: `1px solid ${open ? accentColor + "44" : "#e2e8f0"}`,
          cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 17,
          transition: "all 0.15s",
        }}
        title="Notifications"
      >
        <FaBell />
        {unread > 0 && (
          <span style={{
            position: "absolute",
            top: -4, right: -4,
            width: 18, height: 18,
            borderRadius: "50%",
            background: "#dc2626",
            color: "#fff",
            fontSize: 10,
            fontWeight: 800,
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "2px solid #fff",
            fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 8px)",
          right: 0,
          width: 340,
          maxHeight: 460,
          background: "#fff",
          border: "1.5px solid #e2e8f0",
          borderRadius: 16,
          boxShadow: "0 16px 48px rgba(0,0,0,0.12)",
          display: "flex",
          flexDirection: "column",
          zIndex: 9999,
          overflow: "hidden",
        }}>
          {/* Header */}
          <div style={{
            padding: "14px 16px",
            borderBottom: "1px solid #f1f5f9",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
                Notifications
              </span>
              {unread > 0 && (
                <span style={{
                  background: accentColor + "18",
                  color: accentColor,
                  fontSize: 10, fontWeight: 800,
                  padding: "2px 8px", borderRadius: 20,
                }}>
                  {unread} new
                </span>
              )}
            </div>
            {unread > 0 && (
              <button
                onClick={handleMarkAllRead}
                style={{
                  fontSize: 11, color: accentColor, fontWeight: 700,
                  background: "none", border: "none", cursor: "pointer",
                  fontFamily: "'Plus Jakarta Sans',sans-serif",
                }}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ overflowY: "auto", flex: 1 }}>
            {loading ? (
              <div style={{ padding: 32, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>Loading…</div>
            ) : notifs.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center" }}>
                <div style={{ fontSize: 32, marginBottom: 8, color: "#94a3b8" }}><FaBellSlash /></div>
                <div style={{ fontSize: 13, color: "#94a3b8" }}>No notifications yet</div>
              </div>
            ) : notifs.map(n => {
              const isRead = n.readBy?.includes(uid);
              return (
                <div
                  key={n.id}
                  style={{
                    padding: "12px 16px",
                    borderBottom: "1px solid #f8fafc",
                    background: isRead ? "transparent" : accentColor + "06",
                    display: "flex",
                    gap: 12,
                    alignItems: "flex-start",
                  }}
                >
                  {/* Icon circle */}
                  <div style={{
                    width: 36, height: 36,
                    borderRadius: 10,
                    background: PRIORITY_COLOR[n.priority] + "12",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 16,
                    flexShrink: 0,
                  }}>
                    {n.icon}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6 }}>
                      <span style={{
                        fontSize: 12, fontWeight: isRead ? 600 : 800,
                        color: "#0f172a",
                        fontFamily: "'Plus Jakarta Sans',sans-serif",
                      }}>
                        {n.title}
                      </span>
                      {!isRead && (
                        <span style={{
                          width: 7, height: 7,
                          borderRadius: "50%",
                          background: accentColor,
                          flexShrink: 0,
                          marginTop: 3,
                        }} />
                      )}
                    </div>
                    <div style={{
                      fontSize: 11, color: "#64748b",
                      marginTop: 2, lineHeight: 1.5,
                    }}>
                      {n.message}
                    </div>
                    <div style={{
                      fontSize: 10, color: "#94a3b8",
                      marginTop: 4, display: "flex", gap: 8,
                    }}>
                      <span>{n.createdBy}</span>
                      <span>·</span>
                      <span>{timeAgo(n.createdAt)}</span>
                      <span style={{
                        marginLeft: "auto",
                        padding: "1px 6px",
                        borderRadius: 4,
                        background: PRIORITY_COLOR[n.priority] + "14",
                        color: PRIORITY_COLOR[n.priority],
                        fontWeight: 700,
                      }}>
                        {n.priority}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          {notifs.length > 0 && (
            <div style={{
              padding: "10px 16px",
              borderTop: "1px solid #f1f5f9",
              textAlign: "center",
              flexShrink: 0,
            }}>
              <span style={{ fontSize: 11, color: "#94a3b8" }}>
                {notifs.length} total notifications for {role}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}