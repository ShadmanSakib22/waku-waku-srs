// lib/sm2-scheduler.ts
/**
 * SM-2 Scheduling (MVP) for rapid chapter completion
 *
 * Goals:
 * - Help users learn entire chapter within ~3 days (50-80 words typical).
 * - Simple, deterministic scheduling suitable for MVP.
 * - Daily new card limit computed from chapter size.
 * - Cap immediate requeues to avoid infinite rapid repeats.
 *
 * Notes:
 * - All intervals are expressed in hours (and stored as hours in CardState.lastInterval).
 * - nextReview is a Unix timestamp in milliseconds.
 */

/* ----------------------- TYPES ----------------------- */
export interface CardState {
  cardId: string;
  easeFactor: number;
  repetitions: number;
  lastInterval: number; // hours
  nextReview: number; // unix ms
}

/* --------------------- CONFIG ------------------------ */
const DEFAULT_EF = 2.5;
const MIN_EF = 1.3;

// High-frequency base intervals (hours)
const I1_HOURS = 5; // first successful repetition
const I2_HOURS = 48; // second successful repetition

// Immediate requeue cap: when user fails (q < 3) we requeue soon but not instantly.
// Use a short delay to allow cognitive reset (in minutes converted to hours).
const IMMEDIATE_REQUEUE_MINUTES = 10;
const IMMEDIATE_REQUEUE_HOURS = IMMEDIATE_REQUEUE_MINUTES / 60;

// Maximum number of immediate requeues we allow for a card within its stored state
// We do not persist a per-session counter here (kept simple) — this cap prevents
// nextReview being set to 'now' which may cause tight loops.
const CAP_IMMEDIATE_REQUEUE = true;

/* --------------------- HELPERS ----------------------- */

function clampEF(ef: number) {
  if (ef < MIN_EF) return MIN_EF;
  return Math.round(ef * 100) / 100;
}

/**
 * Calculate new Ease Factor using SM-2 formula variant.
 * EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
 */
function calculateEF(currentEF: number, quality: number) {
  const q = Math.max(0, Math.min(5, quality));
  const newEF = currentEF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  return clampEF(newEF);
}

/**
 * Calculate next interval (hours) based on repetition count.
 */
function calculateInterval(
  repetitions: number,
  ef: number,
  lastInterval: number
) {
  if (repetitions === 1) return I1_HOURS;
  if (repetitions === 2) return I2_HOURS;
  // For n > 2
  const next = lastInterval * ef;
  return Math.ceil(next);
}

/**
 * Compute a daily new-card limit given a chapter size and target days.
 * Default targetDays = 3 to finish chapter in ~3 days.
 */
export function computeDailyNewLimit(chapterSize: number, targetDays = 3) {
  if (!chapterSize || chapterSize <= 0) return 1;
  return Math.max(1, Math.ceil(chapterSize / targetDays));
}

/* -------------------- MAIN LOGIC --------------------- */

/**
 * Initialize a new card's progress state.
 */
export const initializeNewCard = (cardId: string): CardState => ({
  cardId,
  easeFactor: DEFAULT_EF,
  repetitions: 0,
  lastInterval: 0,
  nextReview: 0, // 0 indicates new/unseen
});

/**
 * Process a review and return updated CardState.
 * - quality: 0..5 (SM-2 scale)
 *
 * Behavior notes (MVP):
 * - q < 3: reset repetitions to 0, set short requeue (IMMEDIATE_REQUEUE_MINUTES) to allow quick reattempt.
 *   This prevents infinite immediate requeues by using a short delay instead of 'now'.
 * - q >= 3: increment repetitions and compute next interval using EF.
 * - EF is updated on every review per SM-2 formula.
 *
 * The function is deterministic and side-effect free.
 */
export const processReview = (
  current: CardState,
  quality: number
): CardState => {
  const now = Date.now();
  const currentEF =
    typeof current.easeFactor === "number" ? current.easeFactor : DEFAULT_EF;
  const ef = calculateEF(currentEF, quality);

  let newRepetitions = current.repetitions;
  let nextIntervalHours = current.lastInterval;

  if (quality < 3) {
    // Failure: reset repetitions and assign a short requeue window
    newRepetitions = 0;
    if (CAP_IMMEDIATE_REQUEUE) {
      nextIntervalHours = IMMEDIATE_REQUEUE_HOURS;
    } else {
      // immediate (now), but we avoid exact now to prevent tight loops
      nextIntervalHours = 0;
    }
  } else {
    // Success: increment repetitions and compute interval
    newRepetitions = (current.repetitions ?? 0) + 1;
    nextIntervalHours = calculateInterval(
      newRepetitions,
      ef,
      current.lastInterval || I1_HOURS
    );
  }

  const nextReviewMs = now + Math.round(nextIntervalHours * 60 * 60 * 1000);

  return {
    ...current,
    easeFactor: ef,
    repetitions: newRepetitions,
    lastInterval: nextIntervalHours,
    nextReview: nextReviewMs,
  };
};
