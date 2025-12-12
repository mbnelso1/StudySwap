# StudySwap

StudySwap is a collaborative flashcard app where students must contribute at least 10 cards to unlock a shared pool of multiple-choice study questions from their peers. In the full version, StudySwap can also run as a live, Kahoot-style quiz: a shared “kiosk” screen shows the questions while students join from their phones to submit cards and answer in real time.

**Track:** Thin UI (Private API)

---

## Screenshots / Demo GIF

> (Coming in Sprint 4)  

---

## How to Run

### Requirements

- Node.js v18+  
- npm  

### Setup and start

From the project root:

    npm install
    npm start

To open the client in your browser:

- http://youripaddress:3000/

To open the kiosk in your browser:

- http://youripaddress:3000/kiosk

To open the controller:

- Scan qr code on your phone or copy the URL into your browser

---

## How It Works 

### Architecture in Brief

StudySwap uses a thick Node/Express server and a thin browser client.

The **server** is responsible for:

- login and session management,
- tracking how many cards each user has contributed,
- enforcing the “10 cards before you can study” gate,
- managing decks and cards,
- generating multiple-choice questions,
- checking answers and (later) tracking stats.

The **client** (browser UI) only:

- renders data from the API,
- collects user input,
- sends requests back to the API.

In Sprint 4, the same API also powers an optional live quiz mode:

- A **kiosk app** (desktop browser / big display) shows the current question and answer options.
- One or more **phone controllers** join the session, submit new flashcards, and tap their answers.
- A small controller layer (inspired by the WebTouch SDK) coordinates which client is host vs player while the StudySwap API remains the single source of truth.

### Technology Stack

- Node.js  
- Express  
- `express-session` for server-managed sessions  
- Custom JSON file database:
  - `src/db/db.js`
  - `src/db/fileAdapter.js`
  - `data/studyswap.json`
- Vanilla HTML/CSS/JS for the thin UI  

---

## Developer Docs

More details live in the `docs/` folder:

- `docs/pitch.md`  
- `docs/roadmap.md`  
- `docs/architecture_sketch.md`  
- `docs/api_endpoints.md`  
- `docs/dod-sprint1.md`  
- `docs/dod-sprint2.md`  
- `docs/dod-sprint3.md`  
- `docs/dod-sprint4.md`  

---

## Project Board

All project planning (Sprints 2–4) is tracked on a single GitHub Project board:

- Board: https://github.com/users/mbnelso1/projects/3/views/1  
- Filter for Sprint 3 issues: `label:sprint-3`  
- Filter for Sprint 4 issues: `label:sprint-4`
