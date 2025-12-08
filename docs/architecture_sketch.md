# Architecture Sketch — StudySwap

## Diagram (ASCII)

    +----------------------+
    |     Thin Client      |
    |  (Browser / UI)      |
    | - Login form         |
    | - Deck list          |
    | - MC question view   |
    | - Feedback display   |
    | - (Sprint 4) Kiosk & |
    |   phone controllers  |
    +----------+-----------+
               |
               | HTTP (fetch)
               v
    +----------------------+
    |  Express API Layer   |
    |  - Routers           |
    |  - Session middleware|
    |  - Error handler     |
    +----------+-----------+
               |
               | Function calls
               v
    +----------------------+
    |   Services Layer     |
    |  - userService       |
    |  - deckService       |
    |  - cardService       |
    |  - studyService      |
    |  - access rules      |
    |  - MC generation     |
    |  - answer checking   |
    +----------+-----------+
               |
               | DB module API
               v
    +----------------------+
    |    DB Layer (JSON)   |
    |  - src/db/db.js      |
    |  - src/db/fileAdapter|
    |  - data/studyswap.json
    |    (collections:     |
    |     users, decks,    |
    |     cards, reviews*) |
    +----------------------+
       * reviews planned for Sprint 4

In Sprint 4, a WebTouch-style controller layer is added on top of the Express API:

- A **kiosk app** (public display) uses the same REST endpoints as the thin client.
- One or more **phone controllers** send simple events (join session, submit answer, add card) that are translated into service calls.
- All scoring, access rules, and data persistence still live in the server/services/DB layers.

---

## Module Map

- `server.js`  
  Sets up the Express app and core middleware:
  - `express.json()` for JSON request bodies.
  - `express-session` for session cookies.
  - Static file serving from `/public` for the thin UI.
  - Health check route (`/health`) that reports status, track, and `sessionId`.
  - Mount points for API routers under `/api/...`.
  - 404 handler and global error-handler middleware.
  - Database boot (`useAdapter(new FileAdapter(...)); await boot();`) before listening.

- `src/db/db.js`  
  Provides a simple collection-based JSON database with in-memory caching and CRUD helpers used by the services. It exposes functions like:
  - `useAdapter(adapter)` – plug in a persistence adapter (e.g., `FileAdapter`).
  - `boot()` – loads the JSON document from disk into memory.
  - `insertOne(collectionName, record)`
  - `findMany(collectionName, predicate)`
  - `findOne(collectionName, predicate)`
  - `updateOne(collectionName, id, updates)`
  - `deleteOne(collectionName, id)`
  - `getAll(collectionName)`

  Internally, each “collection” (e.g., `users`, `decks`, `cards`) is a key in the in-memory document stored in `data/studyswap.json`.

- `src/db/fileAdapter.js`  
  Implements a simple file-based adapter responsible for:
  - Reading `data/studyswap.json` at startup.
  - Writing the entire document back to disk using atomic `.tmp → rename` writes to avoid corruption.
  This adapter is used by `db.js` via `useAdapter(...)`.

- `src/services/userService.js`  
  Encapsulates all logic related to users:
  - Create or look up a user record.
  - Track `contributedCount`.
  - Determine whether a user has reached the 10-card contribution gate.
  - Helpers for “current user” based on the session.

- `src/services/deckService.js`  
  Encapsulates deck-related rules:
  - Create new decks for a course or topic.
  - List decks a user can see, enforcing the 10-card gate where appropriate.
  - Fetch a single deck by ID.
  - Optionally filter decks by course code or search term (Sprint 4).

- `src/services/cardService.js`  
  Encapsulates card-related rules:
  - Create a card within a given deck.
  - List cards for a deck (subject to the contribution gate and access rules).
  - Increment the author’s `contributedCount` when a card is created.
  - (Later) soft-delete or update cards, if needed.

- `src/services/studyService.js`  
  Encapsulates the multiple-choice study flow:
  - Select a card from a deck for the next question.
  - Build a multiple-choice payload with:
    - One correct answer (the card’s `back`).
    - Several distractors chosen from other cards’ `back` values in the same deck.
    - Shuffled options so the correct answer is not always in the same position.
  - Check an answer submission and return:
    - `correct: true/false`
    - `correctAnswer`
    - `selectedAnswer`
  - (Sprint 4) Record review stats (userId, deckId, cardId, correct, timestamp) into a `reviews` collection.

- `src/api/sessionRoutes.js`  
  Defines session-related HTTP endpoints, typically under `/api/session`:
  - `POST /api/session/login` – create or look up a user and store their ID in the session.
  - `POST /api/session/logout` – clear the session.
  - `GET /api/me` – return the current user’s profile and contribution count.
  These routes delegate to `userService` and rely on the Express session middleware.

- `src/api/deckRoutes.js`  
  Defines deck-related HTTP endpoints, typically under `/api/decks`:
  - `GET /api/decks` – list decks visible to the current user.
  - `POST /api/decks` – create a new deck.
  - `GET /api/decks/:deckId` – get details for a single deck.
  Delegates to `deckService` and uses auth middleware to require a logged-in user.

- `src/api/cardRoutes.js`  
  Defines card-related endpoints nested under decks:
  - `GET /api/decks/:deckId/cards` – list cards in a deck (respecting the contribution gate).
  - `POST /api/decks/:deckId/cards` – add a new card to a deck.
  Delegates to `cardService` and uses auth + gate checks where needed.

- `src/api/studyRoutes.js`  
  Defines study endpoints for the multiple-choice flow:
  - `GET /api/decks/:deckId/study/next` – fetch the next MC question for a deck.
  - `POST /api/decks/:deckId/study/:cardId/answer` – submit an answer and get correctness + feedback.
  Delegates to `studyService`.

- `src/middleware/auth.js`  
  Provides reusable middleware such as:
  - `requireUser` – ensures the request has a logged-in user in the session.
  - `requireContributions` – ensures the current user has at least 10 contributed cards before accessing a protected route.

- `src/middleware/errorHandler.js`  
  Centralized error-handling middleware that:
  - Logs errors on the server.
  - Normalizes error responses to JSON (e.g., `{ error: "message" }`).
  - Sets appropriate HTTP status codes (400, 401, 403, 404, 500, etc.).

---

## WebTouch / Live Quiz Integration (Sprint 4)

In Sprint 4, a WebTouch-style multi-device layer can be added without changing the core architecture:

- The **kiosk view** is just another thin client (public screen) that:
  - Calls the same `/api/decks`, `/api/decks/:deckId/study/next`, and answer endpoints.
  - Displays questions, answers, and a scoreboard.

- The **phone controllers**:
  - Load a controller page that connects via WebTouch / Socket.IO.
  - Send simple events (join game, submit answer, add card).
  - These events are translated into regular service calls (e.g., `studyService.submitAnswer`, `cardService.createCard`) on the server.

Because all logic lives in `services` + `db`, the WebTouch layer is purely an input/transport layer on top of the existing StudySwap API and does not change the core data model or business rules.
