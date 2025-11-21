// lib/auth-client.ts
import {
  GoogleAuthProvider,
  GithubAuthProvider,
  AuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
} from "firebase/auth";

import { auth } from "@/lib/firebase";
import { redirect } from "next/navigation";

// helper
export async function createSession(provider: AuthProvider) {
  try {
    const result = await signInWithPopup(auth, provider);

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

    // Login successful
    redirect("/");
  } catch (error) {
    console.warn("Sign-in process interrupted:", error);
  }
}

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  await createSession(provider);
}

export async function signInWithGithub() {
  const provider = new GithubAuthProvider();
  await createSession(provider);
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
