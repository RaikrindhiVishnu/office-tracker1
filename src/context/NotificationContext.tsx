// src/context/NotificationContext.tsx

"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Notification } from "@/lib/notifications";
import {
  NotificationPreferences,
  getPreferences,
  updatePreferences as savePrefsToDb,
} from "@/lib/notificationPreferences";
import { NotificationCategory } from "@/lib/notificationTypes";

export interface ToastItem {
  id: string;
  title: string;
  message: string;
  category: NotificationCategory;
  priority: "low" | "medium" | "high" | "emergency";
  clickAction?: string;
  actionButtons?: { action: string; title: string }[];
  duration?: number;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  unreadByCategory: Record<NotificationCategory, number>;
  loading: boolean;
  preferences: NotificationPreferences | null;
  loadPreferences: () => Promise<void>;
  updatePreferences: (prefs: Partial<NotificationPreferences>) => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  bulkMarkRead: (ids: string[]) => Promise<void>;
  bulkDelete: (ids: string[]) => Promise<void>;
  toastQueue: ToastItem[];
  showToast: (toast: Omit<ToastItem, "id">) => void;
  dismissToast: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [toastQueue, setToastQueue] = useState<ToastItem[]>([]);

  // 1. Listen for realtime notifications
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, "notifications"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const notifs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Notification[];
        setNotifications(notifs);
        setLoading(false);
      },
      (error) => {
        console.error("[NotificationContext] Error loading notifications:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // 2. Load preferences
  const loadPreferences = useCallback(async () => {
    if (!user) return;
    try {
      const prefs = await getPreferences(user.uid);
      setPreferences(prefs);
    } catch (e) {
      console.error("[NotificationContext] Failed to load preferences:", e);
    }
  }, [user]);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  // 3. Update preferences
  const updatePreferences = async (newPrefs: Partial<NotificationPreferences>) => {
    if (!user) return;
    try {
      await savePrefsToDb(user.uid, newPrefs);
      setPreferences((prev) => (prev ? { ...prev, ...newPrefs } : null));
    } catch (e) {
      console.error("[NotificationContext] Failed to save preferences:", e);
      throw e;
    }
  };

  // 4. Notification actions
  const markAsRead = async (id: string) => {
    try {
      const docRef = doc(db, "notifications", id);
      await updateDoc(docRef, { isRead: true });
    } catch (e) {
      console.error("[NotificationContext] Failed to mark as read:", e);
    }
  };

  const markAllRead = async () => {
    if (!user) return;
    const unread = notifications.filter((n) => !n.isRead);
    if (!unread.length) return;
    try {
      const batch = writeBatch(db);
      unread.forEach((n) => {
        batch.update(doc(db, "notifications", n.id), { isRead: true });
      });
      await batch.commit();
    } catch (e) {
      console.error("[NotificationContext] Failed to mark all read:", e);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      const docRef = doc(db, "notifications", id);
      await deleteDoc(docRef);
    } catch (e) {
      console.error("[NotificationContext] Failed to delete notification:", e);
    }
  };

  const bulkMarkRead = async (ids: string[]) => {
    if (!ids.length) return;
    try {
      const batch = writeBatch(db);
      ids.forEach((id) => {
        batch.update(doc(db, "notifications", id), { isRead: true });
      });
      await batch.commit();
    } catch (e) {
      console.error("[NotificationContext] Failed bulk mark read:", e);
    }
  };

  const bulkDelete = async (ids: string[]) => {
    if (!ids.length) return;
    try {
      const batch = writeBatch(db);
      ids.forEach((id) => {
        batch.delete(doc(db, "notifications", id));
      });
      await batch.commit();
    } catch (e) {
      console.error("[NotificationContext] Failed bulk delete:", e);
    }
  };

  // 5. Toast Queue actions
  const showToast = useCallback((toast: Omit<ToastItem, "id">) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToastQueue((prev) => [...prev, { ...toast, id }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToastQueue((prev) => prev.filter((item) => item.id !== id));
  }, []);

  // Compute unread counts
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const unreadByCategory = notifications.reduce((acc, n) => {
    if (!n.isRead && n.category) {
      acc[n.category] = (acc[n.category] || 0) + 1;
    }
    return acc;
  }, {} as Record<NotificationCategory, number>);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        unreadByCategory,
        loading,
        preferences,
        loadPreferences,
        updatePreferences,
        markAsRead,
        markAllRead,
        deleteNotification,
        bulkMarkRead,
        bulkDelete,
        toastQueue,
        showToast,
        dismissToast,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return context;
};
