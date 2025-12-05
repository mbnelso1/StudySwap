// tests/db-test.js
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "fs/promises";

import { useAdapter, boot, insertOne, getAll, updateOne, deleteOne } from "../src/db/db.js";
import { createFileAdapter } from "../src/db/fileAdapter.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, "..", "data");

// clean out any old data
await fs.mkdir(dataDir, { recursive: true });
for (const f of await fs.readdir(dataDir)) {
  if (f.endsWith(".json") || f.endsWith(".json.tmp")) {
    await fs.rm(path.join(dataDir, f));
  }
}

useAdapter(createFileAdapter(dataDir));
await boot();

console.log("Inserting cards...");
const c1 = await insertOne("cards", { front: "Q1", back: "A1" });
const c2 = await insertOne("cards", { front: "Q2", back: "A2" });

console.log("Cards after insert:", getAll("cards"));

console.log("Updating first card...");
await updateOne("cards", c1.id, { back: "A1 (updated)" });
console.log("Cards after update:", getAll("cards"));

console.log("Deleting second card...");
await deleteOne("cards", c2.id);
console.log("Cards after delete:", getAll("cards"));

console.log("Done.");
