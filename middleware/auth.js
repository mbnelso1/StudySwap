// src/middleware/auth.js
import {
  getUserFromSession,
  canStudy,
  CONTRIBUTION_THRESHOLD,
} from "../services/userService.js";

/**
 * Require a logged-in user.
 * - Loads the user from the session.
 * - Attaches it to req.user.
 * - Throws 401 if not logged in.
 */
export async function requireUser(req, res, next) {
  try {
    const user = await getUserFromSession(req.session);

    if (!user) {
      const err = new Error("Not logged in");
      err.status = 401;
      throw err;
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Require that the current user has reached the contribution threshold.
 * - Assumes requireUser has already run and set req.user.
 * - Throws 403 if the user has not contributed enough.
 *
 * NOTE: You can use this later on any routes that must be locked
 *       behind the 10-card gate (e.g., "global browse" or "study mode").
 */
export function requireCanStudy(req, res, next) {
  try {
    const user = req.user;
    if (!user) {
      const err = new Error("Not logged in");
      err.status = 401;
      throw err;
    }

    if (!canStudy(user)) {
      const err = new Error(
        `You must contribute at least ${CONTRIBUTION_THRESHOLD} cards before using this feature`
      );
      err.status = 403;
      throw err;
    }

    next();
  } catch (err) {
    next(err);
  }
}
