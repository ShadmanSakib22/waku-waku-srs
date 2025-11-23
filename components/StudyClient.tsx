// components/StudyClient.tsx

"use client";

import { useEffect, useRef, useState } from "react";
import { useStudySession } from "@/hooks/useStudySession";
import type { CardContent } from "@/hooks/useStudySession";
import useAuth from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent as CardC } from "@/components/ui/card";
import { ArrowRight, Volume2, BookOpen, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* PROPS TYPES                                                                */
/* -------------------------------------------------------------------------- */
interface StudyClientProps {
  chapterId: string;
  userId: string;
  staticDeckContent: CardContent[];
}

interface FrontCardProps {
  card: CardContent;
  showRomaji: boolean;
  setShowRomaji: (v: boolean) => void;
  flipCard: () => void;
  speakKanji: (text: string) => void;
}

interface BackCardProps {
  card: CardContent;
  handleReview: (score: number) => Promise<void>;
  isSubmitting: boolean;
}

interface ChapterIdProps {
  chapterId: string;
}

/* -------------------------------------------------------------------------- */
/* SCORING CONFIG                                  */
/* -------------------------------------------------------------------------- */
// Standard SM-2 Mapping
// 1 = Fail (Reset)
// 3 = Hard (Pass, heavy penalty)
// 4 = Good (Pass, normal)
// 5 = Easy (Pass, bonus)
const RESPONSE_OPTIONS = [
  {
    score: 1,
    label: "Again",
    subLabel: "Forgot",
    color:
      "bg-destructive/10 text-destructive hover:bg-destructive/20 border-destructive/50",
    hotkey: "1",
  },
  {
    score: 3,
    label: "Hard",
    subLabel: "Struggled",
    color:
      "bg-orange-500/10 text-orange-700 hover:bg-orange-500/20 border-orange-500/50",
    hotkey: "2",
  },
  {
    score: 4,
    label: "Good",
    subLabel: "Recalled",
    color:
      "bg-green-500/10 text-green-700 hover:bg-green-500/20 border-green-500/50",
    hotkey: "3",
  },
  {
    score: 5,
    label: "Easy",
    subLabel: "Instant",
    color:
      "bg-blue-500/10 text-blue-700 hover:bg-blue-500/20 border-blue-500/50",
    hotkey: "4",
  },
];

/* -------------------------------------------------------------------------- */
/* MAIN COMPONENT                                */
/* -------------------------------------------------------------------------- */
export function StudyClient({
  chapterId,
  userId,
  staticDeckContent,
}: StudyClientProps) {
  const { user, loading: authLoading } = useAuth();

  const {
    currentCardIndex,
    reviewQueue,
    isCardFlipped,
    loading,
    error,
    isSessionActive,
    isSessionComplete,
    isSubmitting,
    initializeSession,
    flipCard,
    handleReview,
  } = useStudySession({ chapterId, allCards: staticDeckContent });

  const currentCardId = reviewQueue[currentCardIndex] || null;
  const currentCard =
    staticDeckContent.find((c) => c.id === currentCardId) || null;
  const [showRomaji, setShowRomaji] = useState(false);
  const initializedRef = useRef(false);
  const unsubRef = useRef<(() => void) | null>(null);

  /* --------------------------- Initialize Session -------------------------- */
  useEffect(() => {
    if (
      !initializedRef.current &&
      !authLoading &&
      user &&
      userId &&
      chapterId &&
      staticDeckContent.length > 0
    ) {
      initializedRef.current = true;
      (async () => {
        unsubRef.current = await initializeSession(
          userId,
          chapterId,
          staticDeckContent
        );
      })();
    }
    return () => {
      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
      }
    };
  }, [
    authLoading,
    user,
    userId,
    chapterId,
    staticDeckContent,
    initializeSession,
  ]);

  /* --------------------------- Keyboard Shortcuts -------------------------- */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isSubmitting) return;

      if (!isCardFlipped) {
        if (e.code === "Space" || e.code === "Enter") {
          e.preventDefault();
          flipCard();
        }
      } else {
        // Handle number keys for scoring
        const option = RESPONSE_OPTIONS.find((opt) => opt.hotkey === e.key);
        if (option) {
          handleReview(option.score);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isCardFlipped, isSubmitting, flipCard, handleReview]);

  /* ------------------------------- Speech API ------------------------------ */
  const speakKanji = (text: string) => {
    if (!("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    // Prefer Japanese voice
    const jpVoice = speechSynthesis.getVoices().find((v) => v.lang === "ja-JP");
    if (jpVoice) u.voice = jpVoice;
    u.lang = "ja-JP";
    speechSynthesis.speak(u);
  };

  /* ------------------------------- Render Cases ---------------------------- */
  if (authLoading || loading) return <LoadingState chapterId={chapterId} />;
  if (error) return <ErrorState error={error} />;
  if (isSessionComplete) return <SessionComplete chapterId={chapterId} />;
  if (!isSessionActive || !currentCard)
    return <LoadingState chapterId={chapterId} />;

  /* --------------------------- Main Study UI --------------------------- */
  return (
    <div className="min-h-screen flex flex-col items-center p-4 md:p-6 bg-background text-foreground">
      <Header chapterId={chapterId} />
      <ProgressBar total={reviewQueue.length} index={currentCardIndex} />

      <Card className="w-full max-w-xl mt-6 p-6 md:p-10 shadow-xl min-h-[400px] flex flex-col justify-between transition-all">
        <CardC className="h-full flex flex-col p-0">
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
              handleReview={handleReview}
              isSubmitting={isSubmitting}
            />
          )}
        </CardC>
      </Card>

      {/* Helper text for shortcuts */}
      <div className="mt-6 text-xs text-muted-foreground hidden md:block">
        {!isCardFlipped
          ? "Press [Space] to flip"
          : "Press [1] Again · [2] Hard · [3] Good · [4] Easy"}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* PROGRESS BAR                                  */
/* -------------------------------------------------------------------------- */
function ProgressBar({ total, index }: { total: number; index: number }) {
  const remaining = Math.max(total - index, 0);
  const progress = total > 0 ? (index / total) * 100 : 0;

  return (
    <div className="w-full max-w-xl mt-4">
      <div className="flex justify-between text-xs text-muted-foreground mb-2">
        <span>Progress</span>
        <span>{remaining} remaining</span>
      </div>
      <div className="w-full bg-secondary rounded-full h-2.5 overflow-hidden">
        <div
          className="bg-primary h-full transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* FRONT                                    */
/* -------------------------------------------------------------------------- */
function FrontCard({
  card,
  showRomaji,
  setShowRomaji,
  flipCard,
  speakKanji,
}: FrontCardProps) {
  return (
    <div className="flex flex-col items-center grow justify-center space-y-8 animate-in fade-in duration-300">
      <div className="text-center space-y-4">
        <h1 className="text-6xl md:text-7xl font-bold select-none text-foreground">
          {card.kanji}
        </h1>

        <div className="h-8">
          {showRomaji ? (
            <p className="text-2xl font-mono text-primary animate-in slide-in-from-top-2">
              {card.romaji}
            </p>
          ) : (
            <span className="text-sm text-muted-foreground/30 select-none">
              ???
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 w-full max-w-xs pt-8">
        <Button size="lg" className="w-full text-lg h-12" onClick={flipCard}>
          Show Answer <ArrowRight className="ml-2 h-5 w-5" />
        </Button>

        <div className="flex gap-2 justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => speakKanji(card.kanji)}
          >
            <Volume2 className="mr-2 h-4 w-4" /> Audio
          </Button>
          {!showRomaji ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setShowRomaji(true);
              }}
            >
              <BookOpen className="mr-2 h-4 w-4" /> Show Romaji
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setShowRomaji(false);
              }}
            >
              <BookOpen className="mr-2 h-4 w-4" /> Hide Romaji
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* BACK                                                                       */
/* -------------------------------------------------------------------------- */
function BackCard({ card, handleReview, isSubmitting }: BackCardProps) {
  return (
    <div className="flex flex-col grow justify-between animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Content Top */}
      <div className="text-center space-y-4 pt-4">
        <div className="text-3xl font-bold text-foreground">{card.kanji}</div>
        <div className="text-xl font-mono text-primary">{card.romaji}</div>
        <hr className="border-border w-1/2 mx-auto my-4" />
        <div className="space-y-2">
          <h3 className="text-xs uppercase tracking-widest text-muted-foreground">
            Meaning
          </h3>
          <p className="text-2xl font-medium leading-relaxed">
            {card.description}
          </p>
        </div>
      </div>

      {/* Action Buttons Bottom */}
      <div className="pt-8 pb-2">
        <div className="grid grid-cols-4 gap-2 md:gap-4">
          {RESPONSE_OPTIONS.map((option) => (
            <Button
              key={option.score}
              variant="outline"
              className={cn(
                "h-24 flex flex-col gap-1 border-2 transition-all hover:scale-105 active:scale-95",
                option.color
              )}
              onClick={() => handleReview(option.score)}
              disabled={isSubmitting}
            >
              <span className="text-lg font-bold">{option.label}</span>
              <span className="text-xs opacity-70 font-normal">
                {option.subLabel}
              </span>
            </Button>
          ))}
        </div>
        {isSubmitting && (
          <p className="text-center text-xs text-muted-foreground mt-2 animate-pulse">
            Saving progress...
          </p>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* HEADER BAR                                                                 */
/* -------------------------------------------------------------------------- */
function Header({ chapterId }: ChapterIdProps) {
  return (
    <div className="w-full max-w-xl flex items-center justify-between mb-2">
      <Link
        href="/"
        className="text-sm font-medium hover:underline text-muted-foreground"
      >
        ← Back
      </Link>
      <div className="text-sm font-semibold capitalize text-foreground">
        {chapterId.replace("-", " ")}
      </div>
      <div className="w-10" /> {/* Spacer for centering */}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* SESSION COMPLETE                                                           */
/* -------------------------------------------------------------------------- */
function SessionComplete({ chapterId }: ChapterIdProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background text-foreground">
      <Card className="p-10 max-w-lg text-center space-y-8 shadow-2xl border-2 border-primary/10">
        <div className="flex justify-center">
          <div className="rounded-full bg-green-100 p-4 dark:bg-green-900/30">
            <CheckCircle2 className="h-16 w-16 text-green-600 dark:text-green-400" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">
            Session Complete!
          </h1>
          <p className="text-muted-foreground text-lg">
            You&apos;ve finished the queue for <br />
            <strong className="capitalize text-foreground">
              {chapterId.replace("-", " ")}
            </strong>
          </p>
        </div>

        <div className="bg-secondary/50 p-4 rounded-lg">
          <p className="text-sm">
            Make sure to come back later to cement your memory.
          </p>
        </div>

        <Link href="/" className="block">
          <Button size="lg" className="w-full font-bold">
            Return to Dashboard
          </Button>
        </Link>
      </Card>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* LOADING / ERROR                                                            */
/* -------------------------------------------------------------------------- */
function LoadingState({ chapterId }: ChapterIdProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <div className="text-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
        <p className="text-lg font-medium capitalize animate-pulse">
          Loading {chapterId.replace("-", " ")}...
        </p>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ErrorState({ error }: any) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-4">
      <Card className="p-8 border-destructive/50 text-center max-w-lg shadow-lg">
        <h2 className="text-destructive text-xl font-bold mb-4">
          Something went wrong
        </h2>
        <p className="text-muted-foreground mb-6">{error}</p>
        <Link href="/">
          <Button variant="outline">Return to Dashboard</Button>
        </Link>
      </Card>
    </div>
  );
}
