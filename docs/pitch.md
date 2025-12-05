# Pitch -StudySwap

**Track:** Thin UI

**Product:** StudySwap is a collaborative study platform where students “pay in” with their own flashcards to unlock a shared pool of study material. Instead of passively consuming someone else’s work, each student must contribute at least 10 flashcards or questions before they can access decks created by others.

**User:** StudySwap is designed for college students preparing for quizzes, midterms, and finals. It works especially well for concept-heavy courses where flashcards are useful.

**Problem:** Many students rely almost entirely on their own study materials: notes, personal flashcards, and questions they write themselves. That’s helpful, but it has a big limitation—when you create all the questions, you usually write what you already understand. You end up drilling things you’re comfortable with and rarely see questions that expose your blind spots. Without input from peers who are studying the same material in slightly different ways, it’s easy to feel “prepared” while still missing key concepts or problem styles.

**Core Data Entities:** 
- **Users** – identifies each student and tracks how many cards they’ve contributed.
- **Decks** – group flashcards by course or topic (e.g., “CSCI 4208 — HTTP & REST”).
- **Cards** – individual flashcards with a prompt/question and answer/explanation.
