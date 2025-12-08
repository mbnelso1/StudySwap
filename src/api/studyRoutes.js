// src/api/studyRoutes.js
import express from "express";
import {
  getNextQuestionForDeck,
  checkAnswerForDeck,
} from "../services/studyService.js";
import { requireUser } from "../middleware/auth.js";

const router = express.Router();

/**
 * All study routes require a logged-in user.
 * (You could also chain requireCanStudy here later if you want to
 *  fully lock study behind the 10-card gate.)
 */
router.use(requireUser);

/**
 * GET /api/decks/:deckId/study/next
 * Returns a multiple-choice question for the given deck.
 *
 * Response:
 * {
 *   deckId,
 *   cardId,
 *   front,
 *   options: [ "Hypertext Transfer Protocol", "..." ]
 * }
 */
router.get("/:deckId/study/next", async (req, res, next) => {
  try {
    const user = req.user;
    const deckId = req.params.deckId;

    const question = await getNextQuestionForDeck(user, deckId);
    res.json(question);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/decks/:deckId/study/:cardId/answer
 * Body: { "answer": "Hypertext Transfer Protocol" }
 *
 * Response:
 * {
 *   correct: true/false,
 *   correctAnswer: "...",
 *   selectedAnswer: "..."
 * }
 */
router.post("/:deckId/study/:cardId/answer", async (req, res, next) => {
  try {
    const user = req.user;
    const deckId = req.params.deckId;
    const cardId = req.params.cardId;
    const { answer } = req.body || {};

    if (!answer || typeof answer !== "string") {
      const err = new Error("Answer is required");
      err.status = 400;
      throw err;
    }

    const result = await checkAnswerForDeck(user, deckId, cardId, answer);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
