# API Endpoint Reference — StudySwap (MVP)

All responses are JSON. Authentication is session-based using cookies.  
Errors use a common shape like:

    { "error": "ErrorType", "message": "Helpful message here" }

---

### `POST /api/session/login`

* **Description:** Logs in or creates a StudySwap user by name/handle and starts a session.
* **Example Request:**  
  `curl -X POST http://localhost:3000/api/session/login -H "Content-Type: application/json" -d '{"name":"Melita"}'`
* **Example Request Body:**

    {
      "name": "Melita"
    }

* **Example Response (200 OK):**

    {
      "user": {
        "id": "u_123abc",
        "name": "Melita",
        "contributedCount": 4,
        "canStudy": false
      }
    }

---

### `POST /api/session/logout`

* **Description:** Logs out the current user and destroys their session.
* **Example Request:**  
  `curl -X POST http://localhost:3000/api/session/logout`
* **Example Response (204 No Content):**  
  _(no body)_

---

### `GET /api/me`

* **Description:** Returns the current session user and their contribution status.
* **Example Request:**  
  `curl http://localhost:3000/api/me`
* **Example Response (200 OK):**

    {
      "user": {
        "id": "u_123abc",
        "name": "Melita",
        "contributedCount": 12,
        "canStudy": true
      }
    }

---

### `GET /api/decks`

* **Description:** Retrieves decks visible to the current user.  
  If `contributedCount < 10`, returns only decks the user owns. If `contributedCount >= 10`, returns all decks.
* **Example Request:**  
  `curl http://localhost:3000/api/decks`
* **Example Response (200 OK):**

    [
      {
        "id": "d_101",
        "title": "CSCI 4208 — HTTP & REST",
        "courseCode": "CSCI 4208",
        "description": "Requests, responses, and REST principles",
      "ownerUserId": "u_123abc"
      }
    ]

---

### `POST /api/decks`

* **Description:** Creates a new deck owned by the current user.
* **Example Request:**  
  `curl -X POST http://localhost:3000/api/decks -H "Content-Type: application/json" -d '{"title":"CSCI 4208 — HTTP & REST","courseCode":"CSCI 4208","description":"Requests, responses, and REST principles"}'`
* **Example Request Body:**

    {
      "title": "CSCI 4208 — HTTP & REST",
      "courseCode": "CSCI 4208",
      "description": "Requests, responses, and REST principles"
    }

* **Example Response (201 Created):**

    {
      "id": "d_101",
      "title": "CSCI 4208 — HTTP & REST",
      "courseCode": "CSCI 4208",
      "description": "Requests, responses, and REST principles",
      "ownerUserId": "u_123abc"
    }

---

### `GET /api/decks/:deckId`

* **Description:** Retrieves a single deck by id, if the current user is allowed to see it under the gate rules.
* **Example Request:**  
  `curl http://localhost:3000/api/decks/d_101`
* **Example Response (200 OK):**

    {
      "id": "d_101",
      "title": "CSCI 4208 — HTTP & REST",
      "courseCode": "CSCI 4208",
      "description": "Requests, responses, and REST principles",
      "ownerUserId": "u_123abc"
    }

* **Example Response (403 Forbidden):**

    {
      "error": "Forbidden",
      "message": "You are not allowed to view this deck."
    }

---

### `POST /api/decks/:deckId/cards`

* **Description:** Adds a new card to a deck and increments the current user’s `contributedCount`.
* **Example Request:**  
  `curl -X POST http://localhost:3000/api/decks/d_101/cards -H "Content-Type: application/json" -d '{"front":"What is REST?","back":"An architectural style using stateless HTTP and resource representations."}'`
* **Example Request Body:**

    {
      "front": "What is REST?",
      "back": "An architectural style using stateless HTTP and resource representations."
    }

* **Example Response (201 Created):**

    {
      "id": "c_555",
      "deckId": "d_101",
      "authorUserId": "u_123abc",
      "front": "What is REST?",
      "back": "An architectural style using stateless HTTP and resource representations."
    }

---

### `GET /api/decks/:deckId/cards`

* **Description:** Lists raw cards in a deck (for deck management views, not necessarily for studying).  
  If `contributedCount < 10`, the user may see cards only in decks they own; otherwise 403. If `contributedCount >= 10`, the user may see cards in any deck.
* **Example Request:**  
  `curl http://localhost:3000/api/decks/d_101/cards`
* **Example Response (200 OK):**

    [
      {
        "id": "c_555",
        "deckId": "d_101",
        "authorUserId": "u_123abc",
        "front": "What is REST?",
        "back": "An architectural style using stateless HTTP and resource representations."
      }
    ]

* **Example Response (403 Forbidden):**

    {
      "error": "Forbidden",
      "message": "You must contribute at least 10 cards before viewing cards in decks you do not own."
    }

---

### `GET /api/decks/:deckId/study/next`

* **Description:** Retrieves the next multiple-choice question for a deck.  
  If `contributedCount < 10`, the user can only study decks they own; otherwise 403. If `contributedCount >= 10`, the user can study any deck.
* **Example Request:**  
  `curl http://localhost:3000/api/decks/d_101/study/next`
* **Example Response (200 OK):**

    {
      "cardId": "c_555",
      "deckId": "d_101",
      "prompt": "What is REST?",
      "options": [
        "An architectural style using stateless HTTP and resource representations.",
        "A binary protocol for low-level device control.",
        "A markup language for describing documents.",
        "A file format for compressing images."
      ]
    }

* **Example Response (403 Forbidden):**

    {
      "error": "Forbidden",
      "message": "You must contribute at least 10 cards before studying decks you do not own."
    }

---

### `POST /api/decks/:deckId/study/:cardId/answer`

* **Description:** Submits a selected option for a specific card and returns correctness feedback.
* **Example Request:**  
  `curl -X POST http://localhost:3000/api/decks/d_101/study/c_555/answer -H "Content-Type: application/json" -d '{"selectedAnswer":"A binary protocol for low-level device control."}'`
* **Example Request Body:**

    {
      "selectedAnswer": "A binary protocol for low-level device control."
    }

* **Example Response (200 OK, incorrect):**

    {
      "cardId": "c_555",
      "deckId": "d_101",
      "correct": false,
      "correctAnswer": "An architectural style using stateless HTTP and resource representations.",
      "selectedAnswer": "A binary protocol for low-level device control."
    }

* **Example Response (200 OK, correct):**

    {
      "cardId": "c_555",
      "deckId": "d_101",
      "correct": true,
      "correctAnswer": "An architectural style using stateless HTTP and resource representations.",
      "selectedAnswer": "An architectural style using stateless HTTP and resource representations."
    }

* **Example Response (403 Forbidden):**

    {
      "error": "Forbidden",
      "message": "You must contribute at least 10 cards before studying decks you do not own."
    }
