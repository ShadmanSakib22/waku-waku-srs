// public/decks/deck-info.ts

// warning: changing will break default dashboard
export interface DeckInfo {
  id: string;
  title: string;
  totalCards: number;
}

// MODIFY - Add/Edit deck information for dashboard
// decks are loaded at: app/study/[chapterId]/page.tsx
// decks are saved as static json files at public; ${process.env.NEXT_PUBLIC_BASE_URL}/decks/${chapterId}.json
export const DECKS: DeckInfo[] = [
  {
    id: "chapter-6",
    title: "Chapter 6",
    totalCards: 58,
  },
  {
    id: "chapter-7",
    title: "Chapter 7",
    totalCards: 41,
  },
  {
    id: "chapter-8",
    title: "Chapter 8",
    totalCards: 72,
  },
];
