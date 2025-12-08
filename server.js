// server.js
import express from "express";
import session from "express-session";
import path from "path";
import { fileURLToPath } from "url";

import { useAdapter, boot } from "./src/db/db.js";
import { FileAdapter } from "./src/db/fileAdapter.js";
import sessionRouter from "./src/api/sessionRoutes.js";
import deckRouter from "./src/api/deckRoutes.js";
import cardRouter from "./src/api/cardRoutes.js";
import studyRouter from "./src/api/studyRoutes.js";
import errorHandler from "./src/middleware/errorHandler.js";

// --------- ES module __dirname shim ---------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --------- Constants ---------
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "data", "studyswap.json");
const SESSION_COOKIE_NAME = "studyswap.sid";

const app = express();

// --------- Core middleware ---------
app.use(express.json());

app.use(
  session({
    name: SESSION_COOKIE_NAME,
    secret: process.env.SESSION_SECRET || "dev-studyswap-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      // secure: process.env.NODE_ENV === "production",
    },
  })
);

// Static files for thin UI
app.use(express.static(path.join(__dirname, "public")));

// --------- Health check ---------
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    track: "Thin UI",
    sessionId: req.sessionID ?? null,
  });
});

// --------- API routes ---------
app.use("/api/session", sessionRouter);
app.use("/api/decks", deckRouter);
app.use("/api/decks", cardRouter);
app.use("/api/decks", studyRouter);

// --------- 404 handler ---------
app.use((req, res, next) => {
  res.status(404).json({ error: "Not Found" });
});

// --------- Global error handler (from middleware) ---------
app.use(errorHandler);

// --------- Boot DB + start server ---------
async function main() {
  const adapter = new FileAdapter(DATA_FILE);
  useAdapter(adapter);

  await boot();

  if (process.env.NODE_ENV !== "test") {
    app.listen(PORT, () => {
      console.log(`Server listening on http://localhost:${PORT}`);
    });
  }
}

main().catch((err) => {
  console.error("Fatal error during startup:", err);
  process.exit(1);
});

export default app;
