"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { triggerPushNotification } from "@/lib/notifications";

/**
 * TestPushPage
 * A simple UI to send a test push notification to the logged-in user.
 */
export default function TestPushPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const handleSendTestPush = async () => {
    if (!user) {
      setStatus("Error: You must be logged in to test.");
      return;
    }
    setLoading(true);
    setStatus(null);
    try {
      const success = await triggerPushNotification(
        user.uid,
        "Test Push Notification 🚀",
        "If you see this, Firebase Cloud Messaging push notifications are working!"
      );
      if (success) {
        setStatus("Success! Push notification request dispatched to your registered tokens.");
      } else {
        setStatus("Failed to dispatch push notification. Check server logs or verify you granted notification permissions.");
      }
    } catch (err: any) {
      setStatus(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 40, fontFamily: "sans-serif", maxWidth: 600, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: "bold", marginBottom: 16 }}>Test FCM Push Notifications</h1>
      {user ? (
        <div style={{ background: "#fff", padding: 24, borderRadius: 8, boxShadow: "0 4px 6px rgba(0,0,0,0.05)" }}>
          <p style={{ marginBottom: 8 }}>Logged in as: <strong>{user.email}</strong></p>
          <p style={{ marginBottom: 16 }}>UID: <code>{user.uid}</code></p>
          <button
            onClick={handleSendTestPush}
            disabled={loading}
            style={{
              padding: "10px 20px",
              background: "#4f46e5",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            {loading ? "Sending..." : "Send Test Push to Myself"}
          </button>
          {status && (
            <p style={{ 
              marginTop: 20, 
              padding: 12, 
              borderRadius: 6, 
              background: status.startsWith("Success") ? "#f0fdf4" : "#fef2f2",
              color: status.startsWith("Success") ? "#15803d" : "#b91c1c",
              border: `1px solid ${status.startsWith("Success") ? "#bbf7d0" : "#fecaca"}`
            }}>
              {status}
            </p>
          )}
        </div>
      ) : (
        <p style={{ color: "#ef4444" }}>Please log in to the application first, then visit this page.</p>
      )}
    </div>
  );
}
