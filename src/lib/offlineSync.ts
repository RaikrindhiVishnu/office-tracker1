// src/lib/offlineSync.ts

export interface OfflineAction {
  id: string;
  type: "checkin" | "checkout" | "break" | "task-update";
  payload: any;
  timestamp: number;
}

const DB_NAME = "office-tracker-offline-db";
const STORE_NAME = "offline-actions-store";
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB is not supported in this environment"));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
  });
}

export async function queueOfflineAction(
  type: OfflineAction["type"],
  payload: any
): Promise<string> {
  const id = Math.random().toString(36).substring(2, 9) + "_" + Date.now();
  const action: OfflineAction = {
    id,
    type,
    payload,
    timestamp: Date.now(),
  };

  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.add(action);

      request.onsuccess = () => {
        console.log(`[OfflineSync] Queued action: ${type}`, action);
        resolve(id);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("[OfflineSync] Error adding action to IndexedDB:", error);
    throw error;
  }
}

export async function getQueuedActions(): Promise<OfflineAction[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("[OfflineSync] Error reading IndexedDB actions:", error);
    return [];
  }
}

export async function deleteQueuedAction(id: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("[OfflineSync] Error deleting action from IndexedDB:", error);
  }
}

// Function to process the queue using callbacks for each type
export async function processOfflineQueue(handlers: {
  checkin?: (payload: any) => Promise<any>;
  checkout?: (payload: any) => Promise<any>;
  break?: (payload: any) => Promise<any>;
  "task-update"?: (payload: any) => Promise<any>;
}): Promise<{ successCount: number; failureCount: number }> {
  const actions = await getQueuedActions();
  let successCount = 0;
  let failureCount = 0;

  if (actions.length === 0) return { successCount, failureCount };

  console.log(`[OfflineSync] Syncing ${actions.length} queued action(s)...`);

  for (const action of actions) {
    const handler = handlers[action.type];
    if (handler) {
      try {
        await handler(action.payload);
        await deleteQueuedAction(action.id);
        successCount++;
        console.log(`[OfflineSync] Successfully synced action ${action.id}`);
      } catch (error) {
        console.error(`[OfflineSync] Failed syncing action ${action.id}:`, error);
        failureCount++;
      }
    } else {
      console.warn(`[OfflineSync] No handler registered for action type: ${action.type}`);
    }
  }

  return { successCount, failureCount };
}
