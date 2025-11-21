// hooks/useStudySession.ts
import { create } from "zustand";
import {
  processReview,
  initializeNewCard,
  computeDailyNewLimit,
  CardState,
} from "@/lib/sm2-scheduler";
import { collection, onSnapshot, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

const APP_SLUG = process.env.NEXT_PUBLIC_APP_SLUG ?? "flashcard-app";
const API_WRITE_ROUTE = "/api/review-progress";

/* -------------------------------------------------------------------------- */
/* TYPES                                   */
/* -------------------------------------------------------------------------- */
export interface CardContent {
  id: string;
  kanji: string;
  romaji: string;
  description: string;
  chapterId: string;
}

export interface StudyCard extends CardContent, CardState {}

interface StudySessionState {
  activeChapterId: string | null;
  dailyNewCardLimit: number;
  currentUserId: string | null;
  staticDeckContent: CardContent[];
  allChapterCards: StudyCard[];
  reviewQueue: StudyCard[];
  currentCardIndex: number;
  isSessionActive: boolean;
  isSessionComplete: boolean;
  loading: boolean;
  error: string | null;
  isCardFlipped: boolean;
  reviewScore: number;
  newCardsServedToday: number;
  nextReviewTime: number | null;
  isSubmitting: boolean;

  // Internal unsubscribe reference
  _unsubscribe: (() => void) | null;

  // actions
  setChapter: (chapterId: string) => void;
  setReviewScore: (score: number) => void;
  setDeckContent: (content: CardContent[]) => void;
  initializeSession: (
    userId: string,
    chapterId: string,
    staticDeckContent: CardContent[]
  ) => () => void;
  handleReview: (score: number) => Promise<void>;
  flipCard: () => void;
  nextCard: () => void;
  assembleQueue: () => void;
}

/* -------------------------------------------------------------------------- */
/* HELPERS                                  */
/* -------------------------------------------------------------------------- */

// 1. Helper to safely convert Firestore timestamps or numbers to milliseconds
const toMilliseconds = (value: unknown): number => {
  if (value instanceof Timestamp) return value.toMillis();
  if (typeof value === "number") return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return 0;
};

// 2. Helper to prepare values for Firestore (just passes the number through)
const toFirestoreValue = (ms: number): number => ms;

// 3. Shuffle helper
function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* -------------------------------------------------------------------------- */
/* STORE                                   */
/* -------------------------------------------------------------------------- */

export const useStudySession = create<StudySessionState>((set, get) => ({
  activeChapterId: null,
  dailyNewCardLimit: 0,
  currentUserId: null,
  staticDeckContent: [],
  allChapterCards: [],
  reviewQueue: [],
  currentCardIndex: 0,
  isSessionActive: false,
  isSessionComplete: false,
  loading: false,
  error: null,
  isCardFlipped: false,
  reviewScore: 5,
  newCardsServedToday: 0,
  nextReviewTime: null,
  isSubmitting: false,
  _unsubscribe: null,

  setChapter: (chapterId: string) =>
    set({
      activeChapterId: chapterId,
      isSessionComplete: false,
      error: null,
      newCardsServedToday: 0,
      nextReviewTime: null,
    }),

  setReviewScore: (score: number) => set({ reviewScore: score }),

  setDeckContent: (content: CardContent[]) =>
    set({
      staticDeckContent: content,
      dailyNewCardLimit: computeDailyNewLimit(content.length),
    }),

  flipCard: () => set((s) => ({ isCardFlipped: !s.isCardFlipped })),

  nextCard: () =>
    set((state) => {
      const newIndex = state.currentCardIndex + 1;
      const isComplete = newIndex >= state.reviewQueue.length;

      // Recalculate next review time if complete
      const nextReviewTime = isComplete
        ? (() => {
            const now = Date.now();
            const futureReviews = state.allChapterCards
              .filter((card) => card.nextReview > now)
              .map((card) => card.nextReview);
            return futureReviews.length > 0 ? Math.min(...futureReviews) : null;
          })()
        : null;

      return {
        currentCardIndex: isComplete ? state.currentCardIndex : newIndex,
        isCardFlipped: false,
        reviewScore: 5,
        isSessionActive: !isComplete,
        isSessionComplete: isComplete,
        nextReviewTime,
      };
    }),

  assembleQueue: () => {
    const s = get();
    const now = Date.now();
    const allCards = s.allChapterCards;

    // Guard against assembling empty decks
    if (allCards.length === 0) return;

    const dailyLimit =
      s.dailyNewCardLimit || computeDailyNewLimit(s.staticDeckContent.length);

    const dueCards: StudyCard[] = [];
    const newCards: StudyCard[] = [];

    for (const card of allCards) {
      const isUnstarted = card.nextReview === 0 && card.repetitions === 0;
      const isDue = card.nextReview <= now && card.nextReview !== 0;

      if (isDue) dueCards.push(card);
      else if (isUnstarted) newCards.push(card);
    }

    const queueDue = shuffle(dueCards);
    const allowedNewSlots = Math.max(0, dailyLimit - s.newCardsServedToday);
    const queueNew = shuffle(newCards).slice(0, allowedNewSlots);
    const combined = shuffle([...queueDue, ...queueNew]);
    const isComplete = combined.length === 0;

    set({
      reviewQueue: combined,
      currentCardIndex: 0,
      isSessionComplete: isComplete,
      isSessionActive: combined.length > 0,
      loading: false,
      error: null,
    });
  },

  initializeSession: (userId, chapterId, staticDeckContent) => {
    const state = get();

    // Clean up existing listener if changing contexts
    if (state._unsubscribe) {
      state._unsubscribe();
    }

    // Cache static deck immediately
    const dailyLimit = computeDailyNewLimit(staticDeckContent.length);

    set({
      loading: true,
      activeChapterId: chapterId,
      currentUserId: userId,
      staticDeckContent,
      dailyNewCardLimit: dailyLimit,
      newCardsServedToday: 0,
      error: null,
      nextReviewTime: null,
    });

    const progressCollectionPath = `artifacts/${APP_SLUG}/users/${userId}/${chapterId}_progress`;
    const progressCollectionRef = collection(db, progressCollectionPath);

    const unsubscribe = onSnapshot(
      progressCollectionRef,
      (snapshot) => {
        // 1. Process Data
        const userProgressMap = new Map<string, CardState>();
        snapshot.docs.forEach((doc) => {
          const data = doc.data();
          if (data?.cardId) {
            userProgressMap.set(String(data.cardId), {
              cardId: String(data.cardId),
              easeFactor: Number(data.easeFactor ?? 2.5),
              repetitions: Number(data.repetitions ?? 0),
              lastInterval: Number(data.lastInterval ?? 0),
              nextReview: toMilliseconds(data.nextReview ?? 0),
            });
          }
        });

        const merged: StudyCard[] = staticDeckContent.map((content) => ({
          ...content,
          ...(userProgressMap.get(content.id) ?? initializeNewCard(content.id)),
        }));

        // 2. Update State
        set({ allChapterCards: merged, loading: false, error: null });

        // 3. Only assemble queue if the session is NOT active yet.
        if (!get().isSessionActive && !get().isSessionComplete) {
          get().assembleQueue();
        }
      },
      (error) => {
        console.error("Firestore error:", error);
        set({ loading: false, error: "Failed to load study progress." });
      }
    );

    set({ _unsubscribe: unsubscribe });
    return unsubscribe;
  },

  handleReview: async (score: number) => {
    set({ isSubmitting: true });
    const state = get();
    const currentCard = state.reviewQueue[state.currentCardIndex];
    const activeChapterId = state.activeChapterId;
    const userId = state.currentUserId;

    if (!currentCard || !activeChapterId || !userId) {
      set({ error: "Missing session data.", isSubmitting: false });
      return;
    }

    // Calculate new state purely locally first
    const newCardState = processReview(currentCard, score);

    // Prepare payload
    const payload = {
      chapterId: activeChapterId,
      cardId: newCardState.cardId,
      progress: {
        cardId: newCardState.cardId,
        easeFactor: newCardState.easeFactor,
        repetitions: newCardState.repetitions,
        lastInterval: newCardState.lastInterval,
        nextReview: toFirestoreValue(newCardState.nextReview),
      },
    };

    try {
      const res = await fetch(API_WRITE_ROUTE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to save");

      // Check race condition before advancing
      const currentState = get();
      if (currentState.currentCardIndex === state.currentCardIndex) {
        // If it was a new card, count it
        if (currentCard.repetitions === 0 && newCardState.repetitions > 0) {
          set((s) => ({ newCardsServedToday: s.newCardsServedToday + 1 }));
        }
        get().nextCard();
      }
    } catch (err) {
      console.error(err);
      set({ error: "Save failed. Please try again." });
    } finally {
      set({ isSubmitting: false });
    }
  },
}));
