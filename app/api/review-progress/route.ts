// app/api/review-progress/route.ts

import "server-only";
import { NextRequest } from "next/server";
import { db } from "@/lib/firebase-admin";
import { getCurrentUser } from "@/lib/auth-server";
import { CardState } from "@/lib/sm2-scheduler";

const APP_SLUG = process.env.NEXT_PUBLIC_APP_SLUG;

/**
 * Validates a CardState object before saving.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function validateCardProgress(progress: any): string | null {
  if (!progress || typeof progress !== "object") {
    return "Invalid: progress payload must be an object.";
  }

  // easeFactor
  if (typeof progress.easeFactor !== "number" || progress.easeFactor < 1.3) {
    return `Invalid: easeFactor must be >= 1.3, got ${progress.easeFactor}.`;
  }

  // repetitions (>= 0 integer)
  if (
    typeof progress.repetitions !== "number" ||
    progress.repetitions < 0 ||
    !Number.isInteger(progress.repetitions)
  ) {
    return `Invalid: repetitions must be a non-negative integer, got ${progress.repetitions}.`;
  }

  // lastInterval (>= 0, days)
  if (typeof progress.lastInterval !== "number" || progress.lastInterval < 0) {
    return `Invalid: lastInterval must be a number >= 0, got ${progress.lastInterval}.`;
  }

  // nextReview (timestamp)
  if (typeof progress.nextReview !== "number" || progress.nextReview < 0) {
    return `Invalid: nextReview must be a valid timestamp, got ${progress.nextReview}.`;
  }

  // isLearning (boolean)
  if (typeof progress.isLearning !== "boolean") {
    return `Invalid: isLearning must be boolean, got ${progress.isLearning}.`;
  }

  // learningStepIndex (>= 0 integer)
  if (
    typeof progress.learningStepIndex !== "number" ||
    progress.learningStepIndex < 0 ||
    !Number.isInteger(progress.learningStepIndex)
  ) {
    return `Invalid: learningStepIndex must be a non-negative integer, got ${progress.learningStepIndex}.`;
  }

  return null; // Valid
}

export async function POST(request: NextRequest) {
  // 1. Auth
  const user = await getCurrentUser();
  if (!user) {
    return new Response(
      JSON.stringify({ message: "Unauthenticated. Please sign in." }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const uid = user.uid;

  // 2. Parse
  let payload: {
    cardId: string;
    chapterId: string;
    progress: CardState;
  };

  try {
    payload = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ message: "Request body must be valid JSON." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const { cardId, chapterId, progress } = payload;

  // 3. Validate
  if (!cardId || !chapterId) {
    return new Response(
      JSON.stringify({
        message: "Missing required 'cardId' or 'chapterId'.",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const err = validateCardProgress(progress);
  if (err) {
    return new Response(JSON.stringify({ message: err }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 4. Save to Firestore
  try {
    const docPath = `artifacts/${APP_SLUG}/users/${uid}/${chapterId}_progress/${cardId}`;
    const docRef = db.doc(docPath);

    const dataToSave: CardState = {
      cardId,
      easeFactor: progress.easeFactor,
      repetitions: progress.repetitions,
      lastInterval: progress.lastInterval,
      nextReview: progress.nextReview,
      isLearning: progress.isLearning,
      learningStepIndex: progress.learningStepIndex,
    };

    await docRef.set(dataToSave, { merge: true });

    return new Response(
      JSON.stringify({
        message: "Progress saved.",
        nextReviewISO: new Date(progress.nextReview).toISOString(),
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Firestore write failed:", err);
    return new Response(
      JSON.stringify({ message: "Failed to write progress." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

export async function GET() {
  return new Response(null, { status: 405 });
}
