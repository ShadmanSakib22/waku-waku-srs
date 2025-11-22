// lib/auth-client.ts
import {
  GoogleAuthProvider,
  GithubAuthProvider,
  AuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";

import { auth } from "@/lib/firebase";

// Helper function to detect mobile browsers
const isMobile = () =>
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );

// helper
export async function createSession(provider: AuthProvider) {
  try {
    await setPersistence(auth, browserLocalPersistence);

    if (isMobile()) {
      console.log("Mobile detected: using redirect flow");
      await signInWithRedirect(auth, provider);
      // No redirect here — AuthInitializer will handle it via getRedirectResult
    } else {
      console.log("Desktop detected: using popup flow");
      const result = await signInWithPopup(auth, provider);
      const idToken = await result.user.getIdToken();

      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      if (!response.ok) {
        throw new Error("Failed to create server session.");
      }

      // No redirect here — component handles it
    }
  } catch (error) {
    console.error("Sign-in process error:", error);
  }
}
export function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  createSession(provider);
}

export function signInWithGithub() {
  const provider = new GithubAuthProvider();
  createSession(provider);
}

// Sign-Out function (Clears both client and server sessions)
export async function signOutAndClearSession() {
  try {
    // Clear the client-side Firebase session state
    await firebaseSignOut(auth);

    // Call the server to clear the secure HTTP-only cookie
    await fetch("/api/logout", { method: "POST" });
  } catch (error) {
    console.error("Error during sign-out:", error);
  }
  window.location.assign("/");
}
