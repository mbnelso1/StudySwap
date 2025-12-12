// src/api/cardRoutes.js
import express from "express";
import {
  createCardForDeck,
  listCardsForDeck,
  toPublicCard,
} from "../services/cardService.js";
import { requireUser } from "../middleware/auth.js";

const router = express.Router();

/**
 * All card routes require a logged-in user.
 */
router.use(requireUser);

/**
 * GET /api/decks/:deckId/cards
 * List cards in a deck, enforcing access rules and the contribution gate.
 */
router.get("/:deckId/cards", async (req, res, next) => {
  try {
    const user = req.user;
    const deckId = req.params.deckId;

    const cards = await listCardsForDeck(user, deckId);
    res.json(cards.map(toPublicCard));
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/decks/:deckId/cards
 * Create a new card in the given deck.
 * Body: { front, back }
 */
router.post("/:deckId/cards", async (req, res, next) => {
  try {
    const user = req.user;
    const deckId = req.params.deckId;
    const { front, back } = req.body || {};

    const card = await createCardForDeck(user, deckId, { front, back });
    res.status(201).json(toPublicCard(card));
  } catch (err) {
    next(err);
  }
});

export default router;
