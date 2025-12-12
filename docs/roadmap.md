# Roadmap — StudySwap

StudySwap is built in four sprints. Each sprint adds a thin, testable slice on top of the previous one.

---

## Sprint 1 — Local Decks & Cards

**Goal:** basic StudySwap data model and a simple thin client.

**Features**

- In-memory / file-backed “database” in `studyswap.json`.
- Collections for:
  - `users`
  - `decks`
  - `cards`
- Thin client that can:
  - Create a deck for a course.
  - Add cards to a deck (front/back).
  - List cards for a chosen deck.

**What this delivers**

- A single-user prototype where someone can make a deck and add flashcards.
- No login yet; everything is effectively “ownerless”.

---

## Sprint 2 — Sessions & Multi-User Data

**Goal:** support multiple users and keep their data straight.

**Features**

- Session middleware and cookies.
- Simple login endpoint:
  - `POST /api/session/login` using a display name.
  - `GET /api/me` to check who is logged in.
- User model extended with:
  - `id`
  - `name`
  - `contributedCount`
- Deck + card APIs updated to respect the current user:
  - Only logged-in users can create decks/cards.
  - `contributedCount` increments when a user adds cards.

**What this delivers**

- Multiple users can log in from different browsers and contribute cards.
- The app knows who added what, which is needed for the contribution gate later.

---

## Sprint 3 — MVP Vertical Slice (Study + Gate + Live Quiz)

**Goal:** a full, end-to-end experience for one course, with the contribution requirement and a live quiz.

### User Identification & Sessions

- Simple login form in the app UI.
- Session-based identity used for all `/api` calls that need a user.
- `GET /api/me` used on page load to restore the current user.

### Core Resources (MVP Scope)

- **Users**
  - Track `id`, `name`, `contributedCount`.
  - Derive whether the user can study a deck based on contributions.
- **Decks**
  - Create and list course decks (e.g., “CSCI 4208 — HTTP & REST”).
  - `GET /api/decks` returns decks plus `cardCount` and `canStudy`.
- **Cards**
  - `GET /api/decks/:deckId/cards` to view contributed cards.
  - `POST /api/decks/:deckId/cards` to add new cards.

### Contribution Gate

- Each deck requires a minimum number of cards contributed per user (configurable).
- App logic:
  - If `contributedCount < threshold`, the deck is “locked for study”.
  - Once threshold is met, `canStudy` becomes true and study mode unlocks.

### Study Mode (Multiple-Choice API)

- Shared study API used by both solo study and kiosk mode:
  - `GET /api/decks/:deckId/study/next`
    - Returns `{ deckId, cardId, front, options[] }`.
  - `POST /api/decks/:deckId/study/:cardId/answer`
    - Body: `{ "answer": "..." }`
    - Response: `{ correct, correctAnswer, selectedAnswer }`.
- The thin client calls these endpoints to:
  - Show one question at a time.
  - Render four answer choices.
  - Give immediate feedback.

### Live Quiz / Kiosk Mode (Phones as Controllers)

- **Kiosk view** (`/kiosk`):
  - Runs on a laptop/TV.
  - Shows:
    - Room code + QR link for controllers.
    - Current deck.
    - Current question and answer options (using the study API above).
    - Scoreboard of players.

- **Controller view** (`/controller`):
  - Runs in mobile browsers.
  - UI:
    - Join game with a name.
    - Deck selection dropdown for the host.
    - Four “Option 1–4” answer buttons.
  - Sends custom events to the kiosk over WebTouch:
    - `quiz:join`
    - `quiz:set_deck`
    - `quiz:answer`
    - `quiz:next_question`.
  - Receives:
    - `quiz:deck_list` (for host dropdown).
    - `quiz:feedback` (correct / incorrect).

- **WebTouch hub layer**:
  - Attaches to the existing Socket.IO server.
  - Manages rooms and forwards custom events.
  - Kiosk uses the StudySwap REST API as the single source of truth; WebTouch only coordinates controllers.

### Client Polish

- Clear UI states:
  - Not logged in → show login.
  - Logged in but below contribution threshold → prompt to add cards.
  - Logged in and allowed to study → show study/kiosk options.
- Visible error messages when API calls fail (401, 404, etc.).

---

## Sprint 4 — Full Product & Polish

**Goal:** refine the experience, add quality-of-life features, and document the final system.

**Possible enhancements**

- **Deck & user details**
  - Per-deck contribution counts on the UI.
  - Simple progress indicators (“You’ve answered X/Y questions”).
- **Quiz features**
  - Lock answers after a timer.
  - Show correct answer and per-question stats on the kiosk.
  - Better handling of reconnects and multiple hosts.
- **UI improvements**
  - Additional responsive tweaks for phones and projectors.
  - Visual feedback on the controller when the question changes.
- **Documentation**
  - Final pass on:
    - `pitch.md`
    - `roadmap.md`
    - `architecture_sketch.md`
    - `api_endpoints.md`
  - Screenshots or GIFs demonstrating:
    - App login + contribution.
    - Solo study view.
    - Kiosk on a big screen plus controller on a phone.

**What this delivers**

- A clean, demo-ready StudySwap experience:
  - Students contribute cards.
  - They unlock decks and study with multiple-choice questions.
  - Instructors can run a live quiz from the same data using the kiosk + controller setup.
