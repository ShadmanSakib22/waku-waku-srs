// lib/auth-server.ts (Used in Server Components and Server Actions)
import "server-only";
import { auth } from "@/lib/firebase-admin"; // Admin SDK auth
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/**
 * Reads and verifies the Firebase session cookie to get the authenticated user.
 * @returns The Firebase UserRecord or null if unauthenticated/invalid session.
 */
export async function getCurrentUser() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;
  if (!sessionCookie) return null;

  try {
    // Verify the session cookie using the Admin SDK
    const decodedClaims = await auth.verifySessionCookie(sessionCookie, true);

    // Fetch the full user record
    const user = await auth.getUser(decodedClaims.uid);
    return user;
  } catch (error) {
    console.error("Session verification failed, clearing cookie:", error);
    // Clear the invalid cookie
    cookieStore.delete("session");
    return null;
  }
}

/**
 * Guards a route/action. Redirects to /login if the user is unauthenticated.
 * @returns The authenticated Firebase UserRecord.
 */
export async function protectRoute(redirectTo: string = "/login") {
  const user = await getCurrentUser();
  if (!user) {
    redirect(redirectTo);
  }
  return user;
}
