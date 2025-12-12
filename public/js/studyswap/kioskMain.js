// public/js/studyswap/kioskMain.js
import { WebTouchApp } from "../sdk/WebTouchApp.js";
import { launchWebTouchApp } from "../sdk/launchers.js";

class StudySwapKioskApp extends WebTouchApp {
  constructor(...args) {
    super(...args);

    // Decks + current selection
    this.decks = [];
    this.activeDeckId = null;

    // Current multiple-choice question coming from /study/next
    this.currentQuestion = null; // { deckId, cardId, front, options }

    // Players for scoreboard: controllerId -> { id, name, score }
    this.players = new Map();
  }

  async onInit(ctx) {
    console.log("[StudySwapKiosk] onInit");
    this._ctx = ctx;
    this.client = ctx.client;

    // === Cache DOM elements ===
    this.deckLabelEl = document.getElementById("deckLabel");
    this.errorBarEl = document.getElementById("errorBar");
    this.appRoot = document.getElementById("app-root");
    this.scoreboardEl = document.getElementById("scoreboard");

    // Build the question UI shell inside #app-root
    if (this.appRoot) {
      this.appRoot.innerHTML = `
        <div id="questionText">Waiting for a deck selection...</div>
        <div id="choices"></div>
        <div class="controls-row">
          <button id="nextQuestionButton" disabled>Next question</button>
        </div>
      `;
      this.questionTextEl = document.getElementById("questionText");
      this.choicesEl = document.getElementById("choices");
      this.nextQuestionBtn = document.getElementById("nextQuestionButton");

      if (this.nextQuestionBtn) {
        this.nextQuestionBtn.addEventListener("click", () =>
          this.advanceQuestion()
        );
      }
    }

    if (this.deckLabelEl) {
      this.deckLabelEl.textContent = "Loading deck list…";
    }

    await this.loadDeckList();
    this.renderQuestion(null); // show "waiting" message
  }

  // =========================
  // Deck list (for host UI)
  // =========================
  async loadDeckList() {
    console.log("[StudySwapKiosk] Loading deck list…");
    try {
      const res = await fetch("/api/decks", {
        credentials: "include",
        headers: { Accept: "application/json" },
      });

      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const body = await res.json();
          if (body?.error) msg = body.error;
        } catch (_) {}
        throw new Error(msg);
      }

      const decks = await res.json();
      console.log("[StudySwapKiosk] Decks:", decks);
      this.decks = decks || [];

      if (!this.decks.length) {
        if (this.deckLabelEl) {
          this.deckLabelEl.textContent = "No decks available.";
        }
      } else if (this.activeDeckId) {
        const d = this.decks.find((x) => x.id === this.activeDeckId);
        if (this.deckLabelEl) {
          this.deckLabelEl.textContent = d
            ? `Deck: ${d.title || d.id}`
            : `Deck: ${this.activeDeckId}`;
        }
      } else if (this.deckLabelEl) {
        this.deckLabelEl.textContent = "Waiting for a deck selection…";
      }

