// hooks/useStudySession.ts
import { create } from "zustand";
import {
  processReview,
  initializeNewCard,
  computeDailyNewLimit,
  CardState,
} from "@/lib/sm2-scheduler";
import {
  collection,
  onSnapshot,
  Timestamp,
  QueryDocumentSnapshot,
  DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

/**
 * useStudySession (MVP)
 *
 * - Daily new-card limit computed automatically from chapter size (3-day target).
 * - Keeps single Firestore listener, snapshot dedupe, shuffle, race-guards.
 * - Minimal state required by UI: queue, index, loading, error, flip state.
 */

/* ----------------------------- CONFIG ------------------------------ */
const APP_SLUG = process.env.NEXT_PUBLIC_APP_SLUG ?? "flashcard-app";
const API_WRITE_ROUTE = "/api/review-progress";

/* ------------------------------ TYPES ------------------------------ */
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

/* --------------------------- MODULE STATE -------------------------- */
let moduleUnsubscribe: (() => void) | null = null;
let moduleListenerKey: string | null = null;
let lastSnapshotFingerprint: string | null = null;

/* --------------------------- UTIL HELPERS -------------------------- */

const toMilliseconds = (value: unknown): number => {
  if (value instanceof Timestamp) return value.toMillis();
  if (typeof value === "number") return value;
  if (typeof value === "string" && /^\\d+$/.test(value)) return Number(value);
  return 0;
};

const toFirestoreValue = (ms: number): number => ms;

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function fingerprintDocs(docs: QueryDocumentSnapshot<DocumentData>[]) {
  return docs
    .map((d) => {
      const dataStr = JSON.stringify(d.data());
      let hash = 0;
      for (let i = 0; i < dataStr.length; i++) {
        hash = (hash * 31 + dataStr.charCodeAt(i)) >>> 0;
      }
      return `${d.id}:${hash}`;
    })
    .join("|");
}

/* ---------------------------- ZUSTAND STORE ------------------------ */

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

  /* ---------------------- simple setters ------------------------- */
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

  /* ---------------------- assembleQueue -------------------------- */
  assembleQueue: () => {
    const s = get();
    const now = Date.now();

    const allCards = s.allChapterCards;
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

    const nextReviewTime = isComplete
      ? (() => {
          const futureReviews = allCards
            .filter((card) => card.nextReview > now)
            .map((card) => card.nextReview);
          return futureReviews.length > 0 ? Math.min(...futureReviews) : null;
        })()
      : null;

    set({
      reviewQueue: combined,
      currentCardIndex: 0,
      isSessionComplete: isComplete,
      isSessionActive: combined.length > 0,
      loading: false,
      error: null,
      nextReviewTime,
    });
  },

  /* ---------------------- initializeSession ---------------------- */
  initializeSession: (userId, chapterId, staticDeckContent) => {
    if (
      !userId ||
      !chapterId ||
      !Array.isArray(staticDeckContent) ||
      staticDeckContent.length === 0
    ) {
      console.error("initializeSession: missing required params");
      return () => {};
    }

    const listenerKey = `${userId}|${chapterId}|${APP_SLUG}`;

    if (moduleListenerKey === listenerKey && moduleUnsubscribe) {
      set({
        loading: false,
        activeChapterId: chapterId,
        currentUserId: userId,
        staticDeckContent,
        dailyNewCardLimit: computeDailyNewLimit(staticDeckContent.length),
        nextReviewTime: null,
      });
      return moduleUnsubscribe;
    }

    if (moduleUnsubscribe) {
      try {
        moduleUnsubscribe();
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (e) {
        /* ignore */
      }
      moduleUnsubscribe = null;
      moduleListenerKey = null;
      lastSnapshotFingerprint = null;
    }

    // cache static deck
    const staticMap = new Map<string, CardContent>();
    for (const c of staticDeckContent) staticMap.set(c.id, c);

    set({
      loading: true,
      activeChapterId: chapterId,
      currentUserId: userId,
      staticDeckContent,
      dailyNewCardLimit: computeDailyNewLimit(staticDeckContent.length),
      newCardsServedToday: 0,
      error: null,
      nextReviewTime: null,
    });

    const progressCollectionPath = `artifacts/${APP_SLUG}/users/${userId}/${chapterId}_progress`;
    const progressCollectionRef = collection(db, progressCollectionPath);

    moduleListenerKey = listenerKey;
    moduleUnsubscribe = onSnapshot(
      progressCollectionRef,
      (snapshot) => {
        const docs = snapshot.docs;
        const fingerprint = fingerprintDocs(docs);
        if (fingerprint === lastSnapshotFingerprint) return;
        lastSnapshotFingerprint = fingerprint;

        try {
          const userProgressMap = new Map<string, CardState>();
          for (const doc of docs) {
            const data = doc.data() as Record<string, unknown>;
            if (!data?.cardId) continue;
            const cardState: CardState = {
              cardId: String(data.cardId),
              easeFactor: Number(data.easeFactor ?? 2.5),
              repetitions: Number(data.repetitions ?? 0),
              lastInterval: Number(data.lastInterval ?? 0),
              nextReview: toMilliseconds(data.nextReview ?? 0),
            };
            userProgressMap.set(cardState.cardId, cardState);
          }

          const merged: StudyCard[] = [];
          for (const content of staticDeckContent) {
            const progress =
              userProgressMap.get(content.id) ?? initializeNewCard(content.id);
            merged.push({ ...content, ...progress });
          }

          set({ allChapterCards: merged, loading: false, error: null });
          get().assembleQueue();
        } catch (err) {
          console.error("Error processing progress snapshot:", err);
          set({ loading: false, error: "Failed to load study progress." });
        }
      },
      (error) => {
        console.error("Firestore progress snapshot failed:", error);
        set({ loading: false, error: "Failed to load study progress." });
      }
    );

    return moduleUnsubscribe;
  },

  /* ------------------------ handleReview -------------------------- */
  handleReview: async (score: number) => {
    set({ isSubmitting: true });
    const state = get();
    const currentCard = state.reviewQueue[state.currentCardIndex];
    const activeChapterId = state.activeChapterId;
    const userId = state.currentUserId;

    if (!currentCard || !activeChapterId || !userId) {
      set({
        error: "Cannot process review: Missing card/session data.",
        isSubmitting: false,
      });
      return;
    }

    const cardIdBefore = currentCard.id;
    const newCardState = processReview(currentCard, score);

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

    let responseOk = false;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);

      const res = await fetch(API_WRITE_ROUTE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeout);
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        let parsedMsg = "Could not save progress. Server returned an error.";
        try {
          parsedMsg = JSON.parse(body)?.message ?? parsedMsg;
        } catch {
          /* ignore */
        }
        throw new Error(parsedMsg);
      }
      responseOk = true;
    } catch (err) {
      console.error("Failed to save progress via server:", err);
      set({
        error:
          err instanceof Error
            ? err.message
            : "Unexpected error saving progress.",
        isSubmitting: false,
      });
      return;
    }

    if (responseOk) {
      // race detection
      const stateAfter = get();
      const currentCardAfter =
        stateAfter.reviewQueue[stateAfter.currentCardIndex];
      if (!currentCardAfter || currentCardAfter.id !== cardIdBefore) {
        console.warn(
          "Race detected: card changed during review save. Reassembling queue."
        );
        // If this was a newly introduced card (repetitions went 0->1) count it as served
        if (currentCard.repetitions === 0 && newCardState.repetitions > 0) {
          set((s) => ({ newCardsServedToday: s.newCardsServedToday + 1 }));
        }
        get().assembleQueue();
        // Reset flip state after reassembling
        set({ isCardFlipped: false, isSubmitting: false });
        return;
      }

      // If this was a newly introduced card (repetitions went 0->1) count it as served
      if (currentCard.repetitions === 0 && newCardState.repetitions > 0) {
        set((s) => ({ newCardsServedToday: s.newCardsServedToday + 1 }));
      }

      // Advance to next card
      get().nextCard();
    }
    set({ isSubmitting: false });
  },
}));
