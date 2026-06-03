// public/firebase-messaging-sw.js

// Import standard Firebase scripts
importScripts("https://www.gstatic.com/firebasejs/10.8.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.8.1/firebase-messaging-compat.js");

// Extract Firebase Config from query string
const urlParams = new URLSearchParams(location.search);
const firebaseConfig = {
  apiKey: urlParams.get("apiKey"),
  authDomain: urlParams.get("authDomain"),
  projectId: urlParams.get("projectId"),
  storageBucket: urlParams.get("storageBucket"),
  messagingSenderId: urlParams.get("messagingSenderId"),
  appId: urlParams.get("appId"),
};

// Only initialize if we have the config
if (firebaseConfig.projectId) {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  // Handle background messages
  messaging.onBackgroundMessage((payload) => {
    console.log("[FCM-SW] Received background message:", payload);

    const notificationTitle =
      payload.notification?.title || payload.data?.title || "Office Tracker";
    
    const notificationOptions = {
      body: payload.notification?.body || payload.data?.body || "",
      icon: "/logo-black.png",
      badge: "/logo-black.png",
      data: {
        clickAction: payload.data?.clickAction || "/mobile",
        category: payload.data?.category,
      },
      requireInteraction: payload.data?.priority === "high",
    };

    // Emergency parsing
    if (payload.data?.priority === "emergency" || payload.data?.priority === "high") {
      notificationOptions.requireInteraction = true;
      notificationOptions.vibrate = [500, 250, 500, 250, 500]; // Loud vibration pattern
    }

    // Action buttons if any
    if (payload.data?.actionButtons) {
      try {
        const parsed = JSON.parse(payload.data.actionButtons);
        if (Array.isArray(parsed) && parsed.length > 0) {
          notificationOptions.actions = parsed.map(btn => ({
            action: btn.action,
            title: btn.label
          }));
        }
      } catch(e) {}
    }

    self.registration.showNotification(notificationTitle, notificationOptions);
  });
}

// Handle notification click to focus/open the correct window
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const clickAction = event.notification.data?.clickAction || "/mobile";
  
  // Find if there is already a window open
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // Check if there is already a window/tab open with the target URL
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(clickAction) && "focus" in client) {
          return client.focus();
        }
      }
      // If no window/tab is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(clickAction);
      }
    })
  );
});
