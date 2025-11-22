//hooks/useAuth
"use client";
import { useEffect, useRef, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getRedirectResult } from "firebase/auth";

export default function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { user, loading };
}

export function AuthInitializer() {
  const ranOnce = useRef(false);

  useEffect(() => {
    if (ranOnce.current) return; // Prevent double execution
    ranOnce.current = true;

    const handleRedirectResult = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result?.user) {
          console.log("User verified via redirect:", result.user.uid);

          // Exchange token for session cookie
          const idToken = await result.user.getIdToken();
          await fetch("/api/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ idToken }),
          });
        }
      } catch (error) {
        console.error("Redirect sign-in error:", error);
      }
    };

    handleRedirectResult();
  }, []);

  return null;
}