      // Tell controllers what decks exist (host dropdown)
      this.broadcastDeckList();
    } catch (err) {
      console.error("[StudySwapKiosk] Error loading deck list:", err);
      if (this.errorBarEl) {
        this.errorBarEl.textContent =
          "Unable to load decks. Make sure you are logged into StudySwap in this browser.";
      }
      if (this.deckLabelEl) {
        this.deckLabelEl.textContent = "Error loading decks";
      }

      this.broadcastDeckList([]);
    }
  }

  broadcastDeckList(decksOverride) {
    const decks = decksOverride ?? this.decks ?? [];
    if (!this.client || typeof this.client.sendEventToControllers !== "function") {
      return;
    }

    this.client.sendEventToControllers({
      eventName: "quiz:deck_list",
      payload: {
        decks: decks.map((d) => ({ id: d.id, title: d.title })),
        activeDeckId: this.activeDeckId || null,
      },
    });
  }

  // =========================
  // Question fetching & render
  // =========================

  async fetchNextQuestionForActiveDeck() {
    if (!this.activeDeckId) {
      console.log("[StudySwapKiosk] No active deck; cannot fetch question.");
      this.renderQuestion(null);
      return;
    }

    try {
      if (this.errorBarEl) this.errorBarEl.textContent = "";
      if (this.questionTextEl) {
        this.questionTextEl.textContent = "Loading question…";
      }
      if (this.nextQuestionBtn) this.nextQuestionBtn.disabled = true;

      const deckId = this.activeDeckId;
      const res = await fetch(
        `/api/decks/${encodeURIComponent(deckId)}/study/next`,
        {
          credentials: "include",
          headers: { Accept: "application/json" },
        }
      );

      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const body = await res.json();
          if (body?.error) msg = body.error;
        } catch (_) {}
        throw new Error(msg);
      }

      const question = await res.json();
      console.log("[StudySwapKiosk] Received question:", question);
      this.currentQuestion = question;
      this.renderQuestion(question);
    } catch (err) {
      console.error("[StudySwapKiosk] Error fetching question:", err);
      if (this.errorBarEl) {
        this.errorBarEl.textContent =
          "Unable to get a question. Make sure the deck has cards and you are logged in.";
      }
      this.renderQuestion(null);
    }
  }

  renderQuestion(question) {
    if (!this.questionTextEl || !this.choicesEl) {
      console.warn("[StudySwapKiosk] Missing question DOM refs");
      return;
    }

    if (!question) {
      this.questionTextEl.textContent = "Waiting for a question...";
      this.choicesEl.innerHTML = "";
      if (this.nextQuestionBtn) {
        this.nextQuestionBtn.disabled = !this.activeDeckId;
      }
      return;
    }

    const { front, options } = question;
    this.questionTextEl.textContent = front || "(No question text)";
    this.choicesEl.innerHTML = "";

    (options || []).forEach((text, idx) => {
      const div = document.createElement("div");
      div.className = "choice";
      div.textContent = `${idx + 1}. ${text}`;
      this.choicesEl.appendChild(div);
    });

    if (this.nextQuestionBtn) {
      this.nextQuestionBtn.disabled = false;
    }
  }

  advanceQuestion() {
    console.log("[StudySwapKiosk] advanceQuestion");
    this.fetchNextQuestionForActiveDeck();
  }

  // =========================
  // Scoreboard
  // =========================

  updateScoreboard() {
    if (!this.scoreboardEl) return;
    const players = Array.from(this.players.values());
    if (!players.length) {
      this.scoreboardEl.textContent = "No players joined yet.";
      return;
    }
    players.sort((a, b) => b.score - a.score);
    this.scoreboardEl.innerHTML = players
      .map(
        (p) => `
        <div class="score-row">
          <span class="name">${p.name}</span>
          <span class="score">${p.score}</span>
        </div>`
      )
      .join("");
  }

  handleJoin(controllerId, payload = {}) {
    const raw = payload.name || "Player";
    const name = String(raw).trim() || "Player";

    let player = this.players.get(controllerId);
    if (!player) {
      player = { id: controllerId, name, score: 0 };
      this.players.set(controllerId, player);
    } else {
      player.name = name;
    }
    this.updateScoreboard();
  }

  async handleAnswer(controllerId, payload = {}) {
    if (!this.currentQuestion) {
      console.log("[StudySwapKiosk] No current question; ignoring answer.");
      return;
    }

    const { deckId, cardId, options } = this.currentQuestion;
    const choiceIndex = payload.choiceIndex;
    if (
      typeof choiceIndex !== "number" ||
      choiceIndex < 0 ||
      !options ||
      choiceIndex >= options.length
    ) {
      console.log("[StudySwapKiosk] Invalid choice index:", choiceIndex);
      return;
    }

    const selectedAnswer = options[choiceIndex];

    try {
      const res = await fetch(
        `/api/decks/${encodeURIComponent(
          deckId
        )}/study/${encodeURIComponent(cardId)}/answer`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ answer: selectedAnswer }),
        }
      );

      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const body = await res.json();
          if (body?.error) msg = body.error;
        } catch (_) {}
        throw new Error(msg);
      }

      const result = await res.json(); // { correct, correctAnswer, selectedAnswer }
      const correct = !!result.correct;

      const player = this.players.get(controllerId);
      if (player && correct) {
        player.score += 1;
        this.updateScoreboard();
      }

      // send per-player feedback
      if (
        this.client &&
        typeof this.client.sendEventToController === "function"
      ) {
        this.client.sendEventToController(controllerId, {
          eventName: "quiz:feedback",
          payload: { correct },
        });
      }
    } catch (err) {
      console.error("[StudySwapKiosk] Error checking answer:", err);
      // optional: could send error feedback here
    }
  }

  // =========================
  // Controller events
  // =========================
  onCustomEvent(eventName, payload, controllerId, ctx) {
    console.log(
      "[StudySwapKiosk] onCustomEvent",
      eventName,
      payload,
      controllerId
    );

    switch (eventName) {
      case "quiz:join":
        this.handleJoin(controllerId, payload);
        break;

      case "quiz:set_deck":
        this.activeDeckId = payload?.deckId || null;

        if (this.deckLabelEl) {
          if (this.activeDeckId) {
            const d = this.decks.find((x) => x.id === this.activeDeckId);
            this.deckLabelEl.textContent = d
              ? `Deck: ${d.title || d.id}`
              : `Deck: ${this.activeDeckId}`;
          } else {
            this.deckLabelEl.textContent = "Waiting for a deck selection…";
          }
        }

        this.currentQuestion = null;
        this.renderQuestion(null);
        this.fetchNextQuestionForActiveDeck();
        this.broadcastDeckList(); // include activeDeckId
        break;

      case "quiz:answer":
        this.handleAnswer(controllerId, payload);
        break;

      case "quiz:next_question":
        this.advanceQuestion();
        break;

      case "quiz:request_decks":
        console.log(
          "[StudySwapKiosk] Received quiz:request_decks → broadcasting deck list"
        );
        this.broadcastDeckList();
        break;

      default:
        console.log("[StudySwapKiosk] Unknown custom event", eventName);
    }
  }
}

// Bootstrap kiosk app
launchWebTouchApp({
  AppClass: StudySwapKioskApp,
  selectors: {
    appRoot: "#app-root",
    cursor: "#cursor",
    qr: "#qrCodeContainer",
  },
  debug: true,
});
