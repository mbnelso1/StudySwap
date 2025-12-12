// public/js/studyswap/controllerMain.js
import { WebTouchController } from "../sdk/WebTouchController.js";
import { launchWebTouchController } from "../sdk/launchers.js";

class StudySwapController extends WebTouchController {
  buildUI(container, client, store, ctx) {
    console.log("[StudySwapController] buildUI");

    container.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:1rem; padding:1rem;">
        <section style="border:1px solid #4b5563; border-radius:0.75rem; padding:0.75rem;">
          <h2 style="margin-top:0;">StudySwap Controller</h2>
          <label style="display:flex; flex-direction:column; gap:0.25rem;">
            <span>Your name</span>
            <input id="playerNameInput" type="text" placeholder="Enter your name" />
          </label>
          <button id="joinGameButton" style="margin-top:0.5rem;">Join game</button>
          <div id="joinStatus" style="margin-top:0.5rem; font-size:0.9rem;"></div>
        </section>

        <section style="border:1px solid #4b5563; border-radius:0.75rem; padding:0.75rem;">
          <h3 style="margin-top:0;">Deck selection (host)</h3>
          <div id="deckStatus" style="font-size:0.9rem; margin-bottom:0.5rem;">
            Waiting for deck list from kiosk…
          </div>
          <select id="deckSelect" disabled style="width:100%; padding:0.25rem;"></select>
          <button id="setDeckButton" disabled style="margin-top:0.5rem;">
            Set deck for this room
          </button>
        </section>

        <section style="border:1px solid #4b5563; border-radius:0.75rem; padding:0.75rem;">
          <h3 style="margin-top:0;">Answer</h3>
          <div id="answerStatus" style="min-height:1.2em; font-size:0.9rem; margin-bottom:0.5rem;"></div>
          <div style="display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:0.5rem;">
            <button class="answerBtn" data-choice="0">Option 1</button>
            <button class="answerBtn" data-choice="1">Option 2</button>
            <button class="answerBtn" data-choice="2">Option 3</button>
            <button class="answerBtn" data-choice="3">Option 4</button>
          </div>
        </section>

        <section style="border:1px solid #4b5563; border-radius:0.75rem; padding:0.75rem;">
          <h3 style="margin-top:0;">Host controls</h3>
          <button id="nextQuestionButton">Next question</button>
        </section>
      </div>
    `;

    // Cache elements
    this.nameInput = container.querySelector("#playerNameInput");
    this.joinButton = container.querySelector("#joinGameButton");
    this.joinStatus = container.querySelector("#joinStatus");

    this.deckStatus = container.querySelector("#deckStatus");
    this.deckSelect = container.querySelector("#deckSelect");
    this.setDeckButton = container.querySelector("#setDeckButton");

    this.answerStatus = container.querySelector("#answerStatus");
    this.answerButtons = Array.from(
      container.querySelectorAll(".answerBtn")
    );
    this.nextQuestionButton = container.querySelector("#nextQuestionButton");

    // Local state
    this.currentDecks = [];
    this.activeDeckId = null;

    // --- Join game with a name ---
    this.joinButton.addEventListener("click", () => {
      const rawName = this.nameInput.value || "";
      const name = rawName.trim() || "Player";
      client.sendCustomEvent({
        eventName: "quiz:join",
        payload: { name },
      });
      this.joinStatus.textContent = `Joined as "${name}".`;
    });

    // --- Host chooses deck ---
    this.setDeckButton.addEventListener("click", () => {
      const deckId = this.deckSelect.value;
      if (!deckId) return;
      client.sendCustomEvent({
        eventName: "quiz:set_deck",
        payload: { deckId },
      });
      this.deckStatus.textContent = `Requested deck: ${deckId}`;
    });

    // --- Answer buttons ---
    this.answerButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.choice ?? -1);
        client.sendCustomEvent({
          eventName: "quiz:answer",
          payload: { choiceIndex: idx },
        });
        this.answerStatus.textContent = `Answered: Option ${idx + 1}`;
      });
    });

    // --- Host next-question control ---
    this.nextQuestionButton.addEventListener("click", () => {
      client.sendCustomEvent({
        eventName: "quiz:next_question",
        payload: {},
      });
    });

    // 🔹 After we successfully join a room, ask the kiosk to send deck list
    if (client && typeof client.onJoinSuccess === "function") {
      client.onJoinSuccess((roomId) => {
        console.log(
          "[StudySwapController] Joined room",
          roomId,
          "→ requesting deck list"
        );
        client.sendCustomEvent({
          eventName: "quiz:request_decks",
          payload: {},
        });
      });
    }
  }

  onAppEvent(eventName, payload, ctx) {
    console.log("[StudySwapController] onAppEvent", eventName, payload);

    // Kiosk sends deck list + active deck
    if (eventName === "quiz:deck_list") {
      const decks = payload?.decks || [];
      const activeDeckId = payload?.activeDeckId || null;
      this.currentDecks = decks;
      this.activeDeckId = activeDeckId;

      if (!decks.length) {
        this.deckStatus.textContent =
          "No decks available. Ask your instructor to create one in StudySwap.";
        this.deckSelect.disabled = true;
        this.setDeckButton.disabled = true;
        this.deckSelect.innerHTML = "";
        return;
      }

      // Populate <select>
      this.deckSelect.innerHTML = "";
      for (const d of decks) {
        const opt = document.createElement("option");
        opt.value = d.id;
        opt.textContent = d.title ? `${d.title} (${d.id})` : d.id;
        if (activeDeckId && d.id === activeDeckId) {
          opt.selected = true;
        }
        this.deckSelect.appendChild(opt);
      }

      this.deckSelect.disabled = false;
      this.setDeckButton.disabled = false;

      if (activeDeckId) {
        const activeDeck = decks.find((d) => d.id === activeDeckId);
        this.deckStatus.textContent = activeDeck
          ? `Active deck: ${activeDeck.title || activeDeck.id}`
          : `Active deck: ${activeDeckId}`;
      } else {
        this.deckStatus.textContent =
          "Select a deck and tap “Set deck for this room”.";
      }
      return;
    }

    // Per-answer feedback from kiosk
    if (eventName === "quiz:feedback") {
      const correct = !!payload?.correct;
      this.answerStatus.textContent = correct ? "✅ Correct!" : "❌ Incorrect";
      return;
    }
  }
}

// Boot via SDK helper (sets up sockets, room join, etc.)
launchWebTouchController({
  ControllerClass: StudySwapController,
  rootSelector: "#controller-app",
  debug: true,
});
