// src/db/fileAdapter.js
import fs from "fs/promises";
import path from "node:path";

export function createFileAdapter(rootDir) {
  const root = rootDir;

  return {
    async load() {
      const doc = {};
      try {
        const entries = await fs.readdir(root, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isFile() && entry.name.endsWith(".json")) {
            const col = entry.name.replace(/\.json$/, "");
            const file = path.join(root, entry.name);
            const raw = await fs.readFile(file, "utf-8");
            doc[col] = JSON.parse(raw);
          }
        }
      } catch (err) {
        if (err.code !== "ENOENT") throw err;
        // If the directory doesn't exist yet, start with an empty doc
      }
      return doc;
    },

    async save(doc) {
      await fs.mkdir(root, { recursive: true });
      for (const [col, rows] of Object.entries(doc)) {
        const file = path.join(root, `${col}.json`);
        const tmp = file + ".tmp";

        const json = JSON.stringify(rows ?? [], null, 2);
        // atomic write: write to tmp, then rename
        await fs.writeFile(tmp, json, "utf-8");
        await fs.rename(tmp, file);
      }
    }
  };
}
