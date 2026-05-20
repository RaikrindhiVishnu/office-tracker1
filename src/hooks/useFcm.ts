import { useEffect, useState } from "react";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { getToken } from "firebase/messaging";
import { db, getFcmMessaging, firebaseConfig } from "@/lib/firebase";

export function useFcm(userId: string | undefined) {
  const [token, setToken] = useState<string | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>("default");

  useEffect(() => {
    if (!userId || typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    const setupFcm = async () => {
      try {
        const messagingInstance = await getFcmMessaging();
        if (!messagingInstance) {
          console.warn("[FCM] Messaging is not supported in this browser context.");
          return;
        }

        // Get VAPID key from env
        const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
        if (!vapidKey) {
          console.warn("[FCM] NEXT_PUBLIC_FIREBASE_VAPID_KEY is missing. Push token retrieval is skipped.");
          return;
        }

        // 1. Check & request permission
        let permissionStatus = Notification.permission;
        setPermission(permissionStatus);

        if (permissionStatus === "denied") {
          console.warn("[FCM] Notification permission has been denied by the user.");
          return;
        }

        if (permissionStatus === "default") {
          permissionStatus = await Notification.requestPermission();
          setPermission(permissionStatus);
          if (permissionStatus !== "granted") {
            console.warn("[FCM] Notification permission was not granted.");
            return;
          }
        }

        // 2. Register service worker with config query string
        const queryParams = new URLSearchParams(
          Object.entries(firebaseConfig).reduce((acc, [key, val]) => {
            if (val) acc[key] = val as string;
            return acc;
          }, {} as Record<string, string>)
        ).toString();

        const swUrl = `/firebase-messaging-sw.js?${queryParams}`;
        const registration = await navigator.serviceWorker.register(swUrl);

        // 3. Wait for the service worker to become active before getting the token
        //    This fixes: "Subscription failed - no active Service Worker"
        await waitForServiceWorkerActive(registration);

        // 4. Get FCM Token
        const currentToken = await getToken(messagingInstance, {
          serviceWorkerRegistration: registration,
          vapidKey: vapidKey,
        });

        if (currentToken) {
          setToken(currentToken);

          // Save token to users/{userId}/fcmTokens/{token} in Firestore
          const tokenRef = doc(db, "users", userId, "fcmTokens", currentToken);
          await setDoc(tokenRef, {
            token: currentToken,
            deviceType: /Mobi|Android|iPhone/i.test(navigator.userAgent) ? "mobile" : "desktop",
            updatedAt: serverTimestamp(),
          });
          console.log("[FCM] Token stored successfully in Firestore:", currentToken);
        } else {
          console.warn("[FCM] No registration token received.");
        }
      } catch (error) {
        console.error("[FCM] Error setting up FCM:", error);
      }
    };

    setupFcm();
  }, [userId]);

  return { token, permission };
}

/**
 * Waits until a ServiceWorkerRegistration has an active worker.
 * Resolves immediately if already active, otherwise waits for the
 * updatefound / statechange events or falls back to navigator.serviceWorker.ready.
 */
function waitForServiceWorkerActive(
  registration: ServiceWorkerRegistration
): Promise<void> {
  return new Promise((resolve) => {
    // Already active — resolve immediately
    if (registration.active) {
      resolve();
      return;
    }

    // Waiting or installing — listen for state changes
    const sw = registration.installing || registration.waiting;
    if (sw) {
      sw.addEventListener("statechange", function handler() {
        if (sw.state === "activated") {
          sw.removeEventListener("statechange", handler);
          resolve();
        }
      });
      return;
    }

    // Fallback: navigator.serviceWorker.ready always resolves when SW is active
    navigator.serviceWorker.ready.then(() => resolve());
  });
}
