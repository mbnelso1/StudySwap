// src/services/deckService.js
import { insertOne, findMany, findOne } from "../db/db.js";
import { canStudy } from "./userService.js";

const DECKS_COLLECTION = "decks";

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function validateDeckInput({ title, courseCode, description }) {
  const errors = [];

  const cleanTitle = normalizeString(title);
  const cleanCourseCode = normalizeString(courseCode);
  const cleanDescription = normalizeString(description);

  if (!cleanTitle) {
    errors.push("Title is required");
  }

  if (errors.length > 0) {
    const err = new Error(errors.join("; "));
    err.status = 400;
    throw err;
  }

  return {
    title: cleanTitle,
    courseCode: cleanCourseCode || null,
    description: cleanDescription || null,
  };
}

export function toPublicDeck(deck) {
  if (!deck) return null;
  const { id, title, courseCode, description, ownerUserId } = deck;
  return { id, title, courseCode, description, ownerUserId };
}

/**
 * Creates a new deck owned by the given user.
 */
export async function createDeckForUser(ownerUserId, rawInput) {
  if (!ownerUserId) {
    const err = new Error("Owner user ID is required");
    err.status = 400;
    throw err;
  }

  const input = validateDeckInput(rawInput);

  const deck = await insertOne(DECKS_COLLECTION, {
    ...input,
    ownerUserId,
  });

  return deck;
}

/**
 * Lists decks visible to the given user.
 * - If the user has fewer than 10 contributions, they only see their own decks.
 * - If the user canStudy, they see all decks.
 */
export async function listDecksForUser(user) {
  if (!user || !user.id) {
    const err = new Error("User is required");
    err.status = 400;
    throw err;
  }

  const userCanStudy = canStudy(user);

  if (!userCanStudy) {
    // Only their own decks
    return findMany(DECKS_COLLECTION, (d) => d.ownerUserId === user.id);
  }

  // Can study → see all decks
  return findMany(DECKS_COLLECTION);
}

/**
 * Loads a single deck, enforcing access rules:
 * - If the user does not own the deck AND cannot study, they get 403.
 */
export async function getDeckForUser(user, deckId) {
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

  const deck = findOne(DECKS_COLLECTION, (d) => d.id === deckId);

  if (!deck) {
    const err = new Error("Deck not found");
    err.status = 404;
    throw err;
  }

  const userCanStudy = canStudy(user);

  if (!userCanStudy && deck.ownerUserId !== user.id) {
    const err = new Error("You do not have access to this deck");
    err.status = 403;
    throw err;
  }

  return deck;
}
