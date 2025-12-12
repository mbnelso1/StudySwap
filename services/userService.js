// src/services/userService.js
import { insertOne, findOne, updateOne } from "../db/db.js";

const USERS_COLLECTION = "users";
const CONTRIBUTION_THRESHOLD = 10;

function normalizeName(name) {
  if (typeof name !== "string") return "";
  return name.trim();
}

/**
 * Returns true if the user has contributed enough cards to unlock study mode.
 */
export function canStudy(user) {
  const count =
    typeof user?.contributedCount === "number" ? user.contributedCount : 0;
  return count >= CONTRIBUTION_THRESHOLD;
}

/**
 * Shapes an internal user record into the public JSON we return from the API.
 */
export function toPublicUser(user) {
  if (!user) return null;

  const { id, name } = user;
  const contributedCount =
    typeof user.contributedCount === "number" ? user.contributedCount : 0;

  return {
    id,
    name,
    contributedCount,
    canStudy: canStudy({ ...user, contributedCount }),
  };
}

/**
 * Find an existing user by name (case-insensitive), or create a new one.
 * Throws a 400 error if the name is missing/blank.
 */
export async function findOrCreateUserByName(rawName) {
  const name = normalizeName(rawName);

  if (!name) {
    const err = new Error("Name is required");
    err.status = 400;
    throw err;
  }

  const existing = findOne(
    USERS_COLLECTION,
    (u) =>
      typeof u.name === "string" &&
      u.name.toLowerCase() === name.toLowerCase()
  );

  if (existing) {
    return existing;
  }

  // New user starts with 0 contributions
  return await insertOne(USERS_COLLECTION, {
    name,
    contributedCount: 0,
  });
}

/**
 * Look up a user by ID. Returns null if not found.
 */
export async function getUserById(id) {
  if (!id) return null;
  const user = findOne(USERS_COLLECTION, (u) => u.id === id);
  return user ?? null;
}

/**
 * Increment a user's contributedCount (e.g., when they add a card).
 * Throws 404 if the user does not exist.
 */
export async function incrementContributions(userId, delta = 1) {
  const user = await getUserById(userId);
  if (!user) {
    const err = new Error("User not found");
    err.status = 404;
    throw err;
  }

  const current =
    typeof user.contributedCount === "number" ? user.contributedCount : 0;

  const updated = await updateOne(USERS_COLLECTION, user.id, {
    contributedCount: current + delta,
  });

  return updated;
}

/**
 * Helper to resolve the current user from a session object.
 */
export async function getUserFromSession(session) {
  if (!session || !session.userId) return null;
  return await getUserById(session.userId);
}

export { CONTRIBUTION_THRESHOLD };
