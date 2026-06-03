// src/lib/notificationPreferences.ts

import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import { NotificationCategory, NotificationPriority } from "./notificationTypes";

export interface CategoryPreference {
  enabled: boolean;
  sound: boolean;
  vibrate: boolean;
}

export interface QuietHours {
  enabled: boolean;
  from: string; // e.g. "22:00"
  to: string;   // e.g. "08:00"
  timezone: string;
}

export interface NotificationPreferences {
  userId: string;
  categories: Record<NotificationCategory, CategoryPreference>;
  quietHours: QuietHours;
  doNotDisturb: boolean;
  emailEnabled: boolean;
  pushEnabled: boolean;
  whatsappEnabled: boolean;
}

const DEFAULT_CATEGORIES = [
  "attendance",
  "leave",
  "task",
  "meeting",
  "message",
  "emergency",
  "ai",
  "productivity",
  "system",
] as const;

export const DEFAULT_PREFERENCES = (userId: string): NotificationPreferences => ({
  userId,
  categories: DEFAULT_CATEGORIES.reduce((acc, cat) => {
    // Emergency and system default to sound/vibrate on
    const isHighImportance = cat === "emergency" || cat === "system";
    acc[cat] = {
      enabled: true,
      sound: isHighImportance,
      vibrate: isHighImportance,
    };
    return acc;
  }, {} as Record<NotificationCategory, CategoryPreference>),
  quietHours: {
    enabled: false,
    from: "22:00",
    to: "08:00",
    timezone: "Asia/Kolkata",
  },
  doNotDisturb: false,
  emailEnabled: true,
  pushEnabled: true,
  whatsappEnabled: false,
});

export async function getPreferences(userId: string): Promise<NotificationPreferences> {
  try {
    const docRef = doc(db, "notificationPreferences", userId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      // Ensure merged with default prefs to prevent missing fields
      const defaults = DEFAULT_PREFERENCES(userId);
      return {
        ...defaults,
        ...data,
        categories: {
          ...defaults.categories,
          ...(data.categories || {}),
        },
        quietHours: {
          ...defaults.quietHours,
          ...(data.quietHours || {}),
        },
      } as NotificationPreferences;
    }
  } catch (error) {
    console.error("[NotificationPreferences] Error fetching preferences:", error);
  }
  return DEFAULT_PREFERENCES(userId);
}

export async function updatePreferences(
  userId: string,
  prefs: Partial<NotificationPreferences>
): Promise<void> {
  try {
    const docRef = doc(db, "notificationPreferences", userId);
    await setDoc(docRef, { ...prefs, userId }, { merge: true });
  } catch (error) {
    console.error("[NotificationPreferences] Error updating preferences:", error);
    throw error;
  }
}

export function isInQuietHours(quietHours: QuietHours): boolean {
  if (!quietHours.enabled) return false;

  try {
    // Parse time in the configured timezone
    const now = new Date();
    // Convert current time to local time in the specified timezone
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: quietHours.timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const hourPart = parts.find((p) => p.type === "hour")?.value;
    const minPart = parts.find((p) => p.type === "minute")?.value;

    if (!hourPart || !minPart) return false;

    const currentMinutes = parseInt(hourPart, 10) * 60 + parseInt(minPart, 10);

    const [fromHour, fromMin] = quietHours.from.split(":").map((v) => parseInt(v, 10));
    const [toHour, toMin] = quietHours.to.split(":").map((v) => parseInt(v, 10));

    const fromMinutes = fromHour * 60 + fromMin;
    const toMinutes = toHour * 60 + toMin;

    if (fromMinutes <= toMinutes) {
      return currentMinutes >= fromMinutes && currentMinutes <= toMinutes;
    } else {
      // Overlap midnight (e.g. 22:00 to 08:00)
      return currentMinutes >= fromMinutes || currentMinutes <= toMinutes;
    }
  } catch (e) {
    console.error("[NotificationPreferences] Error calculating quiet hours:", e);
    return false;
  }
}

export async function shouldNotify(
  userId: string,
  category: NotificationCategory,
  priority: NotificationPriority
): Promise<{
  showNotification: boolean;
  sendPush: boolean;
  sendEmail: boolean;
  sendWhatsApp: boolean;
  sound: boolean;
  vibrate: boolean;
}> {
  // Emergency overrides all blocks (DND, Quiet Hours) except if user completely disables it (rare)
  const isEmergency = priority === "emergency" || category === "emergency";

  const prefs = await getPreferences(userId);

  if (prefs.doNotDisturb && !isEmergency) {
    return {
      showNotification: false,
      sendPush: false,
      sendEmail: false,
      sendWhatsApp: false,
      sound: false,
      vibrate: false,
    };
  }

  const categoryPref = prefs.categories[category] || { enabled: true, sound: true, vibrate: true };

  if (!categoryPref.enabled && !isEmergency) {
    return {
      showNotification: false,
      sendPush: false,
      sendEmail: false,
      sendWhatsApp: false,
      sound: false,
      vibrate: false,
    };
  }

  const quiet = !isEmergency && isInQuietHours(prefs.quietHours);

  return {
    showNotification: true,
    sendPush: prefs.pushEnabled && !quiet,
    sendEmail: prefs.emailEnabled && !quiet,
    sendWhatsApp: prefs.whatsappEnabled && !quiet,
    sound: categoryPref.sound && !quiet,
    vibrate: categoryPref.vibrate && !quiet,
  };
}
