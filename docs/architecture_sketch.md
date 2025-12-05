# Architecture Sketch — StudySwap

## Diagram (ASCII)

    +----------------------+
    |     Thin Client      |
    |  (Browser / UI)      |
    | - Login form         |
    | - Deck list          |
    | - MC question view   |
    | - Feedback display   |
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
    |  data/users.json     |
    |  data/decks.json     |
    |  data/cards.json     |
    |  (later) reviews.json|
    +----------------------+

## Module Map 

- `server.js`  
  Sets up the Express app, JSON/body parsing, sessions, DB boot, route registration, and the global error handler.

- `src/db/db.js`  
  Provides a simple collection-based JSON database with in-memory caching and CRUD helpers (insert, find, update, delete) used by services.

- `src/db/fileAdapter.js`  
  Reads and writes collections to `data/*.json` using atomic `.tmp → rename` writes so data is safely persisted.

- `src/services/userService.js`  
  Handles user creation/lookup, tracks `contributedCount`, and determines whether a user can study (has ≥ 10 contributions).

- `src/services/deckService.js`  
  Manages decks (create, get, list) and enforces which decks a user is allowed to see based on contribution rules and ownership.

- `src/services/cardService.js`  
  Manages cards within decks (create, list) and increments the author’s `contributedCount` when new cards are added.

- `src/services/studyService.js`  
  Generates multiple-choice questions for a deck (correct answer + distractors from other cards) and checks whether a selected option is correct.

- `src/api/sessionRoutes.js`  
  Exposes login, logout, and `/api/me` endpoints, wiring HTTP requests to user/session-related service functions.

- `src/api/deckRoutes.js`  
  Exposes deck endpoints (list, create, get by id) and delegates all logic to `deckService`.

- `src/api/cardRoutes.js`  
  Exposes card endpoints for creating and listing raw cards in a deck, delegating to `cardService`.

- `src/api/studyRoutes.js`  
  Exposes study endpoints for fetching the next MC question and submitting an answer, delegating to `studyService`.

- `src/middleware/auth.js`  
  Provides middleware to ensure a user is logged in and (where needed) has enough contributions before accessing certain routes.

- `src/middleware/errorHandler.js`  
  Centralized error-handling middleware that converts thrown errors into consistent JSON HTTP responses.
