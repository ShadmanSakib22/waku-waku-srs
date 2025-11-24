// lib/sm2-scheduler.ts
/**
 * SM-2 Scheduler with Anki-Style Learning Steps
 *
 * Implements:
 * - Learning steps for new cards (e.g., 10m → 1h)
 * - Hard/Again/Good/Easy scores (for self-scoring)
 * - SM-2 scheduling for graduated cards
 *
 * Learning mode follows Anki conventions:
 * Again: restart learning at step 0
 * Hard: remain in current step with extended delay
 * Good: advance to next learning step
 * Easy: immediate graduation into review mode
 *
 * Review mode follows SM-2:
 * q < 3: lapse → return to learning step 0
 * q ≥ 3: interval increases according to EF and repetition count
 */

/* ----------------------- TYPES ----------------------- */

export interface CardState {
  cardId: string;

  // SM-2 scheduling fields
  easeFactor: number;
  repetitions: number;
  lastInterval: number; // days

  // Learning-state fields
  isLearning: boolean;
  learningStepIndex: number;

  nextReview: number; // ms timestamp
}

/* ----------------------- CONFIG ----------------------- */

// EF defaults per SM-2
const DEFAULT_EF = 2.5;
const MIN_EF = 1.3;

// Learning steps (in minutes)
const LEARNING_STEPS = [10, 60];

// Hard button multiplier during learning
const HARD_LEARNING_MULTIPLIER = 1.2;

/* ---------------------- HELPERS ----------------------- */

function clampEF(ef: number): number {
  return Math.max(MIN_EF, Math.round(ef * 100) / 100);
}

/**
 * SM-2 ease factor update function.
 * Source: SuperMemo-2 specification.
 */
function calculateEF(currentEF: number, quality: number): number {
  const q = Math.max(0, Math.min(5, quality));
  const newEF = currentEF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  return clampEF(newEF);
}

/**
 * SM-2 interval progression logic.
 * Uses:
 * 1 day → 6 days → EF growth
 */
function calculateSM2Interval(
  reps: number,
  ef: number,
  lastInterval: number
): number {
  if (reps === 1) return 1;
  if (reps === 2) return 6;
  return Math.round(lastInterval * ef);
}

/* ------------------ INITIALIZATION -------------------- */

export function initializeNewCard(cardId: string): CardState {
  return {
    cardId,
    easeFactor: DEFAULT_EF,
    repetitions: 0,
    lastInterval: 0,
    isLearning: true,
    learningStepIndex: 0,
    nextReview: 0,
  };
}

/* ---------------------- SCHEDULER ---------------------- */
/**
 * Unified review handler for learning and review cards.
 *
 * quality values:
 * 0 = Again
 * 1 = Hard
 * 2 = Good
 * 3 = Easy
 */
export function processReview(current: CardState, quality: number): CardState {
  const now = Date.now();
  const ef = calculateEF(current.easeFactor, quality);

  /* ------------------------------------------------------
   * Learning Mode
   * ------------------------------------------------------ */
  if (current.isLearning) {
    const step = current.learningStepIndex;

    switch (quality) {
      case 0: // Again (Score 1 in UI)
      case 1: {
        // Map Score 1 to Case 0 behavior if passed incorrectly, but usually:
        // Score 1 (Again) -> quality 1? No, usually mapped 1->1.
        // Wait, UI sends scores 1,3,4,5.
        // SM-2 usually uses 0-5.
        // Let's assume input 'quality' is the raw score from UI (1,3,4,5)

        // If input is 1 (Again):
        if (quality <= 1) {
          // Again: restart learning from first step
          const delay = LEARNING_STEPS[0];
          return {
            ...current,
            easeFactor: ef,
            learningStepIndex: 0,
            nextReview: now + delay * 60 * 1000,
          };
        }
        break;
        // Fallthrough is tricky with switch/if mix. Let's strictly stick to logic below.
      }
    }

    // Re-implementing switch to handle specific UI scores safely
    // UI Sends: 1 (Again), 3 (Hard), 4 (Good), 5 (Easy)

    if (quality === 1) {
      // Again
      const delay = LEARNING_STEPS[0];
      return {
        ...current,
        easeFactor: ef,
        learningStepIndex: 0,
        nextReview: now + delay * 60 * 1000,
      };
    }

    if (quality === 3) {
      // Hard
      const base = LEARNING_STEPS[step];
      const delay = Math.round(base * HARD_LEARNING_MULTIPLIER);
      return {
        ...current,
        easeFactor: ef,
        learningStepIndex: step,
        nextReview: now + delay * 60 * 1000,
      };
    }

    if (quality === 4) {
      // Good
      const nextStep = step + 1;

      if (nextStep < LEARNING_STEPS.length) {
        const delay = LEARNING_STEPS[nextStep];
        return {
          ...current,
          easeFactor: ef,
          learningStepIndex: nextStep,
          nextReview: now + delay * 60 * 1000,
        };
      }

      // Graduation
      const interval = 1;
      return {
        ...current,
        easeFactor: ef,
        isLearning: false,
        repetitions: 1,
        lastInterval: interval,
        learningStepIndex: 0,
        nextReview: now + interval * 24 * 60 * 60 * 1000,
      };
    }

    if (quality >= 5) {
      // Easy
      const interval = 4;
      return {
        ...current,
        easeFactor: ef,
        isLearning: false,
        repetitions: 1,
        lastInterval: interval,
        learningStepIndex: 0,
        nextReview: now + interval * 24 * 60 * 60 * 1000,
      };
    }
  }

  /* ------------------------------------------------------
   * Review Mode (SM-2)
   * ------------------------------------------------------ */
  if (quality < 3) {
    // Lapse: return to learning state, step 0
    return {
      ...current,
      easeFactor: ef,
      isLearning: true,
      repetitions: 0,
      lastInterval: 0,
      learningStepIndex: 0,
      nextReview: now + LEARNING_STEPS[0] * 60 * 1000,
    };
  }

  // Successful review
  const newReps = current.repetitions + 1;
  const interval = calculateSM2Interval(newReps, ef, current.lastInterval || 1);

  return {
    ...current,
    easeFactor: ef,
    repetitions: newReps,
    lastInterval: interval,
    nextReview: now + interval * 24 * 60 * 60 * 1000,
  };
}
