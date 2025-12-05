# StudySwap

StudySwap is a collaborative flashcard app where students must contribute at least 10 cards to unlock a shared pool of multiple-choice study questions from their peers.

---

## Screenshots / Demo GIF



---

## How to Run

**Requirements**

- Node.js v18+  
- npm  

**Setup and start**

    npm install
    npm start

Then open the client in your browser:

- http://localhost:3000/

---

## How It Works (High-Level)

**Architecture in Brief**  
StudySwap uses a thick Node/Express server and a thin browser client. The server handles all business rules (login, contribution gate, deck visibility, multiple-choice generation, answer checking); the client only renders data and sends requests.

**Technology Stack**

- Node.js  
- Express  
- express-session  
- Custom JSON file database (src/db/db.js + src/db/fileAdapter.js)  
- Vanilla HTML/CSS/JS for the thin UI  

---

## API Usage Examples (High-Level)

Below are a few tiny curl examples. See docs/api_endpoints.md for full details.

**Log in**

    curl -X POST http://localhost:3000/api/session/login \
      -H "Content-Type: application/json" \
      -d '{"name":"Melita"}'

**Create a deck**

    curl -X POST http://localhost:3000/api/decks \
      -H "Content-Type: application/json" \
      -d '{
        "title":"CSCI 4208 — HTTP & REST",
        "courseCode":"CSCI 4208",
        "description":"Requests, responses, and REST principles"
      }'

**Get a multiple-choice question for a deck**

    curl http://localhost:3000/api/decks/d_101/study/next

---

## Developer Docs (Links)

- docs/pitch.md  
- docs/roadmap.md  
- docs/architecture_sketch.md  
- docs/api_endpoints.md  
- docs/dod-sprint1.md  
- docs/dod-sprint2.md  
- docs/dod-sprint3.md  
- docs/dod-sprint4.md  

Project planning and tasks are tracked on the GitHub Project board linked from the repository homepage.
