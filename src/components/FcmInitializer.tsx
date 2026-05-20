"use client";

import { useAuth } from "@/context/AuthContext";
import { useFcm } from "@/hooks/useFcm";

/**
 * FcmInitializer component
 * Automatically requests permissions and registers Firebase Cloud Messaging (FCM) 
 * tokens in Firestore when a user logs in.
 */
export default function FcmInitializer() {
  const { user } = useAuth();
  
  // Call useFcm hook with the current user's UID (if logged in)
  useFcm(user?.uid);

  return null;
}
