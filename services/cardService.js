// src/services/cardService.js
import { insertOne, findMany } from "../db/db.js";
import { incrementContributions } from "./userService.js";
import { getDeckForUser } from "./deckService.js";

const CARDS_COLLECTION = "cards";

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function validateCardInput({ front, back }) {
  const errors = [];

  const cleanFront = normalizeString(front);
  const cleanBack = normalizeString(back);

  if (!cleanFront) {
    errors.push("Front (question/prompt) is required");
  }
  if (!cleanBack) {
    errors.push("Back (answer) is required");
  }

  if (errors.length > 0) {
    const err = new Error(errors.join("; "));
    err.status = 400;
    throw err;
  }

  return {
    front: cleanFront,
    back: cleanBack,
  };
}

export function toPublicCard(card) {
  if (!card) return null;
  const { id, deckId, front, back, ownerUserId } = card;
  return { id, deckId, front, back, ownerUserId };
}

/**
 * Create a new card in the given deck for the given user.
 * - Enforces deck access via getDeckForUser (gate + ownership).
 * - Increments the user's contributedCount after a successful insert.
 */
export async function createCardForDeck(user, deckId, rawInput) {
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

  // Will throw 404/403 if deck doesn't exist or is not accessible.
  const deck = await getDeckForUser(user, deckId);

  const input = validateCardInput(rawInput);

  const card = await insertOne(CARDS_COLLECTION, {
    deckId: deck.id,
    front: input.front,
    back: input.back,
    ownerUserId: user.id,
  });

  // Count this towards the user's contributions
  await incrementContributions(user.id, 1);

  return card;
}

/**
 * List cards for a given deck, enforcing the same access rules.
 */
export async function listCardsForDeck(user, deckId) {
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

  // Reuse deck access rules
  const deck = await getDeckForUser(user, deckId);

  const cards = findMany(CARDS_COLLECTION, (c) => c.deckId === deck.id);
  return cards;
}
