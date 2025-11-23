import { getCurrentUser } from "@/lib/auth-server";
import { getDashboardDecks } from "@/lib/dashboard-data";
import { Separator } from "@/components/ui/separator";
import DeckTable from "@/components/DeckTable";
import { CircleQuestionMark } from "lucide-react";

export default async function DashboardPage() {
  // 1. Fetch userId
  const user = await getCurrentUser();
  const userId = user?.uid;

  // 2. Fetch Decks
  let decks;
  if (userId) {
    decks = await getDashboardDecks(userId);
  } else decks = await getDashboardDecks("guest");

  return (
    <div className="container mx-auto py-10">
      <header className="mb-10 space-y-2">
        <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl">
          Learn with Smart Spaced Repetition
        </h1>
        <p className="text-xl text-muted-foreground">
          Unofficial companion app for Waku Waku Nihongo Textbook © Keirinkan.{" "}
          <br />
          Efficiently memorize lesson vocabulary using Anki-style flashcards.
        </p>

        <p className="text-xl text-muted-foreground mt-4 flex gap-2 items-center">
          <CircleQuestionMark className="text-primary size-5" />
          SM-2 Algorithm powered Flashcards.
        </p>
        <ul className="font-mono text-muted-foreground text-sm list-disc px-4">
          <li>
            New cards go through learning steps before graduating to spaced
            review.
          </li>
          <li>
            Review cards are scheduled automatically based on SM-2 algorithm and
            self-scoring.
          </li>
          <li>
            Manage your sessions with daily limits and sync progress at session
            end.
          </li>
          <li>
            Video Demo:{" "}
            <a
              href="https://www.youtube.com/"
              target="_blank"
              className="underline underline-offset-4"
            >
              Click to View
            </a>
          </li>
        </ul>
      </header>

      <Separator className="mb-10" />

      <section className="space-y-6">
        <h2 className="text-3xl font-semibold tracking-tight">
          Available Lessons
        </h2>
        <div className="border-4 border-double rounded-md overflow-hidden">
          {decks.map((deck) => (
            <DeckTable key={deck.id} deck={deck} />
          ))}
        </div>
      </section>
    </div>
  );
}
