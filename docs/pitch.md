# Pitch -StudySwap

**Track:** Thin UI

**Product:**  
StudySwap is a collaborative study platform where students build shared multiple-choice decks for their courses. A simple web app lets them log in, contribute flashcards, and study. A live “kiosk” mode lets an instructor run a quiz on a big screen while students join from their phones to submit answers in real time.

**User:**  
StudySwap is designed for college students preparing for exams in concept-heavy classes (e.g., computer science, history, biology). It also works for instructors or TAs who want a lightweight way to turn review sessions into interactive quizzes.

**Problem:**  
Many students study in isolation, building tiny decks that miss key ideas. Group review sessions often turn into passive lectures where only a few people participate. Instructors don’t get quick feedback on which concepts are actually understood.

**Solution / Core Experience:**  

- **Contribute cards:**  
  - Students log in with a simple display name.  
  - They select a course deck (e.g., “CSCI 4208 — HTTP & REST”).  
  - They add Q/A cards based on lectures, slides, or homework.  
  - The app tracks how many cards each user has contributed.

- **Contribution gate:**  
  - A user must contribute at least *N* cards (configurable) to a deck.  
  - Once they meet the threshold, they unlock full study access for that deck.  
  - This encourages everyone to “pay in” content before they “study out”.

- **Study mode (app view):**  
  - The app turns cards into multiple-choice questions using plausible distractors.  
  - Students get immediate feedback (correct / incorrect + explanation).  
  - The same `/api/decks/:deckId/study/next` and `/answer` endpoints power both solo study and live quiz.

- **Live quiz / kiosk mode:**  
  - A laptop or TV shows the **StudySwap Kiosk** view with the current question and a scoreboard.  
  - Students scan a QR code to open the **controller** on their phones.  
  - One “host” controller selects the deck for the room.  
  - All joined controllers tap their chosen answer; the kiosk checks correctness via the StudySwap API and updates scores.

**Core Data Entities:**  
- **Users** – identifies each student and tracks `name`, `contributedCount`, and whether they can study a deck.  
- **Decks** – group flashcards by course or topic (e.g., “CSCI 4208 — HTTP & REST”).  
- **Cards** – individual flashcards with a prompt/question (“front”) and answer/explanation (“back”).  
- **Study sessions (derived)** – not stored as a separate table, but represented by calls to the `/study/next` and `/answer` endpoints for each deck.
