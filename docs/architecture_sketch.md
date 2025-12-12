# Architecture Sketch — StudySwap

## Diagram (ASCII)

    +----------------------+
    |     Thin Client      |
    |  (Browser / UI)      |
    | - Login form         |
    | - Deck list          |
    | - MC study view      |
    | - Live quiz kiosk    |
    | - Phone controllers  |
    +----------+-----------+
               |
               | HTTP (fetch) + WebSockets (WebTouch)
               |
    +----------v-----------+
    |   Express Server     |
    | - API routes (/api)  |
    | - WebTouch hub       |
    | - Session middleware |
    +----------+-----------+
               |
               | Service calls
               |
    +----------v-----------+
    |   Service Layer      |
    | - userService        |
    | - deckService        |
    | - cardService        |
    | - studyService       |
    +----------+-----------+
               |
               | Adapter (file I/O)
               |
    +----------v-----------+
    |      db.js           |
    |  (studyswap.json)    |
    +----------------------+

## Main Pieces

### Thin client (app view)

A single-page web app served from `/` that runs entirely in the browser:

- Renders login form, deck list, and study UI.
- Uses `fetch` to hit JSON endpoints under `/api`.
- Tracks very small bits of state: current user, selected deck, current question.
- Does **not** talk to storage directly; all stateful operations go through the API.

Typical flow:

1. User opens `/`.
2. App calls `GET /api/me` to check for an existing session.
3. If not logged in, show the login form and call `POST /api/session/login`.
4. Call `GET /api/decks` to list decks.
5. For a chosen deck, call:
   - `GET /api/decks/:deckId/cards` to show contributed cards.
   - `GET /api/decks/:deckId/study/next` + `POST /study/:cardId/answer` for multiple-choice study.

### Express API Layer

Route modules in `src/api/` expose a small, well-defined JSON API:

- `sessionRoutes.js` → `/api/session/login`, `/api/session/logout`, `/api/me`
- `deckRoutes.js`    → `/api/decks`, `/api/decks/:deckId`
- `cardRoutes.js`    → `/api/decks/:deckId/cards`
- `studyRoutes.js`   → `/api/decks/:deckId/study/next`, `/api/decks/:deckId/study/:cardId/answer`

Each route:

1. Uses `requireUser` to load the current user from the session when needed.
2. Delegates to the appropriate service (e.g., `deckService.createDeckForUser`).
3. Returns a “public” version of the entity (no internal fields) via helper mappers such as `toPublicUser`, `toPublicDeck`, `toPublicCard`.

### Service Layer

Service modules in `src/services/` hold all business logic:

- **userService**
  - `findOrCreateUserByName`, `getUserFromSession`, `toPublicUser`.
  - Maintains `contributedCount` and computes `canStudy` for decks.

- **deckService**
  - `createDeckForUser`, `listDecksForUser`, `getDeckForUser`, `toPublicDeck`.
  - Enforces permissions for who can see which decks.

- **cardService**
  - `createCardForDeck`, `listCardsForDeck`, `toPublicCard`.
  - Increments the user’s contribution count when they add cards.

- **studyService**
  - `getNextQuestionForDeck(user, deckId)` — picks the next card and generates multiple-choice `options`.
  - `checkAnswerForDeck(user, deckId, cardId, answer)` — determines correctness and can update any future stats.

Services talk to `db.js` instead of the file system directly, which keeps business logic independent of persistence details.

### Persistence (`db.js` + `fileAdapter.js`)

- `db.js` is a tiny, in-memory document store that wraps the JSON file.
- `fileAdapter.js` loads and saves `data/studyswap.json`.
- The rest of the app acts as if it were talking to a database with simple collections: `users`, `decks`, `cards`.

This design means we can swap the adapter (e.g., to a real database) later without touching the UI or services.

## WebTouch / Live Quiz Integration (Kiosk + Controllers)

The live quiz is built as an extra layer on top of the existing API.

- **Server / hub**
  - `webTouchHub.js` attaches a WebTouch hub to the existing Socket.IO server.
  - Manages “rooms” that pair one kiosk with many controllers.
  - Forwards custom events between kiosk and controllers (`quiz:join`, `quiz:set_deck`, `quiz:answer`, etc.).

- **Kiosk view (`/kiosk`)**
  - HTML shell: `public/kiosk.html` with:
    - `#qrCodeContainer` — QR + join URL.
    - `#app-root` — question + options + controls.
    - `#scoreboard` — live scores.
  - JS bootstrap: `public/js/studyswap/kioskMain.js`:
    - Extends `WebTouchApp`.
    - On init:
      - Calls `GET /api/decks` to load decks.
      - Waits for a deck to be selected via a controller.
    - For the active deck, uses:
      - `GET /api/decks/:deckId/study/next` for the current question.
      - `POST /api/decks/:deckId/study/:cardId/answer` to check each answer.
    - Tracks players in memory and updates the scoreboard.

- **Controller view (`/controller`)**
  - HTML shell: `public/controller/index.html`.
  - JS bootstrap: `public/js/studyswap/controllerMain.js`:
    - Extends `WebTouchController`.
    - Builds a simple UI:
      - Join game (enter name).
      - Deck selection dropdown (host only).
      - Four answer buttons (Option 1–4).
    - Sends custom events to the kiosk:
      - `quiz:join` — when a player joins.
      - `quiz:set_deck` — when the host chooses a deck for the room.
      - `quiz:answer` — when a player taps an answer.
    - Receives `quiz:deck_list`, `quiz:feedback`, and connection status from the kiosk.

Because all quiz logic calls the same REST endpoints as the app view, the WebTouch layer does not change the data model. It simply orchestrates **who** is answering **which** question and displays the results on the kiosk.
