// src/middleware/errorHandler.js

/**
 * Global error handler middleware.
 * - Logs the error on the server.
 * - Sends a JSON response with a reasonable status code.
 * - Normalizes the response shape to { error: "message" }.
 */
export default function errorHandler(err, req, res, next) {
  // Log full error for server-side debugging
  console.error(err);

  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  res.status(status).json({ error: message });
}
