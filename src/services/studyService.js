// src/services/studyService.js
import { listCardsForDeck } from "./cardService.js";

function shuffle(array) {
  const copy = array.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Build a multiple-choice question from a set of cards in a deck.
 * - Picks one card as the "correct" one.
 * - Picks up to 3 other cards as distractors.
 * - Shuffles the answer options.
 */
function buildQuestionPayload(deckId, card, cards) {
  // collect all possible distractor answers (card backs from other cards)
  const distractorBacks = cards
    .filter((c) => c.id !== card.id)
    .map((c) => c.back)
    .filter((back, index, arr) => arr.indexOf(back) === index);

  // Take up to 3 distractors
  const maxDistractors = 3;
  const chosenDistractors = shuffle(distractorBacks).slice(0, maxDistractors);

  const options = shuffle([card.back, ...chosenDistractors]);

  return {
    deckId,
    cardId: card.id,
    front: card.front,
    options,
  };
}

/**
 * Get the next multiple-choice question for a deck.
 * For now, this just picks a random card from the deck's cards.
 */
export async function getNextQuestionForDeck(user, deckId) {
  if (!user || !user.id) {
    const err = new Error("User is required");
    err.status = 400;
    throw err;
  }

  if (!deckId) {
    const err = new Error("Deck ID is required");
    err.status = 400;
    throw err;
  }

  const cards = await listCardsForDeck(user, deckId);

  if (!cards || cards.length === 0) {
    const err = new Error("Deck has no cards to study");
    err.status = 400;
    throw err;
  }

  // Pick a random card from the deck
  const index = Math.floor(Math.random() * cards.length);
  const card = cards[index];

  return buildQuestionPayload(deckId, card, cards);
}

/**
 * Check a user's answer for a given card.
 * - answerValue is compared to the card's `back` text.
 * - Returns { correct, correctAnswer, selectedAnswer }.
 *
 * NOTE: For now, we don't record stats; that can be added later.
 */
export async function checkAnswerForDeck(user, deckId, cardId, answerValue) {
  if (!user || !user.id) {
    const err = new Error("User is required");
    err.status = 400;
    throw err;
  }

  if (!deckId || !cardId) {
    const err = new Error("Deck ID and card ID are required");
    err.status = 400;
    throw err;
  }

  const cards = await listCardsForDeck(user, deckId);

  if (!cards || cards.length === 0) {
    const err = new Error("Deck has no cards to study");
    err.status = 400;
    throw err;
  }

  const card = cards.find((c) => c.id === cardId);
  if (!card) {
    const err = new Error("Card not found in this deck");
    err.status = 404;
    throw err;
  }

  const selectedAnswer = typeof answerValue === "string" ? answerValue : "";
  const correctAnswer = card.back;

  const correct =
    selectedAnswer.trim().toLowerCase() ===
    String(correctAnswer).trim().toLowerCase();

  return {
    correct,
    correctAnswer,
    selectedAnswer,
  };
}
