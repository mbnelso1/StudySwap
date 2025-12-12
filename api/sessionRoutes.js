// src/api/sessionRoutes.js
import express from "express";
import {
  findOrCreateUserByName,
  toPublicUser,
  getUserFromSession,
} from "../services/userService.js";

const router = express.Router();

/**
 * POST /api/session/login
 * Body: { "name": "Alice" }
 * Response: { "user": { id, name, contributedCount, canStudy } }
 */
router.post("/login", async (req, res, next) => {
  try {
    const { name } = req.body || {};

    if (!name || typeof name !== "string" || !name.trim()) {
      const err = new Error("Name is required");
      err.status = 400;
      throw err;
    }

    const user = await findOrCreateUserByName(name);

    // Attach user ID to the session cookie
    req.session.userId = user.id;

    res.json({ user: toPublicUser(user) });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/session/logout
 * Clears the session cookie.
 */
router.post("/logout", (req, res, next) => {
  if (!req.session) {
    return res.json({ ok: true });
  }

  req.session.destroy((err) => {
    if (err) {
      return next(err);
    }
    // Match the cookie name from server.js
    res.clearCookie("studyswap.sid");
    res.json({ ok: true });
  });
});

/**
 * GET /api/session/me
 * Returns the currently logged-in user, or 401 if not logged in.
 */
router.get("/me", async (req, res, next) => {
  try {
    const user = await getUserFromSession(req.session);
    if (!user) {
      const err = new Error("Not logged in");
      err.status = 401;
      throw err;
    }

    res.json({ user: toPublicUser(user) });
  } catch (err) {
    next(err);
  }
});

export default router;
