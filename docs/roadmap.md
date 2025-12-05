# Roadmap — StudySwap

## MVP (Sprint 3)

The MVP (Sprint 3) delivers a vertical slice of StudySwap with at least one resource fully working end-to-end and the contribution gate enforced.

* **User Identification & Sessions**
  * Simple login flow (e.g., provide a display name or handle).
  * Session-based identification of the current user (`/api/me`).

* **Core Resources (MVP Scope)**
  * **Users**
    * Track `id`, `name`, and `contributedCount`.
  * **Decks**
    * Create and list decks for a course/topic.
  * **Cards**
    * Add cards to a deck.
    * List cards for a deck (subject to the contribution gate).

* **Contribution Gate**
  * Server enforces “must contribute at least 10 cards”:
    * Users below 10 contributed cards can only:
      * View their own profile and decks.
      * Create decks and submit cards.
    * Users with 10+ cards can:
      * Browse available decks.
      * View and study cards in those decks.

* **Study & Answering (MVP — Multiple Choice)**
  * Basic multiple-choice study flow:
    1. User chooses a deck to study.
    2. Client requests the next question from the server.
    3. Server selects a card in that deck and builds a multiple-choice question:
       * One **correct** option based on that card’s `back`.
       * Several **incorrect** options (distractors) pulled from the `back` values of other cards in the same deck.
       * Options are shuffled before being returned.
    4. Client shows the prompt (`front`) and the list of options.
    5. User selects an option and submits it to the server.
    6. Server checks whether the chosen option matches the correct answer and responds with:
       * `correct: true/false`
       * `correctAnswer` (the card’s `back`).
       * `selectedAnswer` (what the user picked).

* **Error Handling & JSON Responses**
  * Central error handler returning consistent JSON error shapes.
  * Clear 4xx/5xx responses for invalid input, unauthorized access, or missing resources.

## Full Features (Sprint 4)

Sprint 4 extends the MVP with additional features, relational endpoints, and polish.

* **Expanded Resource Features**
  * CRUD (or soft delete) for decks and cards with validation.
  * Search/filter decks by course code or keyword.

* **Relational Endpoints**
  * `GET /api/users/:userId/decks` — list decks created by a specific user.
  * `GET /api/decks/:deckId/cards` — list cards for a deck, with gate enforcement.
  * `GET /api/me/cards` — list cards contributed by the current user.

* **Study Flow Enhancements**
  * Endpoint to fetch the “next card” for a deck using some strategy (random, least recently seen, etc.).
  * Record full review stats:
    * `userId`, `deckId`, `cardId`, `correct`, `timestamp`.
    * Optional: which option was selected.

* **Client Polish**
  * Thin UI with clear states:
    * Not logged in.
    * Logged in but below contribution threshold (prompt to add cards).
    * Logged in with full access (browse & study mode with multiple-choice questions).
  * Input validation and visible error messages.

* **Integration / Documentation**
  * Updated `docs/api_endpoints.md` with any new endpoints.
  * Final `README.md`:
    * Description of StudySwap.
    * Instructions to set up and run the server.
    * Example curl / fetch usage.
    * Demo GIF of the thin UI including multiple-choice answer/feedback flow.

