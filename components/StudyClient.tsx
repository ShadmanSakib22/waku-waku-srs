/* eslint-disable @typescript-eslint/no-explicit-any */
// components/StudyClient.tsx with Slider-based SM‑2 scoring

"use client";

import { useEffect, useState, useRef } from "react";
import { useStudySession, CardContent } from "@/hooks/useStudySession";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Card,
  CardContent as CardC,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ArrowRight,
  Volume2,
  BookOpen,
  Lightbulb,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";

/* -------------------------------------------------------------------------- */
/*                                PROPS TYPES                                */
/* -------------------------------------------------------------------------- */
interface StudyClientProps {
  chapterId: string;
  userId: string;
  staticDeckContent: CardContent[];
}

/* -------------------------------------------------------------------------- */
/*                            SCORING DEFINITIONS                             */
/* -------------------------------------------------------------------------- */
const scoreLabels = [
  { score: 0, label: "Forgot", description: "Complete blackout" },
  { score: 1, label: "Hard", description: "Remembered barely" },
  { score: 2, label: "Difficult", description: "Got it wrong" },
  { score: 3, label: "OK", description: "Serious difficulty" },
  { score: 4, label: "Good", description: "After hesitation" },
  { score: 5, label: "Perfect", description: "Instant recall" },
];

