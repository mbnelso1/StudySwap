
const state = {
  user: null,
  decks: [],
  currentDeck: null,
  cards: [],
  currentQuestion: null,
};

function $(id) {
  return document.getElementById(id);
}

function showError(message) {
  const bar = $("error-bar");
  if (!message) {
    bar.style.display = "none";
    bar.textContent = "";
    return;
  }
  bar.textContent = message;
  bar.style.display = "block";
}

async function apiFetch(path, options = {}) {
  const opts = {
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    ...options,
  };

  // If body is an object, JSON-stringify it
  if (opts.body && typeof opts.body !== "string") {
    opts.body = JSON.stringify(opts.body);
  }

  const res = await fetch(path, opts);

  let data = null;
  const contentType = res.headers.get("Content-Type") || "";
  if (contentType.includes("application/json")) {
    data = await res.json().catch(() => null);
  } else {
    data = await res.text().catch(() => null);
  }

  if (!res.ok) {
    const message =
      data && typeof data === "object" && data.error
        ? data.error
        : res.statusText;
    const err = new Error(message || "Request failed");
    err.status = res.status;
    throw err;
  }

  return data;
}

/* ---------- Render helpers ---------- */

function renderUser() {
  const loginSection = $("login-section");
  const appSection = $("app-section");

  if (!state.user) {
    loginSection.style.display = "block";
    appSection.style.display = "none";
    return;
  }

  loginSection.style.display = "none";
  appSection.style.display = "block";

  $("welcome-heading").textContent = `Hello, ${state.user.name}`;
  const count = state.user.contributedCount ?? 0;

  const can = state.user.canStudy
    ? "You can study decks created by others."
    : "You must contribute at least 10 cards before studying decks from others.";

  $("user-status").textContent = `You have contributed ${count} card(s). ${can}`;
}

function renderDecks() {
  const listEl = $("deck-list");
  listEl.innerHTML = "";

  state.decks.forEach((deck) => {
    const li = document.createElement("li");
    li.dataset.deckId = deck.id;

    const titleSpan = document.createElement("span");
    titleSpan.textContent = deck.title;

    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = deck.courseCode || "No course";

    li.appendChild(titleSpan);
    li.appendChild(badge);

    if (state.currentDeck && state.currentDeck.id === deck.id) {
      li.classList.add("active");
    }

    li.addEventListener("click", () => {
      selectDeck(deck.id);
    });

    listEl.appendChild(li);
  });
}

function renderCurrentDeck() {
  const heading = $("current-deck-heading");
  const subheading = $("current-deck-subheading");
  const deckContent = $("deck-content");

  if (!state.currentDeck) {
    heading.textContent = "No deck selected";
    subheading.textContent = "Select a deck from the list above.";
    deckContent.style.display = "none";
    return;
  }

  const deck = state.currentDeck;

  heading.textContent = deck.title;
  subheading.textContent = deck.description || "";

  deckContent.style.display = "block";

  // Render cards
  const tbody = $("card-table-body");
  tbody.innerHTML = "";

  state.cards.forEach((card) => {
    const tr = document.createElement("tr");

    const qTd = document.createElement("td");
    qTd.textContent = card.front;

    const aTd = document.createElement("td");
    aTd.textContent = card.back;

    tr.appendChild(qTd);
    tr.appendChild(aTd);
    tbody.appendChild(tr);
  });
}

function renderStudyQuestion() {
  const area = $("study-area");
  const qEl = $("study-question");
  const optionsEl = $("study-options");
  const resultEl = $("study-result");

  resultEl.textContent = "";
  resultEl.className = "";

  if (!state.currentQuestion) {
    area.style.display = "none";
    qEl.textContent = "";
    optionsEl.innerHTML = "";
    return;
  }

  area.style.display = "block";
  qEl.textContent = state.currentQuestion.front;
  optionsEl.innerHTML = "";

  state.currentQuestion.options.forEach((option) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "option-button";
    btn.textContent = option;

    btn.addEventListener("click", async () => {
      await submitAnswer(option);
    });

    optionsEl.appendChild(btn);
  });
}

/* ---------- API actions ---------- */

async function loadCurrentUser() {
  try {
    const data = await apiFetch("/api/session/me");
    state.user = data.user;
    showError("");
    renderUser();
    await loadDecks();
  } catch (err) {
    if (err.status === 401) {
      state.user = null;
      renderUser();
      showError("");
      return;
    }
    console.error(err);
    showError(err.message);
  }
}

