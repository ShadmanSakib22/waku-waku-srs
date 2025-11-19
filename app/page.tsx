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
          Learn Vocabulary by smart spaced-repitions
        </h1>
        <p className="text-xl text-muted-foreground">
          Unofficial companion app for Waku Waku Nihongo Textbook © Keirinkan.
          More features coming soon!
        </p>

        <p className="text-xl text-muted-foreground mt-4 flex items-center flex-wrap">
          <CircleQuestionMark className="text-primary inline size-6 mr-2" />
          <span> SM-2 Alogorithm powered Flashcards.</span>
        </p>
        <ul className="font-mono text-muted-foreground text-sm list-disc px-4">
          <li>
            High frequency SM-2 Alogrithm for mastering lesson vocabulary in 3
            days time.
          </li>
          <li>Study 1 lesson at a time for best efficiency.</li>
          <li>Review 2x a day with at least 5 hour break in between.</li>
          {/*todo: add demo link */}
          <li>
            Video Demo: <a href="https://www.youtube.com/">[demo link]</a>
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
