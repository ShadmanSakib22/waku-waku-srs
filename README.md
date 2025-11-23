# Waku-Waku-SRS

**Unofficial flashcard app for WakuWaku Nihongo Textbook by Keirinkan**.  
Waku-Waku-SRS is designed to help learners efficiently memorize vocabulary and kanji from the textbook using a spaced repetition system (SRS) based on the **SM-2 algorithm**.

---

## 🎯 Project Goals

- Provide a **smart flashcard system** for WakuWaku Nihongo learners.
- Implement **Anki-style scheduling** with:
  - Lesson steps for new cards (e.g., 10min → 1h)
  - Standard SM-2 intervals for graduated cards.
- Allow **daily limits** on new cards to prevent overload.
- Support multiple sessions per day with progress synchronized across devices via **Firestore**.

---

## ⚙️ How It Works

1. **Deck Structure**

   - Each chapter has a static JSON deck stored at `public/decks/{chapter}.json`.
   - Decks contain key vocabulary and some bonus cards.

2. **Scheduling Algorithm**

   - New cards go through **learning steps** before graduating to review mode.
   - **SM-2 algorithm** manages review intervals based on self-scoring:
     - `Again / Hard / Good / Easy`
   - Core logic is implemented in `lib/sm2-scheduler.ts`.

3. **Study Session**

   - Sessions are loaded via `hooks/useStudySession.ts`.
   - Tracks:
     - Current card index
     - Queue of due cards
     - Session completion
     - User’s daily limit
   - Cards marked "Again" are moved to the end of the queue.
   - Completed sessions update Firestore via **Firebase Admin SDK**.

4. **Authentication**

   - Users sign in with Google or GitHub.
   - Auth handled securely via **Firebase Auth** and cookies.

5. **Audio Playback**
   - Plays Japanese pronunciation for each card.
   - Works best in Chromium-based browsers (Chrome, Edge, etc.).

---

## 🛠 Tech Stack

- **Frontend:** Next.js 16, React
- **Backend / Data:** Firebase Auth, Firestore, Firebase Admin SDK
- **Scheduling:** SM-2 Algorithm (`lib/sm2-scheduler.ts`)
- **Hooks:** `useStudySession.ts` handles session logic
- **Styling:** Tailwind CSS
- **Icons:** Lucide React

---

## 🔧 Customization & Contributions

1. **Decks**

   - Modify or add chapters by editing `public/decks/{chapter}.json`.
   - Update Deck metadata at `lib/deck-info.ts`.
   - Due logic at `lib/dashboard-data.ts`.

2. **SM-2 Logic**

   - Adjust learning steps, intervals, or scoring in `lib/sm2-scheduler.ts`.

3. **Session Behavior**

   - Change how the daily limit works or session flow in `hooks/useStudySession.ts`.

4. **Audio**

   - Audio playback relies on the Web Speech API (`speechSynthesis`) in browsers.
   - Improve cross-browser support by integrating external TTS if needed.

5. **Contributions**
   - Fork the repository for your own use case.
   - Open a pull request with improvements or new decks.

---

## ⚡ Notes

- Daily limit prevents new cards from overwhelming the user but **due cards are always included**, so repeated sessions may include previously studied cards.
- Changing limit is not required to start studying a new session on the same day. Limit only defines the number of possible new cards for a single session.
- Avoid Starting too many sessions a day or decrease the limit (default 20) to prevent having too many due.
- Session completion is determined dynamically based on the current queue of due cards and new cards.
- Progress syncing ensures **cross-device continuity** via Firestore.
- Progress syncing occurs at session completion only, otherwise progress is saved locally. **Complete sessions to keep Progress!**

---

## 📄 License

This project is open for personal and educational use. Contributions are welcome.

---

> **Disclaimer:** This app is **unofficial** and not affiliated with Keirinkan. Use it at your own discretion for study purposes.