/* -------------------------------------------------------------------------- */
/*                              MAIN COMPONENT                                */
/* -------------------------------------------------------------------------- */
export function StudyClient({
  chapterId,
  userId,
  staticDeckContent,
}: StudyClientProps) {
  const currentCardIndex = useStudySession((s) => s.currentCardIndex);
  const reviewQueue = useStudySession((s) => s.reviewQueue);
  const isCardFlipped = useStudySession((s) => s.isCardFlipped);
  const loading = useStudySession((s) => s.loading);
  const error = useStudySession((s) => s.error);
  const isSessionActive = useStudySession((s) => s.isSessionActive);
  const isSessionComplete = useStudySession((s) => s.isSessionComplete);
  const nextReviewTime = useStudySession((s) => s.nextReviewTime);

  const initializeSession = useStudySession((s) => s.initializeSession);
  const flipCard = useStudySession((s) => s.flipCard);
  const handleReview = useStudySession((s) => s.handleReview);

  const currentCard = reviewQueue[currentCardIndex] || null;
  const [showRomaji, setShowRomaji] = useState(false);
  const [score, setScore] = useState(3);

  const initializedRef = useRef(false);

  /* --------------------------- Initialize Session -------------------------- */
  useEffect(() => {
    if (
      !initializedRef.current &&
      userId &&
      chapterId &&
      staticDeckContent.length > 0
    ) {
      initializedRef.current = true;
      const unsub = initializeSession(userId, chapterId, staticDeckContent);
      return () => unsub && unsub();
    }
  }, [userId, chapterId, staticDeckContent, initializeSession]);

  /* ------------------------------- Speech API ------------------------------ */
  const speakKanji = (text: string) => {
    if (!("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    const jpVoice = speechSynthesis.getVoices().find((v) => v.lang === "ja-JP");
    if (jpVoice) u.voice = jpVoice;
    u.lang = "ja-JP";
    speechSynthesis.speak(u);
  };

  /* ------------------------------- Render Cases ---------------------------- */
  if (loading) return <LoadingState chapterId={chapterId} />;
  if (error) return <ErrorState error={error} />;
  if (isSessionComplete)
    return (
      <SessionComplete chapterId={chapterId} nextReviewTime={nextReviewTime} />
    );
  if (!isSessionActive || !currentCard)
    return <LoadingState chapterId={chapterId} />;

  /* --------------------------- Main Study UI --------------------------- */
  return (
    <div className="min-h-screen flex flex-col items-center p-6 bg-background text-foreground">
      <Header chapterId={chapterId} />

      {/* Progress Bar */}
      <ProgressBar />

      <Card className="w-full max-w-xl mt-4 p-6 shadow-xl">
        <CardC>
          {/* FRONT */}
          {!isCardFlipped && (
            <FrontCard
              card={currentCard}
              showRomaji={showRomaji}
              setShowRomaji={setShowRomaji}
              flipCard={flipCard}
              speakKanji={speakKanji}
            />
          )}

          {/* BACK */}
          {isCardFlipped && (
            <BackCard
              card={currentCard}
              score={score}
              setScore={setScore}
              handleReview={handleReview}
            />
          )}
        </CardC>
      </Card>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                             PROGRESS BAR                                  */
/* -------------------------------------------------------------------------- */
function ProgressBar() {
  const total = useStudySession((s) => s.reviewQueue.length);
  const index = useStudySession((s) => s.currentCardIndex);

  const remaining = Math.max(total - index - 1, 0);
  const progress = total > 0 ? ((index + 1) / total) * 100 : 0;

  return (
    <div className="w-full max-w-xl mt-4">
      <div className="text-sm mb-1 text-muted-foreground text-center">
        {remaining} card(s) left
      </div>
      <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
        <div className="bg-primary h-2" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                   FRONT                                    */
/* -------------------------------------------------------------------------- */
function FrontCard({
  card,
  showRomaji,
  setShowRomaji,
  flipCard,
  speakKanji,
}: any) {
  return (
    <div className="flex flex-col items-center space-y-6">
      <h1 className="text-8xl font-bold select-none">{card.kanji}</h1>

      {showRomaji ? (
        <p className="text-3xl font-mono text-primary">{card.romaji}</p>
      ) : (
        <Button variant="secondary" onClick={() => setShowRomaji(true)}>
          <BookOpen className="mr-2 h-5 w-5" /> Show Romaji
        </Button>
      )}

      <div className="flex gap-4 pt-4">
        <Button variant="secondary" onClick={() => speakKanji(card.kanji)}>
          <Volume2 className="mr-2 h-5 w-5" /> Audio
        </Button>
        <Button onClick={flipCard}>
          Flip
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                    BACK                                    */
/* -------------------------------------------------------------------------- */
function BackCard({ card, score, setScore, handleReview }: any) {
  const scoreObj = scoreLabels.find((s) => s.score === score)!;

  const submit = async () => {
    await handleReview(score);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Meaning</h3>
        <p className="text-2xl font-bold">{card.description}</p>
      </div>

      {/* Tooltip for scoring meanings */}
      <Tooltip>
        <TooltipTrigger className="flex items-center gap-2 cursor-help text-primary">
          <Lightbulb className="h-5 w-5" /> How scoring works
        </TooltipTrigger>
        <TooltipContent className="space-y-1 p-3 max-w-xs">
          {scoreLabels.map((s) => (
            <p key={s.score} className="text-sm">
              <strong>
                {s.score} — {s.label}:
              </strong>{" "}
              {s.description}
            </p>
          ))}
        </TooltipContent>
      </Tooltip>

      {/* Slider */}
      <div className="mt-4 px-2">
        <Slider
          min={0}
          max={5}
          step={1}
          value={[score]}
          onValueChange={(v) => setScore(v[0])}
        />
        <p className="text-center mt-2 text-lg font-medium">
          {score} — {scoreObj.label}
        </p>
      </div>

      <Button className="w-full mt-4" onClick={submit}>
        Next
      </Button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                               HEADER BAR                                   */
/* -------------------------------------------------------------------------- */
function Header({ chapterId }: any) {
  return (
    <Card className="w-full max-w-xl p-4 bg-primary text-primary-foreground shadow-md">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">
          Studying — {chapterId}
        </CardTitle>
      </CardHeader>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*                            SESSION COMPLETE                                 */
/* -------------------------------------------------------------------------- */
function SessionComplete({ chapterId, nextReviewTime }: any) {
  const nextTime = nextReviewTime
    ? new Date(nextReviewTime).toLocaleString()
    : "later";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background text-foreground">
      <Card className="p-8 max-w-lg text-center space-y-6 shadow-xl">
        <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" />
        <h1 className="text-3xl font-bold">Session Complete 🎉</h1>
        <p className="text-lg">
          You&apos;ve finished everything due in <strong>{chapterId}</strong>.
        </p>
        <p className="text-md text-muted-foreground">
          Next review: <strong>{nextTime}</strong>
        </p>

        <Link href="/">
          <Button className="mt-4 w-full">Return to Dashboard</Button>
        </Link>
      </Card>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                               LOADING / ERROR                               */
/* -------------------------------------------------------------------------- */
function LoadingState({ chapterId }: any) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <p className="text-xl font-semibold">Loading {chapterId}…</p>
    </div>
  );
}

function ErrorState({ error }: any) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <Card className="p-8 border-destructive text-center max-w-lg">
        <h2 className="text-red-600 text-xl font-bold mb-2">Error</h2>
        <p>{error}</p>
        <Link href="/">
          <Button variant="secondary" className="mt-4">
            Return
          </Button>
        </Link>
      </Card>
    </div>
  );
}
