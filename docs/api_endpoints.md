# API Endpoint Reference — StudySwap (MVP)

All responses are JSON. Authentication is session-based using cookies.

---

### POST /api/session/login

**Description:**  
Logs in or creates a StudySwap user by name/handle and starts a session.

**Example Request:**

    curl -X POST http://localhost:3000/api/session/login \
      -H "Content-Type: application/json" \
      -d '{"name":"Melita"}'

**Example Response (200 OK):**

    {
      "user": {
        "id": "u_123abc",
        "name": "Melita",
        "contributedCount": 4,
        "canStudy": false
      }
    }

---

### GET /api/decks

**Description:**  
Retrieves the list of decks visible to the current user. Users with fewer than 10 contributed cards see only their own decks; users with 10 or more contributions see all decks.

**Example Request:**

    curl http://localhost:3000/api/decks

**Example Response (200 OK):**

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

### POST /api/decks

**Description:**  
Creates a new deck owned by the current user.

**Example Request:**

    curl -X POST http://localhost:3000/api/decks \
      -H "Content-Type: application/json" \
      -d '{
        "title":"CSCI 4208 — HTTP & REST",
        "courseCode":"CSCI 4208",
        "description":"Requests, responses, and REST principles"
      }'

**Example Response (201 Created):**

    {
      "id": "d_101",
      "title": "CSCI 4208 — HTTP & REST",
      "courseCode": "CSCI 4208",
      "description": "Requests, responses, and REST principles",
      "ownerUserId": "u_123abc"
    }

---

### POST /api/decks/:deckId/cards

**Description:**  
Adds a new card to the specified deck and increments the current user’s contributed card count.

**Example Request:**

    curl -X POST http://localhost:3000/api/decks/d_101/cards \
      -H "Content-Type: application/json" \
      -d '{
        "front":"What is REST?",
        "back":"An architectural style using stateless HTTP and resource representations."
      }'

**Example Response (201 Created):**

    {
      "id": "c_555",
      "deckId": "d_101",
      "authorUserId": "u_123abc",
      "front": "What is REST?",
      "back": "An architectural style using stateless HTTP and resource representations."
    }

---

### GET /api/decks/:deckId/study/next

**Description:**  
Returns the next multiple-choice question for the specified deck, including the prompt and a shuffled list of answer options. Users with fewer than 10 contributed cards may only study decks they own.

**Example Request:**

    curl http://localhost:3000/api/decks/d_101/study/next

**Example Response (200 OK):**

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

---

### POST /api/decks/:deckId/study/:cardId/answer

**Description:**  
Submits the selected answer option for a specific card and returns whether it is correct along with the correct answer.

**Example Request:**

    curl -X POST http://localhost:3000/api/decks/d_101/study/c_555/answer \
      -H "Content-Type: application/json" \
      -d '{
        "selectedAnswer":"A binary protocol for low-level device control."
      }'

**Example Response (200 OK):**

    {
      "cardId": "c_555",
      "deckId": "d_101",
      "correct": false,
      "correctAnswer": "An architectural style using stateless HTTP and resource representations.",
      "selectedAnswer": "A binary protocol for low-level device control."
    }