async function login(name) {
  const trimmed = (name || "").trim();
  if (!trimmed) {
    showError("Name is required");
    return;
  }

  try {
    const data = await apiFetch("/api/session/login", {
      method: "POST",
      body: { name: trimmed },
    });
    state.user = data.user;
    showError("");
    renderUser();
    await loadDecks();
  } catch (err) {
    console.error(err);
    showError(err.message);
  }
}

async function logout() {
  try {
    await apiFetch("/api/session/logout", { method: "POST" });
  } catch (err) {
    console.error(err);
  }
  state.user = null;
  state.decks = [];
  state.currentDeck = null;
  state.cards = [];
  state.currentQuestion = null;
  renderUser();
  renderDecks();
  renderCurrentDeck();
  renderStudyQuestion();
  showError("");
}

async function loadDecks() {
  if (!state.user) return;
  try {
    const decks = await apiFetch("/api/decks");
    state.decks = decks;
    renderDecks();
  } catch (err) {
    console.error(err);
    showError(err.message);
  }
}

async function createDeck(input) {
  try {
    const deck = await apiFetch("/api/decks", {
      method: "POST",
      body: input,
    });
    state.decks.push(deck);
    renderDecks();
  } catch (err) {
    console.error(err);
    showError(err.message);
  }
}

async function selectDeck(deckId) {
  const deck = state.decks.find((d) => d.id === deckId);
  if (!deck) return;

  state.currentDeck = deck;
  state.cards = [];
  state.currentQuestion = null;
  renderDecks();
  renderCurrentDeck();
  renderStudyQuestion();

  try {
    const cards = await apiFetch(`/api/decks/${deckId}/cards`);
    state.cards = cards;
    renderCurrentDeck();
  } catch (err) {
    console.error(err);
    showError(err.message);
  }
}

async function createCard(input) {
  if (!state.currentDeck) {
    showError("Select a deck first");
    return;
  }
  try {
    const card = await apiFetch(
      `/api/decks/${state.currentDeck.id}/cards`,
      {
        method: "POST",
        body: input,
      }
    );
    state.cards.push(card);
    renderCurrentDeck();

    // Refresh the user so contributedCount / canStudy update
    await refreshUser();
  } catch (err) {
    console.error(err);
    showError(err.message);
  }
}

async function refreshUser() {
  try {
    const data = await apiFetch("/api/session/me");
    state.user = data.user;
    renderUser();
  } catch (err) {
    console.error(err);
  }
}

async function getNextQuestion() {
  if (!state.currentDeck) {
    showError("Select a deck first");
    return;
  }
  try {
    const q = await apiFetch(
      `/api/decks/${state.currentDeck.id}/study/next`
    );
    state.currentQuestion = q;
    showError("");
    renderStudyQuestion();
  } catch (err) {
    console.error(err);
    showError(err.message);
  }
}

async function submitAnswer(answer) {
  if (!state.currentDeck || !state.currentQuestion) {
    showError("No question to answer");
    return;
  }

  try {
    const result = await apiFetch(
      `/api/decks/${state.currentDeck.id}/study/${state.currentQuestion.cardId}/answer`,
      {
        method: "POST",
        body: { answer },
      }
    );

    const resultEl = $("study-result");
    resultEl.textContent = result.correct
      ? "Correct!"
      : `Incorrect. Correct answer: ${result.correctAnswer}`;
    resultEl.className = result.correct
      ? "correct"
      : "incorrect";
  } catch (err) {
    console.error(err);
    showError(err.message);
  }
}

/* ---------- Event wiring ---------- */

function initEventHandlers() {
  const loginForm = $("login-form");
  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    login($("login-name").value);
  });

  $("logout-button").addEventListener("click", () => {
    logout();
  });

  const deckForm = $("deck-form");
  deckForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const title = $("deck-title").value;
    const courseCode = $("deck-course").value;
    const description = $("deck-description").value;

    createDeck({ title, courseCode, description });

    deckForm.reset();
  });

  const cardForm = $("card-form");
  cardForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const front = $("card-front").value;
    const back = $("card-back").value;

    createCard({ front, back });

    cardForm.reset();
  });

  $("study-next-button").addEventListener("click", () => {
    getNextQuestion();
  });
}

async function init() {
  initEventHandlers();
  await loadCurrentUser();
}

document.addEventListener("DOMContentLoaded", init);
