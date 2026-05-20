// public/firebase-messaging-sw.js

// Import Firebase compat SDKs for service worker environment
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

// Retrieve configuration parameters passed via the registration URL query string
const urlParams = new URLSearchParams(location.search);
const apiKey = urlParams.get("apiKey");
const authDomain = urlParams.get("authDomain");
const projectId = urlParams.get("projectId");
const storageBucket = urlParams.get("storageBucket");
const messagingSenderId = urlParams.get("messagingSenderId");
const appId = urlParams.get("appId");

if (apiKey && projectId && messagingSenderId && appId) {
  firebase.initializeApp({
    apiKey,
    authDomain,
    projectId,
    storageBucket,
    messagingSenderId,
    appId,
  });

  const messaging = firebase.messaging();

  // Background message event handler
  messaging.onBackgroundMessage((payload) => {
    console.log("[firebase-messaging-sw.js] Received background message:", payload);

    const title = payload.notification?.title || payload.data?.title || "Office Tracker Notification";
    const body = payload.notification?.body || payload.data?.body || "";
    const icon = payload.notification?.icon || payload.data?.icon || "/logo.svg";

    // Build notification options
    const notificationOptions = {
      body: body,
      icon: icon,
      data: payload.data || {},
      badge: "/logo.svg", // Optional small icon
    };

    self.registration.showNotification(title, notificationOptions);
  });
} else {
  console.warn("[firebase-messaging-sw.js] Firebase config params are missing in registration URL.");
}
