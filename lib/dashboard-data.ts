// lib/dashboard-data.ts
import "server-only";
import { db } from "@/lib/firebase-admin";
import { DECKS, DeckInfo } from "@/public/decks/deck-info";

// --- CONFIGURATION CONSTANTS ---
const APP_SLUG = process.env.NEXT_PUBLIC_APP_SLUG;

// --- TYPE DEFINITIONS ---
export interface DeckProgressSummary {
  chapterId: string;
  dueNowCount: number;
}

export interface DashboardDeck extends DeckInfo {
  dueNowCount?: number;
}

// --- SERVER DATA FETCHING LOGIC ---

/**
 * Fetches the Due Now count for a single deck
 * by performing a single Firestore count query.
 */
async function getDeckProgressSummary(
  userId: string,
  chapterId: string
): Promise<DeckProgressSummary> {
  if (!APP_SLUG) {
    console.error("APP_SLUG environment variable is not set.");
    return { chapterId: chapterId, dueNowCount: 0 };
  }

  const now = Date.now();
  const progressCollectionPath = `artifacts/${APP_SLUG}/users/${userId}/${chapterId}_progress`;

  try {
    const progressCollectionRef = db.collection(progressCollectionPath);

    // A card is "Due Now" if its nextReview timestamp is less than or equal to the current time (now).
    // learning cards are also meant to be counted due that's why we cannot use repetitions > 0
    const dueNowQuery = progressCollectionRef.where("nextReview", "<=", now);

    // realtime aggregation
    const snapshot = await dueNowQuery.count().get();
    const dueNowCount = snapshot.data().count;

    return {
      chapterId: chapterId,
      dueNowCount: dueNowCount,
    };
  } catch (error) {
    // If the collection doesn't exist (e.g., first-time user), the count is 0.
    // Log the error for diagnostics but return 0 to keep the dashboard running.
    console.warn(
      `Could not get summary for deck ${chapterId}. Returning 0.`,
      error
    );
    return { chapterId: chapterId, dueNowCount: 0 };
  }
}

/**
 * Fetches all deck information and merges it with the user's progress summary.
 * @param userId The ID of the currently authenticated user.
 * @returns An array of DashboardDeck objects.
 */
export async function getDashboardDecks(
  userId: string
): Promise<DashboardDeck[]> {
  if (userId === "guest") {
    return DECKS;
  }

  const deckPromises = DECKS.map(async (deckInfo) => {
    const summary = await getDeckProgressSummary(userId, deckInfo.id);

    return {
      ...deckInfo,
      dueNowCount: summary.dueNowCount,
    };
  });

  // Wait for all progress summaries to return
  const decks = await Promise.all(deckPromises);

  return decks;
}
