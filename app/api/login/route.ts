// app/api/login/route.ts

import { auth } from "@/lib/firebase-admin";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const { idToken } = await request.json();

  if (!idToken) {
    return new Response("Unauthorized: No ID token provided.", { status: 401 });
  }

  try {
    // Verify the ID Token and get user claims
    await auth.verifyIdToken(idToken);

    // Set expiry for the session cookie (e.g., 7 days) in milliseconds
    const expiresIn = 60 * 60 * 24 * 7 * 1000;

    // Create the secure, long-lived session cookie
    const sessionCookie = await auth.createSessionCookie(idToken, {
      expiresIn,
    });

    const cookieStore = await cookies();
    cookieStore.set("session", sessionCookie, {
      maxAge: expiresIn / 1000, // maxAge in seconds
      httpOnly: true, // Crucial: Prevents client-side JS access (XSS defense)
      secure: process.env.NODE_ENV === "production", // Only send over HTTPS in production
      path: "/",
      sameSite: "lax",
    });

    return new Response(null, { status: 200 });
  } catch (error) {
    console.error("Error verifying ID token or creating session:", error);
    return new Response("Failed to establish session.", { status: 401 });
  }
}
