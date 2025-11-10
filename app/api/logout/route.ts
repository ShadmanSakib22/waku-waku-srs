// app/api/logout/route.ts
import { cookies } from "next/headers";

/**
 * Handles user logout by clearing the session cookie.
 * This endpoint invalidates the user's session on the server-side.
 *
 * @returns A response indicating successful logout.
 */
export async function POST() {
  try {
    const cookieStore = await cookies();

    // Check if the session cookie exists before attempting to clear it
    const sessionCookie = cookieStore.get("session");
    if (!sessionCookie) {
      // If no session cookie is present, logout is effectively already done
      console.warn("Logout attempted without an active session cookie.");
      return new Response(null, { status: 204 }); // No Content
    }

    // Clear the session cookie using the delete method for proper cleanup
    cookieStore.delete("session");

    console.log("User session cleared successfully.");
    return new Response(null, { status: 204 }); // No Content - standard for successful logout
  } catch (error) {
    console.error("Error during logout:", error);
    // Return a generic error response without exposing internal details
    return new Response("Internal Server Error", { status: 500 });
  }
}
