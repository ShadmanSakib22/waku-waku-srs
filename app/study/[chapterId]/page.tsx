// app/study/[chapterId]/page.tsx
import "server-only";
import { protectRoute } from "@/lib/auth-server";
import { StudyClient } from "@/components/StudyClient";

// utility: loads only the requested chapter deck
async function loadDeck(chapterId: string) {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL}/decks/${chapterId}.json`,
      {
        cache: "no-store",
      }
    );

    if (!res.ok) {
      console.warn("Deck not found:", chapterId);
      return [];
    }

    return await res.json();
  } catch (err) {
    console.error("Deck load error:", err);
    return [];
  }
}

interface StudyPageProps {
  params: Promise<{ chapterId: string }>;
}

export default async function StudyPage({ params }: StudyPageProps) {
  const user = await protectRoute();
  try {
    const { chapterId } = await params;

    if (!chapterId) {
      throw new Error("Invalid chapter ID");
    }

    // Load only the required deck file dynamically
    const deck = await loadDeck(chapterId);

    if (!deck || deck.length === 0) {
      return (
        <div className="container flex justify-center items-center h-screen bg-muted">
          <h1 className="text-xl text-muted-foreground">
            <b className="uppercase">{chapterId.replace("-", "#")}</b> not found
            or contains no cards.
          </h1>
        </div>
      );
    }

    return (
      <StudyClient
        chapterId={chapterId}
        userId={user.uid}
        staticDeckContent={deck}
      />
    );
  } catch (err) {
    console.error("Error rendering study page:", err);
    return (
      <div className="container flex justify-center items-center h-screen bg-muted">
        <h1 className="text-xl text-red-500">
          Failed to load chapter. Please try again.
        </h1>
      </div>
    );
  }
}
