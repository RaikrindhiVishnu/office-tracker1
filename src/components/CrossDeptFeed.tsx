// src/components/CrossDeptFeed.tsx
// Reusable cross-department activity feed panel
// Subscribes to appNotifications for a given role and renders a live feed

"use client";

import { useState, useEffect } from "react";
import { subscribeNotifications, markAllRead, type AppNotification, type NotifRole } from "@/lib/notifications";
import { useAuth } from "@/context/AuthContext";

const PRIORITY_DOT: Record<string, string> = {
  high: "#dc2626",
  medium: "#d97706",
  low: "#10b981",
};

const TYPE_ICON: Record<string, string> = {
  SALE_CREATED:      "💵",
  LEAD_WON:          "🎯",
  LEAD_CREATED:      "🌱",
  LEAD_CONVERTED:    "🔥",
  CAMPAIGN_CREATED:  "📢",
  CAMPAIGN_DELETED:  "🗑️",
  TICKET_ESCALATED:  "🚨",
  TICKET_RESOLVED:   "✅",
  EXPENSE_ADDED:     "🧾",
  PAYROLL_PROCESSED: "💰",
  EMPLOYEE_ADDED:    "👤",
  LEAVE_APPROVED:    "✅",
  ANNOUNCEMENT:      "📣",
  LOW_CTR_ALERT:     "⚠️",
};

function timeAgo(ts: any): string {
  if (!ts?.toDate) return "just now";
  const diff = Date.now() - ts.toDate().getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

interface CrossDeptFeedProps {
  role: NotifRole;
  accentColor?: string;
  maxItems?: number;
  /** If true, renders as a compact sidebar widget. Otherwise full card. */
  compact?: boolean;
  title?: string;
  filterType?: string;
}

export default function CrossDeptFeed({
  role,
  accentColor = "#4f46e5",
  maxItems = 8,
  compact = false,
  title = "Cross-Dept Activity",
  filterType,
}: CrossDeptFeedProps) {
  const { user } = useAuth();
  const [notifs, setNotifs] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "high" | "unread">("all");

  const uid = user?.uid ?? "";

  useEffect(() => {
    const unsub = subscribeNotifications(role, (data) => {
      setNotifs(data);
      setLoading(false);
    });
    return unsub;
  }, [role]);

  const filtered = notifs
    .filter(n => {
      if (filterType && n.type !== filterType) return false;
      if (filter === "high") return n.priority === "high";
      if (filter === "unread") return !n.readBy?.includes(uid);
      return true;
    })
    .slice(0, maxItems);

  const unreadCount = notifs.filter(n => !n.readBy?.includes(uid)).length;

  const bg = "#ffffff";
  const border = "#e2e8f0";
  const textMuted = "#94a3b8";

  return (
    <div style={{
      background: bg,
      border: `1px solid ${border}`,
      borderRadius: 16,
      overflow: "hidden",
      boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
    }}>
      {/* Header */}
      <div style={{
        padding: compact ? "12px 16px" : "16px 20px",
        borderBottom: `1px solid ${border}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        background: `${accentColor}06`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>🔗</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>{title}</div>
            {!compact && <div style={{ fontSize: 10, color: textMuted, marginTop: 1 }}>Live feed from all departments</div>}
          </div>
          {unreadCount > 0 && (
            <span style={{
              background: accentColor,
              color: "#fff",
              fontSize: 10,
              fontWeight: 800,
              padding: "2px 8px",
              borderRadius: 20,
            }}>
              {unreadCount} new
            </span>
          )}
        </div>

        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {(["all", "high", "unread"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: "3px 10px",
                fontSize: 10,
                fontWeight: 700,
                borderRadius: 20,
                border: `1px solid ${filter === f ? accentColor : border}`,
                background: filter === f ? accentColor : "transparent",
                color: filter === f ? "#fff" : textMuted,
                cursor: "pointer",
                textTransform: "capitalize",
              }}
            >
              {f}
            </button>
          ))}
          {unreadCount > 0 && (
            <button
              onClick={() => markAllRead(notifs, uid)}
              style={{
                padding: "3px 10px",
                fontSize: 10,
                fontWeight: 700,
                borderRadius: 20,
                border: `1px solid ${border}`,
                background: "transparent",
                color: textMuted,
                cursor: "pointer",
              }}
            >
              Mark read
            </button>
          )}
        </div>
      </div>

      {/* Feed */}
      <div style={{
        maxHeight: compact ? 280 : 400,
        overflowY: "auto",
      }}>
        {loading ? (
          <div style={{ padding: 24, textAlign: "center", color: textMuted, fontSize: 12 }}>
            Loading activity…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: compact ? 20 : 32, textAlign: "center" }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>🤝</div>
            <div style={{ fontSize: 12, color: textMuted }}>No cross-dept events yet</div>
            <div style={{ fontSize: 11, color: textMuted, marginTop: 4 }}>
              Events from Sales, Finance, Support & Marketing will appear here
            </div>
          </div>
        ) : filtered.map(n => {
          const isRead = n.readBy?.includes(uid);
          const icon = TYPE_ICON[n.type] || n.icon || "📌";
          const dotColor = PRIORITY_DOT[n.priority] || textMuted;
          return (
            <div
              key={n.id}
              style={{
                padding: compact ? "10px 16px" : "14px 20px",
                borderBottom: `1px solid #f8fafc`,
                display: "flex",
                gap: 12,
                alignItems: "flex-start",
                background: isRead ? "transparent" : `${accentColor}05`,
                transition: "background 0.15s",
              }}
            >
              {/* Icon */}
              <div style={{
                width: compact ? 32 : 36,
                height: compact ? 32 : 36,
                borderRadius: 10,
                background: `${dotColor}12`,
                border: `1px solid ${dotColor}22`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: compact ? 14 : 16,
                flexShrink: 0,
              }}>
                {icon}
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: compact ? 11 : 12,
                  fontWeight: isRead ? 600 : 800,
                  color: "#0f172a",
                  marginBottom: 2,
                }}>
                  {n.title}
                </div>
                <div style={{
                  fontSize: compact ? 10 : 11,
                  color: "#475569",
                  lineHeight: 1.5,
                  overflow: "hidden",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                } as React.CSSProperties}>
                  {n.message}
                </div>
                <div style={{
                  fontSize: 10,
                  color: textMuted,
                  marginTop: 4,
                  display: "flex",
                  gap: 6,
                  alignItems: "center",
                }}>
                  <span style={{
                    padding: "1px 6px",
                    borderRadius: 4,
                    background: `${dotColor}12`,
                    color: dotColor,
                    fontWeight: 700,
                  }}>
                    {n.priority}
                  </span>
                  <span>{n.createdBy}</span>
                  <span>·</span>
                  <span>{timeAgo(n.createdAt)}</span>
                  {!isRead && (
                    <span style={{
                      marginLeft: "auto",
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: accentColor,
                      flexShrink: 0,
                    }} />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      {!loading && notifs.length > 0 && (
        <div style={{
          padding: "10px 16px",
          borderTop: `1px solid ${border}`,
          textAlign: "center",
        }}>
          <span style={{ fontSize: 10, color: textMuted }}>
            {notifs.length} total events across all departments
          </span>
        </div>
      )}
    </div>
  );
}
