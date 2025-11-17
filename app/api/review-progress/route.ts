// app/api/review-progress/route.ts

import "server-only";
import { NextRequest } from "next/server";
import { db } from "@/lib/firebase-admin";
import { getCurrentUser } from "@/lib/auth-server";
import { CardState } from "@/lib/sm2-scheduler"; // For type-checking the payload

const APP_SLUG = process.env.NEXT_PUBLIC_APP_SLUG;

/**
 * Validates that a CardState object contains valid SM-2 values.
 * @param progress The progress object to validate.
 * @returns An error message if invalid, or null if valid.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function validateCardProgress(progress: any): string | null {
  // Validate easeFactor
  if (typeof progress.easeFactor !== "number" || progress.easeFactor < 1.3) {
    return `Invalid: easeFactor must be a number >= 1.3, got ${progress.easeFactor}.`;
  }

  // Validate repetitions
  if (
    typeof progress.repetitions !== "number" ||
    progress.repetitions < 0 ||
    !Number.isInteger(progress.repetitions)
  ) {
    return `Invalid: repetitions must be a non-negative integer, got ${progress.repetitions}.`;
  }

  // Validate lastInterval (can be 0 for new/failed cards)
  if (typeof progress.lastInterval !== "number" || progress.lastInterval < 0) {
    return `Invalid: lastInterval must be a non-negative number, got ${progress.lastInterval}.`;
  }

  // Validate nextReview (Unix timestamp in milliseconds)
  if (typeof progress.nextReview !== "number" || progress.nextReview < 0) {
    return `Invalid: nextReview must be a non-negative timestamp, got ${progress.nextReview}.`;
  }

  return null; // Valid
}

export async function POST(request: NextRequest) {
  // --- 1. Authentication ---
  // Use the helper to securely verify the session cookie and get the user.
  const user = await getCurrentUser();
  if (!user) {
    return new Response(
      JSON.stringify({
        message: "Unauthenticated. Please sign in to save progress.",
      }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }
  const authenticatedUserId = user.uid;

  // --- 2. Input Validation and Parsing ---
  let payload: { cardId: string; chapterId: string; progress: CardState };
  try {
    const json = await request.json();
    payload = json;
  } catch (error) {
    console.log(error);
    return new Response(
      JSON.stringify({ message: "Invalid JSON format in request body." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const { cardId, chapterId, progress } = payload;

  const validationError = validateCardProgress(progress);
  if (validationError) {
    return new Response(JSON.stringify({ message: validationError }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (
    !chapterId ||
    typeof chapterId !== "string" ||
    !cardId ||
    typeof cardId !== "string"
  ) {
    return new Response(
      JSON.stringify({
        message: "Missing required 'chapterId' or 'cardId' in payload.",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // --- 3. Firestore Write Operation (Admin SDK) ---
  try {
    // Path: /artifacts/{APP_SLUG}/users/{uid}/{chapterId}_progress/{cardId}
    const docPath = `artifacts/${APP_SLUG}/users/${authenticatedUserId}/${chapterId}_progress/${cardId}`;
    const docRef = db.doc(docPath);

    // Prepare data to ensure only the necessary SM-2 fields are saved
    const dataToSave: CardState = {
      cardId: cardId, // for path integrity check
      easeFactor: progress.easeFactor,
      repetitions: progress.repetitions,
      lastInterval: progress.lastInterval,
      nextReview: progress.nextReview,
    };

    // Update progress fields
    await docRef.set(dataToSave, { merge: true });

    return new Response(
      JSON.stringify({
        message: "Progress saved successfully.",
        cardId: cardId,
        nextReview: new Date(progress.nextReview).toISOString(),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Firestore write failed:", error);
    return new Response(
      JSON.stringify({
        message: "Server failed to save progress. Please check logs.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// Reject other HTTP methods
export async function GET() {
  return new Response(null, { status: 405 });
}
