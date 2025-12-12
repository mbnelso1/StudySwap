// src/api/deckRoutes.js
import express from "express";
import {
  createDeckForUser,
  listDecksForUser,
  getDeckForUser,
  toPublicDeck,
} from "../services/deckService.js";
import { requireUser } from "../middleware/auth.js";

const router = express.Router();

/**
 * All routes in this router require a logged-in user.
 * requireUser will load the user and attach it to req.user.
 */
router.use(requireUser);

/**
 * GET /api/decks
 * List decks visible to the current user.
 */
router.get("/", async (req, res, next) => {
  try {
    const user = req.user;
    const decks = await listDecksForUser(user);
    res.json(decks.map(toPublicDeck));
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/decks
 * Create a new deck owned by the current user.
 * Body: { title, courseCode?, description? }
 */
router.post("/", async (req, res, next) => {
  try {
    const user = req.user;
    const { title, courseCode, description } = req.body || {};

    const deck = await createDeckForUser(user.id, {
      title,
      courseCode,
      description,
    });

    res.status(201).json(toPublicDeck(deck));
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/decks/:deckId
 * Get a single deck if the user is allowed to see it.
 */
router.get("/:deckId", async (req, res, next) => {
  try {
    const user = req.user;
    const deckId = req.params.deckId;
    const deck = await getDeckForUser(user, deckId);
    res.json(toPublicDeck(deck));
  } catch (err) {
    next(err);
  }
});

export default router;
