//hooks/useAuth
"use client";
import { useEffect, useState } from "react";
import { onAuthStateChanged, User, getRedirectResult } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleRedirectResult = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result) {
          // Get the fresh ID token from the authenticated user
          const idToken = await result.user.getIdToken();

          // Call the server to exchange the ID Token for a secure cookie
          const response = await fetch("/api/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ idToken }),
          });

          if (!response.ok) {
            throw new Error("Failed to create server session.");
          }

          // Login successful, redirect to home
          window.location.assign("/");
        }
      } catch (error) {
        console.warn("Redirect sign-in process error:", error);
      }
    };

    handleRedirectResult();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { user, loading };
}
