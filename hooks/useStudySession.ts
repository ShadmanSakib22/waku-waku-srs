"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { collection, doc, onSnapshot, getFirestore } from "firebase/firestore";
import useAuth from "@/hooks/useAuth";
import {
  processReview,
  initializeNewCard,
  CardState,
} from "@/lib/sm2-scheduler";

const firestore = getFirestore();
const LOCAL_KEY = "pending-progress-v1";

export interface CardContent {
  id: string;
  kanji: string;
  romaji: string;
  description: string;
}

interface UseStudySessionOptions {
  chapterId?: string;
  allCards?: CardContent[];
}

export function useStudySession(options?: UseStudySessionOptions) {
  const { chapterId, allCards } = options || {};
  const { user } = useAuth();

  /** ---------- STATE ---------- */
  const [firestoreProgress, setFirestoreProgress] = useState<
    Record<string, CardState>
  >({});
  const [dailyLimitState, setDailyLimitState] = useState<number>(20);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());

  // Session state
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isCardFlipped, setIsCardFlipped] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isSessionComplete, setIsSessionComplete] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Repeat queue for “Again” cards
  const [repeatQueue, setRepeatQueue] = useState<string[]>([]);

  /** ---------- TICKING CLOCK ---------- */
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  /** ---------- REALTIME DAILY LIMIT LISTENER ---------- */
  useEffect(() => {
    if (!user) return;
    const prefRef = doc(
      firestore,
      `artifacts/${process.env.NEXT_PUBLIC_APP_SLUG}/users/${user.uid}/preferences/study`
    );
    const unsub = onSnapshot(prefRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      setDailyLimitState(data.dailyNewCardLimit ?? 20);
    });
    return unsub;
  }, [user]);

  /** ---------- REALTIME PROGRESS LISTENER ---------- */
  useEffect(() => {
    if (!user || !chapterId) return;

    const colRef = collection(
      firestore,
      `artifacts/${process.env.NEXT_PUBLIC_APP_SLUG}/users/${user.uid}/${chapterId}_progress`
    );

    const unsub = onSnapshot(colRef, (snap) => {
      const obj: Record<string, CardState> = {};
      snap.forEach((doc) => {
        obj[doc.id] = doc.data() as CardState;
      });
      setFirestoreProgress(obj);
      setLoading(false);
    });

    return unsub;
  }, [user, chapterId]);

  /** ---------- LOCAL STORAGE HELPERS ---------- */
  const loadPendingLocal = useCallback(() => {
    try {
      return JSON.parse(localStorage.getItem(LOCAL_KEY) || "{}");
    } catch {
      return {};
    }
  }, []);

  const savePendingLocal = useCallback((obj: Record<string, CardState>) => {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(obj));
  }, []);

  /** ---------- QUEUE BUILDER ---------- */
  const queue = useMemo(() => {
    if (loading || !allCards) return [];

    const q: string[] = [];

    // 1. Due review cards (SM-2)
    for (const card of allCards) {
      const prog = firestoreProgress[card.id];
      if (prog && !prog.isLearning && prog.nextReview <= now) q.push(card.id);
    }

    // 2. Learning cards (in-progress)
    for (const card of allCards) {
      const prog = firestoreProgress[card.id];
      if (
        prog &&
        prog.isLearning &&
        prog.nextReview <= now &&
        !q.includes(card.id)
      ) {
        q.push(card.id);
      }
    }

    // 3. New cards
    const newCards = allCards.filter(
      (c) => !firestoreProgress[c.id] && !q.includes(c.id)
    );
    const eligible = newCards.slice(0, dailyLimitState);
    q.push(...eligible.map((c) => c.id));

    // 4. RepeatQueue cards at the end
    q.push(...repeatQueue.filter((id) => !q.includes(id)));

    return q;
  }, [firestoreProgress, allCards, dailyLimitState, now, loading, repeatQueue]);

  /** ---------- GET NEXT CARD ---------- */
  const getNextCard = useCallback((): CardContent | null => {
    if (queue.length === 0 || !allCards) return null;
    const nextId = queue[0];
    return allCards.find((c) => c.id === nextId) || null;
  }, [queue, allCards]);

  /** ---------- SUBMIT REVIEW ---------- */
  const submitReview = useCallback(
    async (cardId: string, quality: number) => {
      if (!user || !chapterId) return;

      const current = firestoreProgress[cardId] || initializeNewCard(cardId);
      const updated = processReview(current, quality);

      // Save to local pending
      const pending = loadPendingLocal();
      pending[cardId] = updated;
      savePendingLocal(pending);

      // Update state for instant UI
      setFirestoreProgress((p) => ({
        ...p,
        [cardId]: updated,
      }));

      // Force queue refresh
      setNow(Date.now());
    },
    [user, chapterId, firestoreProgress, loadPendingLocal, savePendingLocal]
  );

  /** ---------- FLUSH LOCAL PENDING TO FIRESTORE ---------- */
  const flushPendingToFirestore = useCallback(async () => {
    if (!user || !chapterId) return;

    const pending = loadPendingLocal();
    const keys = Object.keys(pending);
    if (keys.length === 0) return;

    const results = await Promise.allSettled(
      keys.map((cardId) =>
        fetch("/api/review-progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cardId,
            chapterId,
            progress: pending[cardId],
          }),
        }).then((res) => {
          if (!res.ok) throw new Error(`Failed to save ${cardId}`);
          return res.json();
        })
      )
    );

    const failed = results.filter((r) => r.status === "rejected");
    if (failed.length > 0) {
      console.error("Failed to save some progress:", failed);
      return;
    }

    localStorage.removeItem(LOCAL_KEY);
  }, [user, chapterId, loadPendingLocal]);

  /** ---------- SET DAILY LIMIT ---------- */
  const setDailyLimit = useCallback(
    async (value: number) => {
      setDailyLimitState(value);
      await flushPendingToFirestore();

      if (!user?.uid) return;

      try {
        await fetch("/api/user-preferences", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dailyNewCardLimit: value }),
        });
      } catch (err) {
        console.error("Failed to save daily limit:", err);
      }
    },
    [user, flushPendingToFirestore]
  );

  /** ---------- SESSION MANAGEMENT ---------- */
  const initializeSession = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (_userId: string, _chapterId: string, _cards: CardContent[]) => {
      setIsSessionActive(true);
      setCurrentCardIndex(0);
      setIsCardFlipped(false);
      setIsSessionComplete(false);
      setError(null);
      setRepeatQueue([]);

      return () => {
        setIsSessionActive(false);
      };
    },
    []
  );

  const flipCard = useCallback(() => setIsCardFlipped(true), []);

  const handleReview = useCallback(
    async (score: number) => {
      const currentCardId = queue[currentCardIndex];
      if (!currentCardId) return;

      setIsSubmitting(true);
      try {
        await submitReview(currentCardId, score);

        if (score === 1) {
          // Move “Again” card to end of repeatQueue
          setRepeatQueue((q) => [...q, currentCardId]);
          setIsCardFlipped(false);
          return;
        }

        // Advance index or finish session
        if (currentCardIndex + 1 >= queue.length) {
          setIsSessionComplete(true);
          setIsSessionActive(false);
          await flushPendingToFirestore();
        } else {
          setCurrentCardIndex((i) => i + 1);
          setIsCardFlipped(false);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setIsSubmitting(false);
      }
    },
    [queue, currentCardIndex, submitReview, flushPendingToFirestore]
  );

  return {
    loading: loading || !user,
    queue,
    getNextCard,
    submitReview,
    flushPendingToFirestore,
    dailyLimit: dailyLimitState,
    setDailyLimit,
    currentCardIndex,
    reviewQueue: queue,
    isCardFlipped,
    error,
    isSessionActive,
    isSessionComplete,
    isSubmitting,
    initializeSession,
    flipCard,
    handleReview,
  };
}
